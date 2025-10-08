import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionEntry } from 'astro:content';

const createEntry = <T extends 'years' | 'rankings'>(
  collection: T,
  slug: string,
  data: CollectionEntry<T>['data']
): CollectionEntry<T> =>
  ({
    id: `${collection}/${slug}.mdx`,
    slug,
    body: '',
    collection,
    data,
  }) as unknown as CollectionEntry<T>;

const mockYears = [
  createEntry('years', '1999-chart-toppers', {
    title: '1999 Chart Toppers',
    slug: '1999-chart-toppers',
    release_date: new Date('1999-06-01'),
    artist: 'Santana ft. Rob Thomas',
    ranking: 1,
    commentary_excerpt: '1999 ruled by crossovers.',
    commentary: 'Details about 1999.',
    year: 1999,
    numberOnes: [
      {
        position: 1,
        title: 'Smooth',
        artist: 'Santana ft. Rob Thomas',
        notes: ['Dominated radio rotation.'],
      },
    ],
    overallRanking: [
      {
        position: 1,
        title: 'Smooth',
        artist: 'Santana ft. Rob Thomas',
      },
    ],
    yearSummary: '1999 blended Latin rock and teen pop for historic runs.',
  }),
  createEntry('years', '1999-pop-surges', {
    title: '1999 Pop Surges',
    slug: '1999-pop-surges',
    release_date: new Date('1999-08-01'),
    artist: 'Pop Icons',
    ranking: 7,
    commentary_excerpt: 'Pop surge continues.',
    commentary: 'More 1999 details.',
    year: 1999,
    numberOnes: [
      {
        position: 1,
        title: 'Genie in a Bottle',
        artist: 'Christina Aguilera',
        notes: ['TRL mainstay.'],
      },
    ],
    overallRanking: [
      {
        position: 1,
        title: 'Genie in a Bottle',
        artist: 'Christina Aguilera',
      },
    ],
  }),
  createEntry('years', '2000-new-millennium', {
    title: '2000 New Millennium',
    slug: '2000-new-millennium',
    release_date: new Date('2000-01-01'),
    artist: 'Millennium Stars',
    ranking: 2,
    commentary_excerpt: 'A new era begins.',
    commentary: 'Details about 2000.',
    year: 2000,
    numberOnes: [
      {
        position: 1,
        title: 'Independent Women Part I',
        artist: "Destiny's Child",
        notes: ['Soundtracked action flicks.'],
      },
    ],
    overallRanking: [
      {
        position: 1,
        title: 'Independent Women Part I',
        artist: "Destiny's Child",
      },
    ],
  }),
];

const mockRankings = [
  createEntry('rankings', 'smooth-number-one', {
    title: 'Smooth',
    slug: 'smooth-number-one',
    release_date: new Date('1999-10-23'),
    artist: 'Santana ft. Rob Thomas',
    ranking: 1,
    commentary_excerpt: 'Dominating the chart.',
    commentary: 'Smooth hits number one.',
    chart_week: new Date('1999-10-23'),
    entries: [
      {
        position: 1,
        title: 'Smooth',
        artist: 'Santana ft. Rob Thomas',
        commentary: 'Still at the summit.',
      },
    ],
  }),
  createEntry('rankings', 'genie-in-a-bottle', {
    title: 'Genie in a Bottle',
    slug: 'genie-in-a-bottle',
    release_date: new Date('1999-07-31'),
    artist: 'Christina Aguilera',
    ranking: 2,
    commentary_excerpt: 'New pop powerhouse.',
    commentary: 'Genie reaches number two.',
    chart_week: new Date('1999-07-31'),
    entries: [
      {
        position: 2,
        title: 'Genie in a Bottle',
        artist: 'Christina Aguilera',
        commentary: 'Climbing quickly.',
      },
    ],
  }),
  createEntry('rankings', 'baby-one-more-time', {
    title: '...Baby One More Time',
    slug: 'baby-one-more-time',
    release_date: new Date('1999-01-30'),
    artist: 'Britney Spears',
    ranking: 5,
    commentary_excerpt: 'Teen pop explosion.',
    commentary: 'Baby One More Time stays strong.',
    chart_week: new Date('1999-01-30'),
    entries: [
      {
        position: 5,
        title: '...Baby One More Time',
        artist: 'Britney Spears',
        commentary: 'Holding in the top five.',
      },
    ],
  }),
  createEntry('rankings', 'obscure-hit-280', {
    title: 'Obscure Hit',
    slug: 'obscure-hit-280',
    release_date: new Date('1999-12-25'),
    artist: 'Unknown Artist',
    ranking: 280,
    commentary_excerpt: 'Deep in the chart.',
    commentary: 'Obscure track near the bottom.',
    chart_week: new Date('1999-12-25'),
    entries: [
      {
        position: 280,
        title: 'Obscure Hit',
        artist: 'Unknown Artist',
        commentary: 'Almost off the charts.',
      },
    ],
  }),
];

const cloneEntries = <T extends { data: Record<string, unknown> }>(entries: readonly T[]): T[] =>
  entries.map((entry) => ({ ...entry, data: { ...entry.data } })) as T[];

const getCollectionMock = vi.fn(async (collection: string) => {
  switch (collection) {
    case 'years':
      return cloneEntries(mockYears);
    case 'rankings':
      return cloneEntries(mockRankings);
    default:
      throw new Error(`Unknown collection: ${collection}`);
  }
});

vi.mock('astro:content', () => ({
  getCollection: (collection: string) => getCollectionMock(collection),
}));

import {
  getYearGroups,
  getYearSlugIndex,
  getRankingSlugIndex,
  groupYearsByDecade,
} from './content-utils';

beforeEach(() => {
  getCollectionMock.mockClear();
});

describe('content-utils grouping helpers', () => {
  it('groups years by numeric year and sorts entries', async () => {
    const groups = await getYearGroups();
    expect(Object.keys(groups).sort()).toEqual(['1999', '2000']);
    expect(groups[1999].map((entry) => entry.data.ranking)).toEqual([1, 7]);
  });

  it('organizes grouped years into decade buckets', async () => {
    const groups = await getYearGroups();
    const decades = groupYearsByDecade(groups);

    expect(decades.map((bucket) => bucket.decade)).toEqual([1990, 2000]);
    expect(decades[0].years.map((year) => year.year)).toEqual([1999]);
    expect(decades[1].years.map((year) => year.year)).toEqual([2000]);
  });
});

describe('slug index helpers', () => {
  it('builds a year slug index map', async () => {
    const index = await getYearSlugIndex();
    expect(index.has('1999-chart-toppers')).toBe(true);
  });

  it('builds a ranking slug index map', async () => {
    const index = await getRankingSlugIndex();
    expect(index.size).toBe(mockRankings.length);
  });
});
