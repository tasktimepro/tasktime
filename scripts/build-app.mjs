import { stat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function validateAppArtifact(directory) {
    for (const file of ['index.html', 'sw.js', 'manifest.json', '_redirects', 'robots.txt']) {
        if (!(await stat(path.join(directory, file))).isFile()) throw new Error(`Missing app output: ${file}`);
    }
    const files = await readdir(directory);
    const siteOnly = ['_astro', '.well-known', 'blog', 'product', 'pricing', 'agents', 'privacy', 'terms', 'contact', 'llms.txt', 'sitemap.xml', 'mcp-registry-auth', 'tasktime-agent.json'];
    if (siteOnly.some(file => files.includes(file))) throw new Error('App artifact contains site content');
    const redirects = await readFile(path.join(directory, '_redirects'), 'utf8');
    if (!redirects.endsWith('/* /index.html 200\n')) throw new Error('App SPA fallback is missing');
    const html = await readFile(path.join(directory, 'index.html'), 'utf8');
    if (!/<meta name="robots" content="noindex,nofollow"\s*\/?>/.test(html)) {
        throw new Error('App artifact must disable search indexing');
    }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    const { build } = await import('vite');
    await build();
    await validateAppArtifact('dist-app');
}
