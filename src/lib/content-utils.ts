import { getCollection, type CollectionEntry } from 'astro:content';

export type YearEntry = CollectionEntry<'years'>;
export type RankingEntry = CollectionEntry<'rankings'>;
export type DecadeEntry = CollectionEntry<'decades'>;

export type YearGroups = Record<number, YearEntry[]>;

export interface DecadeBucket {
  decade: number;
  years: { year: number; entries: YearEntry[] }[];
}

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

export function groupYearsByDecade(groups: YearGroups): DecadeBucket[] {
  const orderedYears = Object.keys(groups)
    .map((year) => Number(year))
    .sort((a, b) => a - b);

  const decadeMap = new Map<number, { year: number; entries: YearEntry[] }[]>();

  for (const year of orderedYears) {
    const entries = groups[year];
    if (!entries || entries.length === 0) continue;
    const decade = Math.floor(year / 10) * 10;
    const bucket = decadeMap.get(decade) ?? [];
    bucket.push({ year, entries });
    decadeMap.set(decade, bucket);
  }

  return Array.from(decadeMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([decade, years]) => ({
      decade,
      years: years.sort((a, b) => a.year - b.year),
    }));
}

export async function getDecades(): Promise<DecadeEntry[]> {
  const entries = await getCollection('decades');
  return entries.sort((a, b) => a.data.decade - b.data.decade);
}

export function getYearsForDecade(decade: number, groups: YearGroups): YearEntry[] {
  const start = Math.floor(decade / 10) * 10;
  const end = start + 9;

  const years: YearEntry[] = [];

  for (let year = start; year <= end; year += 1) {
    const entries = groups[year] ?? [];
    if (!entries.length) continue;
    years.push(...entries);
  }

  return years.sort((a, b) => {
    if (a.data.year !== b.data.year) {
      return a.data.year - b.data.year;
    }
    return a.data.ranking - b.data.ranking;
  });
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
