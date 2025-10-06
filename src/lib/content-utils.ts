import { getCollection, type CollectionEntry } from 'astro:content';

export type YearEntry = CollectionEntry<'years'>;
export type RankingEntry = CollectionEntry<'rankings'>;

type YearGroups = Record<number, YearEntry[]>;

const byAscendingRanking = <T extends { data: { ranking: number } }>(a: T, b: T) =>
  a.data.ranking - b.data.ranking;

const buildSlugIndex = <T extends { slug: string }>(entries: readonly T[]) => {
  return new Map(entries.map((entry) => [entry.slug, entry]));
};

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
