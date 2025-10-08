import { getCollection } from 'astro:content';
import { getSpotifyTrackId } from '../data/spotify-tracks';

interface NumberOneEntry {
  title: string;
  artist: string;
  notes?: string[];
}

export interface NumberOneSearchRecord {
  id: string;
  title: string;
  artist: string;
  notes: string[];
  year: number;
  slug: string;
  /** Ranking of the year in the overall list. */
  yearRanking: number;
  /** Zero-based index of the track within the year's #1 list. */
  sequence: number;
  spotifyTrackId?: string;
  /** Normalized search tokens used by the client-side search script. */
  tokens: string[];
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const tokenize = (value: string): string[] => {
  const normalized = normalize(value);
  return normalized
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const buildTokens = (entry: NumberOneSearchRecord): string[] => {
  const tokenSet = new Set<string>();
  const add = (value: string | number | undefined) => {
    if (value === undefined || value === null) {
      return;
    }
    const stringValue = String(value);
    if (!stringValue) return;
    for (const token of tokenize(stringValue)) {
      tokenSet.add(token);
    }
  };

  add(entry.title);
  add(entry.artist);
  add(entry.year);
  add(entry.slug);
  add(entry.yearRanking);
  entry.notes.forEach(add);

  return Array.from(tokenSet);
};

export async function loadNumberOneSearchIndex(): Promise<NumberOneSearchRecord[]> {
  const yearEntries = await getCollection('years');

  const flattened = yearEntries.flatMap((entry) => {
    const { slug } = entry;
    const { numberOnes = [], year, ranking } = entry.data;
    const yearRanking = typeof ranking === 'number' ? ranking : 0;

    return numberOnes.map((track: NumberOneEntry, index) => {
      const id = `year-${year}-${slug}-number-${index + 1}`;
      const baseRecord: NumberOneSearchRecord = {
        id,
        title: track.title,
        artist: track.artist,
        notes: track.notes ?? [],
        year,
        slug,
        yearRanking,
        sequence: index,
        spotifyTrackId: getSpotifyTrackId(track.title, track.artist) ?? undefined,
        tokens: [],
      };

      const tokens = buildTokens(baseRecord);
      return {
        ...baseRecord,
        tokens,
      };
    });
  });

  return flattened.sort((a, b) => {
    if (a.year === b.year) {
      return a.sequence - b.sequence;
    }
    return b.year - a.year;
  });
}
