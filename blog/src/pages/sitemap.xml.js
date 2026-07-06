import { getCollection } from 'astro:content';
import { SITE_URL, toCanonicalUrl } from '../config/site.js';

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
    const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
        (left, right) => right.data.publishedAt.valueOf() - left.data.publishedAt.valueOf()
    );
    const latestPostDate = posts.reduce((latest, post) => {
        const postDate = post.data.updatedAt ?? post.data.publishedAt;

        return postDate > latest ? postDate : latest;
    }, new Date('2026-04-05'));
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
