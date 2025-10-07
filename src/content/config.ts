import { defineCollection, z } from 'astro:content';

const coverImageSchema = z
  .object({
    src: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt: z.string(),
    format: z.enum(['jpg', 'png', 'webp', 'avif']).optional(),
  })
  .optional();

const baseTrackSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
  release_date: z.coerce.date(),
  artist: z.string(),
  ranking: z.number().int().min(1),
  commentary_excerpt: z.string(),
  commentary: z.string(),
  cover_image: coverImageSchema,
  tags: z.array(z.string()).optional(),
});

const numberOneEntrySchema = z.object({
  title: z.string(),
  artist: z.string(),
  notes: z.array(z.string()).default([]),
});

const overallRankingEntrySchema = z.object({
  position: z.number().int().min(1),
  title: z.string(),
  artist: z.string(),
  spotifyTrackId: z.string().optional(),
});

const rankingEntrySchema = z.object({
  position: z.number().int().min(1),
  title: z.string(),
  artist: z.string(),
  year: z.string().optional(),
  genres: z.array(z.string()).optional(),
  commentary: z.string(),
});

const years = defineCollection({
  type: 'content',
  schema: baseTrackSchema.extend({
    year: z.number().int(),
    numberOnes: z.array(numberOneEntrySchema).default([]),
    overallRanking: z.array(overallRankingEntrySchema).default([]),
    yearSummary: z.string().optional(),
  }),
});

const rankings = defineCollection({
  type: 'content',
  schema: baseTrackSchema.extend({
    chart_week: z.coerce.date(),
    subset: z.enum(['top-220', 'bottom-60']).optional(),
    entries: z.array(rankingEntrySchema).default([]),
  }),
});

const meta = defineCollection({
  type: 'content',
  schema: baseTrackSchema.extend({
    category: z.string(),
  }),
});

export const collections = {
  years,
  rankings,
  meta,
};
