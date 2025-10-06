import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionEntry } from 'astro:content';

const createEntry = <T extends 'decades' | 'years' | 'rankings'>(
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

const mockDecades = [
  createEntry('decades', '1990s-pop-resurgence', {
    title: '1990s Pop Resurgence',
    slug: '1990s-pop-resurgence',
    release_date: new Date('1990-01-01'),
    artist: 'Various Artists',
    ranking: 5,
    commentary_excerpt: 'A decade of pop dominance.',
    commentary: 'Details about the 1990s.',
    cover_image: {
      src: '/images/decades/1990s.jpg',
      width: 1600,
      height: 900,
      alt: '1990s collage',
      format: 'jpg',
    },
    tags: ['pop'],
    decade: '1990s',
  }),
  createEntry('decades', '1990s-rb-rise', {
    title: '1990s R&B Rise',
    slug: '1990s-rb-rise',
    release_date: new Date('1994-02-01'),
    artist: 'R&B Icons',
    ranking: 3,
    commentary_excerpt: 'R&B takes over.',
    commentary: 'Details about R&B.',
    decade: '1990s',
  }),
  createEntry('decades', '1980s-synthwave', {
    title: '1980s Synthwave',
    slug: '1980s-synthwave',
    release_date: new Date('1984-06-01'),
    artist: 'Synth Masters',
    ranking: 12,
    commentary_excerpt: 'Synths everywhere.',
    commentary: 'Details about the 1980s.',
    decade: '1980s',
  }),
];

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
  }),
];

const cloneEntries = <T extends { data: Record<string, unknown> }>(entries: readonly T[]): T[] =>
  entries.map((entry) => ({ ...entry, data: { ...entry.data } })) as T[];

const getCollectionMock = vi.fn(async (collection: string) => {
  switch (collection) {
    case 'decades':
      return cloneEntries(mockDecades);
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
  getDecadeGroups,
  getYearGroups,
  getTopRankings,
  getBottomRankings,
  getRankingSlices,
  getDecadeSlugIndex,
  getYearSlugIndex,
  getRankingSlugIndex,
} from './content-utils';

beforeEach(() => {
  getCollectionMock.mockClear();
});

describe('content-utils grouping helpers', () => {
  it('groups decades by decade label and sorts by ranking', async () => {
    const groups = await getDecadeGroups();
    expect(Object.keys(groups).sort()).toEqual(['1980s', '1990s']);
    expect(groups['1990s'].map((entry) => entry.data.ranking)).toEqual([3, 5]);
  });

  it('groups years by numeric year and sorts entries', async () => {
    const groups = await getYearGroups();
    expect(Object.keys(groups).sort()).toEqual(['1999', '2000']);
    expect(groups[1999].map((entry) => entry.data.ranking)).toEqual([1, 7]);
  });
});

describe('ranking slice helpers', () => {
  it('returns the top rankings up to the specified limit', async () => {
    const results = await getTopRankings(2);
    expect(results.map((entry) => entry.slug)).toEqual(['smooth-number-one', 'genie-in-a-bottle']);
  });

  it('returns the bottom rankings with highest numbers first', async () => {
    const results = await getBottomRankings(2);
    expect(results.map((entry) => entry.slug)).toEqual(['obscure-hit-280', 'baby-one-more-time']);
  });

  it('returns both slices together', async () => {
    const slices = await getRankingSlices(1, 1);
    expect(slices.top.map((entry) => entry.slug)).toEqual(['smooth-number-one']);
    expect(slices.bottom.map((entry) => entry.slug)).toEqual(['obscure-hit-280']);
  });
});

describe('slug index helpers', () => {
  it('builds a decade slug index map', async () => {
    const index = await getDecadeSlugIndex();
    expect(index.get('1980s-synthwave')?.data.artist).toBe('Synth Masters');
  });

  it('builds a year slug index map', async () => {
    const index = await getYearSlugIndex();
    expect(index.has('1999-chart-toppers')).toBe(true);
  });

  it('builds a ranking slug index map', async () => {
    const index = await getRankingSlugIndex();
    expect(index.size).toBe(mockRankings.length);
  });
});
