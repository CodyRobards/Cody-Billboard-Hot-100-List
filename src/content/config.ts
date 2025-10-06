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
  slug: z.string(),
  release_date: z.coerce.date(),
  artist: z.string(),
  ranking: z.number().int().min(1),
  commentary_excerpt: z.string(),
  commentary: z.string(),
  cover_image: coverImageSchema,
  tags: z.array(z.string()).optional(),
});

const decades = defineCollection({
  type: 'content',
  schema: baseTrackSchema.extend({
    decade: z.string(),
  }),
});

const years = defineCollection({
  type: 'content',
  schema: baseTrackSchema.extend({
    year: z.number().int(),
  }),
});

const rankings = defineCollection({
  type: 'content',
  schema: baseTrackSchema.extend({
    chart_week: z.coerce.date(),
  }),
});

const meta = defineCollection({
  type: 'content',
  schema: baseTrackSchema.extend({
    category: z.string(),
  }),
});

export const collections = {
  decades,
  years,
  rankings,
  meta,
};
