import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_URL } from '../../config/site.js';

export async function GET() {
    const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
        (left, right) => right.data.publishedAt.valueOf() - left.data.publishedAt.valueOf()
    );

    return rss({
        title: 'TaskTime Blog',
        description: 'Privacy-first invoicing, task tracking, expense tracking, and local-first freelancer workflows.',
        site: SITE_URL,
        items: posts.map((post) => ({
            title: post.data.title,
            description: post.data.socialDescription ?? post.data.description,
            pubDate: post.data.publishedAt,
            link: `/blog/${post.slug}`,
        })),
    });
}