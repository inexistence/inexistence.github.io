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

const exhibitions = defineCollection({
  loader: glob({ base: './src/content/exhibitions', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    cover: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

const photographs = defineCollection({
  loader: glob({ base: './src/content/photographs', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    exhibition: z.string(),
    order: z.number().int().positive(),
    image: z.string(),
    alt: z.string().min(1),
    dialogue: z.record(z.string(), z.string().min(1)),
    pairDialogue: z.array(z.object({
      islanders: z.tuple([z.string(), z.string()]),
      lines: z.array(z.object({
        speaker: z.string(),
        text: z.string().min(1),
      })).min(2),
    })).default([]),
  }),
});

export const collections = { posts, exhibitions, photographs };
