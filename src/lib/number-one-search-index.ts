import { getCollection } from 'astro:content';
import { getSpotifyTrackId } from '../data/spotify-tracks';

interface NumberOneEntry {
  title: string;
  artist: string;
  notes?: string[];
}

export interface NumberOneSearchRecordAppearance {
  year: number;
  slug: string;
  /** Ranking of the year in the overall list. */
  yearRanking: number;
  /** Zero-based index of the track within the year's #1 list. */
  sequence: number;
}

export interface NumberOneSearchRecord {
  id: string;
  title: string;
  artist: string;
  notes: string[];
  appearances: NumberOneSearchRecordAppearance[];
  spotifyTrackId?: string;
  coverWebp?: string;
  coverAvif?: string;
  /** Normalized search tokens used by the client-side search script. */
  tokens: string[];
}

// Import cover manifest statically (for search indexing album art)
import coverManifest from '../../scripts/cache/cover-manifest.json';
interface CoverManifestEntry { webp?: string; avif?: string; }
const manifest = coverManifest as Record<string, CoverManifestEntry>;
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
  entry.appearances.forEach((appearance) => {
    add(appearance.year);
    add(appearance.slug);
    add(appearance.yearRanking);
    add(appearance.sequence);
  });
  entry.notes.forEach(add);

  return Array.from(tokenSet);
};

export function filterNumberOneSearchRecords(
  records: NumberOneSearchRecord[],
  query: string
): NumberOneSearchRecord[] {
  const terms = tokenize(query);
  if (!terms.length) {
    return [];
  }
  return records
    .filter((record) => terms.every((term) => record.tokens.some((token) => token.includes(term))))
    .sort((a, b) => {
      const aFirst = a.appearances[0];
      const bFirst = b.appearances[0];
      if (!aFirst || !bFirst) return 0;
      if (aFirst.year === bFirst.year) {
        return aFirst.sequence - bFirst.sequence;
      }
      return aFirst.year - bFirst.year;
    });
}

export async function loadNumberOneSearchIndex(): Promise<NumberOneSearchRecord[]> {
  const yearEntries = await getCollection('years');

  const normalizeKey = (title: string, artist: string) =>
    normalize(`${title}::${artist}`).replace(/[^a-z0-9]+/g, '-');

  const grouped = new Map<string, NumberOneSearchRecord>();

  yearEntries.forEach((entry) => {
    const { slug } = entry;
    const { numberOnes = [], year, ranking } = entry.data;
    const yearRanking = typeof ranking === 'number' ? ranking : 0;

    numberOnes.forEach((track: NumberOneEntry, index) => {
      const appearance = {
        year,
        slug,
        yearRanking,
        sequence: index,
      } satisfies NumberOneSearchRecordAppearance;

      const key = normalizeKey(track.title, track.artist);
      const existing = grouped.get(key);
      const spotifyTrackId = getSpotifyTrackId(track.title, track.artist) ?? undefined;

      if (existing) {
        existing.appearances.push(appearance);
        if (spotifyTrackId && !existing.spotifyTrackId) {
          existing.spotifyTrackId = spotifyTrackId;
        }
        track.notes?.forEach((note) => existing.notes.push(note));
      } else {
        const sanitizedKey = key.replace(/^-+|-+$/g, '');
        const idBase = sanitizedKey || `${year}-${index + 1}`;
        // Reuse album-art manifest import (static import keeps code synchronous)
        const coverEntry = manifest[sanitizedKey];
        grouped.set(key, {
          id: `track-${idBase}`,
          title: track.title,
          artist: track.artist,
          notes: [...(track.notes ?? [])],
          appearances: [appearance],
          spotifyTrackId,
          coverWebp: coverEntry?.webp?.replace(/^public\//, '/') ?? undefined,
          coverAvif: coverEntry?.avif?.replace(/^public\//, '/') ?? undefined,
          tokens: [],
        });
      }
    });
  });

  const records = Array.from(grouped.values()).map((record) => {
    const noteSet = new Set(record.notes);
    record.notes = Array.from(noteSet);
    record.appearances.sort((a, b) => {
      if (a.year === b.year) {
        return a.sequence - b.sequence;
      }
      return a.year - b.year;
    });
    record.tokens = buildTokens(record);
    return record;
  });

  return records.sort((a, b) => {
    const aFirst = a.appearances[0];
    const bFirst = b.appearances[0];
    if (!aFirst || !bFirst) {
      return 0;
    }
    if (aFirst.year === bFirst.year) {
      return aFirst.sequence - bFirst.sequence;
    }
    return aFirst.year - bFirst.year;
  });
}
