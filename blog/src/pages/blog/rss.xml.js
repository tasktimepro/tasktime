import rss from '@astrojs/rss';
import { SITE_URL } from '../../config/site.js';
import { getPublishedBlogPosts } from '../../lib/blog.js';

export async function GET() {
    const posts = await getPublishedBlogPosts();

    return rss({
        title: 'TaskTime Pro Blog',
        description: 'Privacy-first invoicing, task tracking, expense tracking, and local-first freelancer workflows.',
        site: SITE_URL,
        items: posts.map((post) => ({
            title: post.data.title,
            description: post.data.socialDescription ?? post.data.description,
            pubDate: post.data.publishedAt,
            link: `/blog/${post.slug}/`,
        })),
    });
}
