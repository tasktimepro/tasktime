import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const APP_SPA_REDIRECTS = '/* /index.html 200\n';

const APP_EXCLUDED_PATHS = new Set([
    '.well-known',
    '_redirects',
    'mcp-registry-auth',
    'robots.txt',
    'tasktime-agent.json',
]);
const SITE_PUBLIC_PATHS = [
    '.well-known',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon-96x96.png',
    'favicon.ico',
    'favicon.svg',
    'icons',
    'robots.txt',
];
const WELL_KNOWN_ALIASES = [
    ['.well-known/mcp-registry-auth', 'mcp-registry-auth'],
    ['.well-known/tasktime-agent.json', 'tasktime-agent.json'],
];
const REQUIRED_APP_PATHS = [
    '_redirects',
    'index.html',
    'manifest.json',
    'sw.js',
];
const REQUIRED_SITE_PATHS = [
    '.well-known/mcp-registry-auth',
    '.well-known/tasktime-agent.json',
    'agents/index.html',
    'blog/index.html',
    'contact/index.html',
    'favicon.svg',
    'llms.txt',
    'mcp-registry-auth',
    'pricing/index.html',
    'privacy/index.html',
    'product/index.html',
    'robots.txt',
    'sitemap.xml',
    'tasktime-agent.json',
    'terms/index.html',
];
const APP_ONLY_PATHS = ['_redirects', 'manifest.json', 'sw.js'];
const SITE_ONLY_PATHS = [
    '.well-known',
    'agents',
    'blog',
    'contact',
    'llms.txt',
    'mcp-registry-auth',
    'pricing',
    'privacy',
    'product',
    'robots.txt',
    'sitemap.xml',
    'tasktime-agent.json',
    'terms',
];

export class ArtifactCollisionError extends Error {
    constructor(relativePath) {
        super(`build artifact collision has different content: ${relativePath}`);
        this.name = 'ArtifactCollisionError';
    }
}

async function pathExists(targetPath) {
    try {
        await lstat(targetPath);
        return true;
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return false;
        }

        throw error;
    }
}

async function copyItemWithCollisionCheck(sourcePath, destinationPath, relativePath, shouldSkip) {
    if (shouldSkip(relativePath)) {
        return;
    }

    const sourceStat = await lstat(sourcePath);

    if (sourceStat.isDirectory()) {
        if (await pathExists(destinationPath)) {
            const destinationStat = await lstat(destinationPath);

            if (!destinationStat.isDirectory()) {
                throw new ArtifactCollisionError(relativePath);
            }
        } else {
            await mkdir(destinationPath, { recursive: true });
        }

        const entries = await readdir(sourcePath, { withFileTypes: true });

        entries.sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            const childRelativePath = relativePath
                ? path.posix.join(relativePath, entry.name)
                : entry.name;

            await copyItemWithCollisionCheck(
                path.join(sourcePath, entry.name),
                path.join(destinationPath, entry.name),
                childRelativePath,
                shouldSkip,
            );
        }

        return;
    }

    if (!sourceStat.isFile()) {
        throw new Error(`unsupported build artifact entry: ${relativePath}`);
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });

    if (await pathExists(destinationPath)) {
        const destinationStat = await lstat(destinationPath);

        if (!destinationStat.isFile()) {
            throw new ArtifactCollisionError(relativePath);
        }

        const [sourceContent, destinationContent] = await Promise.all([
            readFile(sourcePath),
            readFile(destinationPath),
        ]);

        if (!sourceContent.equals(destinationContent)) {
            throw new ArtifactCollisionError(relativePath);
        }

        return;
    }

    await cp(sourcePath, destinationPath);
}

async function copyTreeWithCollisionCheck(sourceRoot, destinationRoot, shouldSkip = () => false) {
    if (!(await pathExists(sourceRoot))) {
        throw new Error(`missing build source: ${path.basename(sourceRoot)}`);
    }

    await mkdir(destinationRoot, { recursive: true });

    const entries = await readdir(sourceRoot, { withFileTypes: true });

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        await copyItemWithCollisionCheck(
            path.join(sourceRoot, entry.name),
            path.join(destinationRoot, entry.name),
            entry.name,
            shouldSkip,
        );
    }
}

async function copyPublicSitePaths(publicDir, siteOutputDir) {
    for (const relativePath of SITE_PUBLIC_PATHS) {
        const sourcePath = path.join(publicDir, relativePath);

        if (!(await pathExists(sourcePath))) {
            throw new Error(`missing required public-site source: ${relativePath}`);
        }

        await copyItemWithCollisionCheck(
            sourcePath,
            path.join(siteOutputDir, relativePath),
            relativePath,
            () => false,
        );
    }

    for (const [sourceRelativePath, aliasRelativePath] of WELL_KNOWN_ALIASES) {
        await copyItemWithCollisionCheck(
            path.join(siteOutputDir, sourceRelativePath),
            path.join(siteOutputDir, aliasRelativePath),
            aliasRelativePath,
            () => false,
        );
    }
}

export async function assembleBuildArtifacts({
    appBuildDir,
    siteBuildDir,
    publicDir,
    appOutputDir,
    siteOutputDir,
    combinedOutputDir,
}) {
    await Promise.all([
        rm(appOutputDir, { force: true, recursive: true }),
        rm(siteOutputDir, { force: true, recursive: true }),
        rm(combinedOutputDir, { force: true, recursive: true }),
    ]);

    await copyTreeWithCollisionCheck(
        appBuildDir,
        appOutputDir,
        (relativePath) => APP_EXCLUDED_PATHS.has(relativePath.split('/')[0]),
    );
    await writeFile(path.join(appOutputDir, '_redirects'), APP_SPA_REDIRECTS);

    await copyTreeWithCollisionCheck(siteBuildDir, siteOutputDir);
    await copyPublicSitePaths(publicDir, siteOutputDir);

    await copyTreeWithCollisionCheck(appBuildDir, combinedOutputDir);
    await copyTreeWithCollisionCheck(
        siteOutputDir,
        combinedOutputDir,
        (relativePath) => relativePath === 'index.html',
    );
}

async function assertRequiredPaths(root, artifactName, requiredPaths) {
    for (const relativePath of requiredPaths) {
        if (!(await pathExists(path.join(root, relativePath)))) {
            throw new Error(`missing required ${artifactName} output: ${relativePath}`);
        }
    }
}

async function assertAbsentPaths(root, artifactName, forbiddenPaths) {
    for (const relativePath of forbiddenPaths) {
        if (await pathExists(path.join(root, relativePath))) {
            throw new Error(`${artifactName} artifact contains forbidden output: ${relativePath}`);
        }
    }
}

async function findHtmlFiles(root, relativeDirectory = '') {
    const directoryPath = path.join(root, relativeDirectory);
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const results = [];

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        const relativePath = relativeDirectory
            ? path.posix.join(relativeDirectory, entry.name)
            : entry.name;

        if (entry.isDirectory()) {
            results.push(...await findHtmlFiles(root, relativePath));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            results.push(relativePath);
        }
    }

    return results;
}

async function assertSiteAssetsExist(siteOutputDir) {
    const htmlFiles = await findHtmlFiles(siteOutputDir);
    const assetExtensionPattern = /\.(?:css|gif|ico|jpe?g|js|png|svg|webp|woff2?)$/i;

    for (const htmlFile of htmlFiles) {
        const html = await readFile(path.join(siteOutputDir, htmlFile), 'utf8');
        const references = html.matchAll(/(?:href|src)=["'](\/[^"']+)["']/gi);

        for (const match of references) {
            const pathname = new URL(match[1], 'https://tasktime.pro').pathname;

            if (!assetExtensionPattern.test(pathname)) {
                continue;
            }

            const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');

            if (!(await pathExists(path.join(siteOutputDir, relativePath)))) {
                throw new Error(`missing referenced site asset: ${pathname}`);
            }
        }
    }
}

export async function validateBuildArtifacts({
    appOutputDir,
    siteOutputDir,
    combinedOutputDir,
}) {
    await assertRequiredPaths(appOutputDir, 'app', REQUIRED_APP_PATHS);
    await assertRequiredPaths(siteOutputDir, 'site', REQUIRED_SITE_PATHS);
    await assertRequiredPaths(combinedOutputDir, 'combined', [
        ...REQUIRED_APP_PATHS,
        ...REQUIRED_SITE_PATHS,
    ]);
    await assertAbsentPaths(appOutputDir, 'app', SITE_ONLY_PATHS);
    await assertAbsentPaths(siteOutputDir, 'site', APP_ONLY_PATHS);

    const appRedirects = await readFile(path.join(appOutputDir, '_redirects'), 'utf8');

    if (appRedirects !== APP_SPA_REDIRECTS) {
        throw new Error('app artifact SPA fallback is not exact');
    }

    const productHtml = await readFile(path.join(siteOutputDir, 'product/index.html'), 'utf8');
    const productCanonical = /<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/tasktime\.pro\/product\/["'])[^>]*>/i;

    if (!productCanonical.test(productHtml)) {
        throw new Error('site product canonical URL is not exact');
    }

    await assertSiteAssetsExist(siteOutputDir);
}
