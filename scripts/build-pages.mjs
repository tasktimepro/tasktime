import { spawnSync } from 'node:child_process';
import { cp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const appDistDir = path.join(repoRoot, 'dist');
const blogDir = path.join(repoRoot, 'blog');
const blogDistDir = path.join(blogDir, 'dist');
const mergedBlogDir = path.join(appDistDir, 'blog');
const siteUrl = 'https://tasktime.pro';

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        stdio: 'inherit',
        ...options,
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

async function pathExists(targetPath) {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function collectBlogHtmlFiles(directory, results = []) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            await collectBlogHtmlFiles(entryPath, results);
            continue;
        }

        if (entry.isFile() && entry.name === 'index.html') {
            results.push(entryPath);
        }
    }

    return results;
}

function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function formatSitemapUrl({ loc, lastmod, changefreq, priority }) {
    return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        '  </url>',
    ].join('\n');
}

async function writeMergedSitemap() {
    const buildDate = toIsoDate(new Date());
    const sitemapEntries = [
        {
            loc: `${siteUrl}/`,
            lastmod: buildDate,
            changefreq: 'weekly',
            priority: '1.0',
        },
        {
            loc: `${siteUrl}/privacy`,
            lastmod: buildDate,
            changefreq: 'monthly',
            priority: '0.4',
        },
        {
            loc: `${siteUrl}/contact`,
            lastmod: buildDate,
            changefreq: 'monthly',
            priority: '0.5',
        },
        {
            loc: `${siteUrl}/terms`,
            lastmod: buildDate,
            changefreq: 'monthly',
            priority: '0.4',
        },
        {
            loc: `${siteUrl}/blog`,
            lastmod: buildDate,
            changefreq: 'weekly',
            priority: '0.8',
        },
    ];

    const blogHtmlFiles = await collectBlogHtmlFiles(mergedBlogDir);

    for (const filePath of blogHtmlFiles) {
        const relativePath = path.relative(mergedBlogDir, path.dirname(filePath)).split(path.sep).join('/');

        if (!relativePath || relativePath === '.') {
            continue;
        }

        const fileStats = await stat(filePath);

        sitemapEntries.push({
            loc: `${siteUrl}/blog/${relativePath}`,
            lastmod: toIsoDate(fileStats.mtime),
            changefreq: 'monthly',
            priority: '0.7',
        });
    }

    const sitemapXml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...sitemapEntries.map(formatSitemapUrl),
        '</urlset>',
        '',
    ].join('\n');

    await writeFile(path.join(appDistDir, 'sitemap.xml'), sitemapXml, 'utf8');
}

async function mergeAstroOutput() {
    const entries = await readdir(blogDistDir, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(blogDistDir, entry.name);
        const destinationPath = path.join(appDistDir, entry.name);

        if (entry.name === 'index.html') {
            continue;
        }

        await rm(destinationPath, { force: true, recursive: true });
        await cp(sourcePath, destinationPath, { recursive: true });
    }
}

async function main() {
    const blogAstroBinary = path.join(blogDir, 'node_modules', 'astro', 'package.json');

    if (!(await pathExists(blogAstroBinary))) {
        run('npm', ['ci'], { cwd: blogDir });
    }

    run('npm', ['run', 'build:app']);
    run('npm', ['run', 'build'], { cwd: blogDir });

    await mergeAstroOutput();
    await writeMergedSitemap();
}

await main();