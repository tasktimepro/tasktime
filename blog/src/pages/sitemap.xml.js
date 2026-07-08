import { SITE_URL, toCanonicalUrl } from '../config/site.js';
import {
    BLOG_PAGE_SIZE,
    getBlogPageCount,
    getBlogPageHref,
    getBlogPostsForPage,
    getPublishedBlogPosts,
} from '../lib/blog.js';

const STATIC_ENTRIES = [
    {
        pathname: '/',
        lastmod: new Date(),
        changefreq: 'weekly',
        priority: '1.0',
    },
    {
        pathname: '/privacy/',
        lastmod: '2026-05-31',
        changefreq: 'monthly',
        priority: '0.4',
    },
    {
        pathname: '/contact/',
        lastmod: '2026-04-10',
        changefreq: 'monthly',
        priority: '0.5',
    },
    {
        pathname: '/terms/',
        lastmod: '2026-04-14',
        changefreq: 'monthly',
        priority: '0.4',
    },
    {
        pathname: '/agents/',
        lastmod: '2026-07-06',
        changefreq: 'monthly',
        priority: '0.7',
    },
    {
        pathname: '/agents/quickstart/',
        lastmod: '2026-07-06',
        changefreq: 'monthly',
        priority: '0.6',
    },
    {
        pathname: '/agents/security/',
        lastmod: '2026-07-06',
        changefreq: 'monthly',
        priority: '0.6',
    },
    {
        pathname: '/agents/tools/',
        lastmod: '2026-07-06',
        changefreq: 'weekly',
        priority: '0.6',
    },
    {
        pathname: '/agents/openclaw/',
        lastmod: '2026-07-06',
        changefreq: 'monthly',
        priority: '0.5',
    },
    {
        pathname: '/agents/debugging/',
        lastmod: '2026-07-06',
        changefreq: 'monthly',
        priority: '0.5',
    },
];

function toIsoDate(value) {
    return new Date(value).toISOString().slice(0, 10);
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatSitemapEntry({ loc, lastmod, changefreq, priority }) {
    return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${toIsoDate(lastmod)}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        '  </url>',
    ].join('\n');
}

export async function GET() {
    const posts = await getPublishedBlogPosts();
    const totalPages = getBlogPageCount(posts, BLOG_PAGE_SIZE);
    const latestPostDate = posts.reduce((latest, post) => {
        const postDate = post.data.updatedAt ?? post.data.publishedAt;

        return postDate > latest ? postDate : latest;
    }, new Date('2026-04-05'));
    const paginatedBlogEntries = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => {
        const currentPage = index + 2;
        const currentPosts = getBlogPostsForPage(posts, currentPage, BLOG_PAGE_SIZE);
        const pageLastModified = currentPosts.reduce((latest, post) => {
            const postDate = post.data.updatedAt ?? post.data.publishedAt;

            return postDate > latest ? postDate : latest;
        }, currentPosts[0]?.data.updatedAt ?? currentPosts[0]?.data.publishedAt ?? latestPostDate);

        return {
            loc: toCanonicalUrl(getBlogPageHref(currentPage), SITE_URL),
            lastmod: pageLastModified,
            changefreq: 'weekly',
            priority: '0.7',
        };
    });
    const sitemapEntries = [
        ...STATIC_ENTRIES.map((entry) => ({
            loc: toCanonicalUrl(entry.pathname, SITE_URL),
            lastmod: entry.lastmod,
            changefreq: entry.changefreq,
            priority: entry.priority,
        })),
        {
            loc: toCanonicalUrl('/blog/', SITE_URL),
            lastmod: latestPostDate,
            changefreq: 'weekly',
            priority: '0.8',
        },
        ...paginatedBlogEntries,
        ...posts.map((post) => ({
            loc: toCanonicalUrl(`/blog/${post.slug}/`, SITE_URL),
            lastmod: post.data.updatedAt ?? post.data.publishedAt,
            changefreq: 'monthly',
            priority: '0.7',
        })),
    ];
    const sitemapXml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...sitemapEntries.map(formatSitemapEntry),
        '</urlset>',
        '',
    ].join('\n');

    return new Response(sitemapXml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
        },
    });
}
