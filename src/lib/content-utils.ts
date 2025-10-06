import { getCollection, type CollectionEntry } from 'astro:content';

export type DecadeEntry = CollectionEntry<'decades'>;
export type YearEntry = CollectionEntry<'years'>;
export type RankingEntry = CollectionEntry<'rankings'>;

type DecadeGroups = Record<string, DecadeEntry[]>;
type YearGroups = Record<number, YearEntry[]>;

const byAscendingRanking = <T extends { data: { ranking: number } }>(a: T, b: T) =>
  a.data.ranking - b.data.ranking;

const byDescendingRanking = <T extends { data: { ranking: number } }>(a: T, b: T) =>
  b.data.ranking - a.data.ranking;

const buildSlugIndex = <T extends { slug: string }>(entries: readonly T[]) => {
  return new Map(entries.map((entry) => [entry.slug, entry]));
};

/**
 * Fetch all decade entries grouped by their `decade` field.
 * Groups are sorted by the ascending track ranking for predictable ordering.
 */
export async function getDecadeGroups(): Promise<DecadeGroups> {
  const entries = await getCollection('decades');
  const groups: DecadeGroups = {};

  for (const entry of entries) {
    const key = entry.data.decade;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  }

  for (const decade of Object.keys(groups)) {
    groups[decade] = groups[decade].sort(byAscendingRanking);
  }

  return groups;
}

/**
 * Fetch all year entries grouped by their numeric `year` field.
 * Groups are sorted by the ascending track ranking for predictable ordering.
 */
export async function getYearGroups(): Promise<YearGroups> {
  const entries = await getCollection('years');
  const groups: YearGroups = {};

  for (const entry of entries) {
    const key = entry.data.year;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  }

  for (const year of Object.keys(groups)) {
    const numericYear = Number(year);
    groups[numericYear] = groups[numericYear].sort(byAscendingRanking);
  }

  return groups;
}

/**
 * Build a slug index for the decades collection for quick lookups (e.g. in getStaticPaths).
 */
export async function getDecadeSlugIndex(): Promise<Map<string, DecadeEntry>> {
  const entries = await getCollection('decades');
  return buildSlugIndex(entries);
}

/**
 * Build a slug index for the years collection for quick lookups (e.g. in getStaticPaths).
 */
export async function getYearSlugIndex(): Promise<Map<string, YearEntry>> {
  const entries = await getCollection('years');
  return buildSlugIndex(entries);
}

/**
 * Build a slug index for the rankings collection for quick lookups (e.g. in getStaticPaths).
 */
export async function getRankingSlugIndex(): Promise<Map<string, RankingEntry>> {
  const entries = await getCollection('rankings');
  return buildSlugIndex(entries);
}

const sortRankings = async () => {
  const entries = await getCollection('rankings');
  return [...entries].sort(byAscendingRanking);
};

/**
 * Get the top N ranking entries (lower numbers indicate higher chart position).
 */
export async function getTopRankings(limit = 220): Promise<RankingEntry[]> {
  if (limit <= 0) return [];
  const sorted = await sortRankings();
  return sorted.slice(0, limit);
}

/**
 * Get the bottom N ranking entries (higher numbers indicate lower chart position).
 */
export async function getBottomRankings(limit = 60): Promise<RankingEntry[]> {
  if (limit <= 0) return [];
  const sorted = await sortRankings();
  return sorted.slice(Math.max(sorted.length - limit, 0)).sort(byDescendingRanking);
}

export interface RankingSlices {
  top: RankingEntry[];
  bottom: RankingEntry[];
}

/**
 * Convenience helper to fetch both the top and bottom ranking slices in a single request.
 */
export async function getRankingSlices(topLimit = 220, bottomLimit = 60): Promise<RankingSlices> {
  const sorted = await sortRankings();
  const top = topLimit > 0 ? sorted.slice(0, topLimit) : [];
  const bottom =
    bottomLimit > 0
      ? sorted.slice(Math.max(sorted.length - bottomLimit, 0)).sort(byDescendingRanking)
      : [];

  return { top, bottom };
}
