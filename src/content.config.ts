import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    category: z.string(),
    place: z.string().default(''),
    tags: z.array(z.string()).default([]),
    cover: z.string().default(''),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
