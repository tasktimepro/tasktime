import { defineCollection, z } from 'astro:content';
import {
    BLOG_CATEGORY_VALUES,
    DEFAULT_SOCIAL_IMAGE,
    DEFAULT_SOCIAL_IMAGE_ALT,
} from './config/site.js';

const blogCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        publishedAt: z.coerce.date(),
        excerpt: z.string(),
        category: z.enum(BLOG_CATEGORY_VALUES),
        tags: z.array(z.string()).default([]),
        keywords: z.array(z.string()).default([]),
        draft: z.boolean().default(false),
        featured: z.boolean().default(false),
        updatedAt: z.coerce.date().optional(),
        coverImage: z.string().default(DEFAULT_SOCIAL_IMAGE),
        coverImageAlt: z.string().default(DEFAULT_SOCIAL_IMAGE_ALT),
        ogImage: z.string().default(DEFAULT_SOCIAL_IMAGE),
        ogImageAlt: z.string().default(DEFAULT_SOCIAL_IMAGE_ALT),
        socialTitle: z.string().optional(),
        socialDescription: z.string().optional(),
        canonicalUrl: z.string().optional(),
    }),
});

export const collections = {
    blog: blogCollection,
};