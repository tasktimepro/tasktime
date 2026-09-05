import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    APP_SPA_REDIRECTS,
    ArtifactCollisionError,
    assembleBuildArtifacts,
    validateBuildArtifacts,
} from './build-artifacts.mjs';

async function writeFixture(root, relativePath, content = relativePath) {
    const targetPath = path.join(root, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content);
}

async function createFixture() {
    const root = await mkdtemp(path.join(tmpdir(), 'tasktime-build-artifacts-'));
    const paths = {
        root,
        rawApp: path.join(root, 'raw-app'),
        rawSite: path.join(root, 'raw-site'),
        public: path.join(root, 'public'),
        app: path.join(root, 'dist-app'),
        site: path.join(root, 'dist-site'),
        combined: path.join(root, 'dist'),
    };
    const canonicalPage = (canonicalPath) => `<!doctype html><html><head><link rel="canonical" href="https://tasktime.pro${canonicalPath}"><link rel="stylesheet" href="/_astro/site.css"><link rel="icon" href="/favicon.svg"></head><body></body></html>`;

    await Promise.all([
        writeFixture(paths.rawApp, 'index.html', '<html><body>app-root</body></html>'),
        writeFixture(paths.rawApp, 'manifest.json', '{}'),
        writeFixture(paths.rawApp, 'sw.js', 'service-worker'),
        writeFixture(paths.rawApp, '_redirects', '/.well-known/example /example 200\n'),
        writeFixture(paths.rawApp, 'assets/app.js', 'app-js'),
        writeFixture(paths.rawApp, '.well-known/mcp-registry-auth', 'auth-discovery'),
        writeFixture(paths.rawApp, '.well-known/tasktime-agent.json', '{}'),
        writeFixture(paths.rawApp, 'robots.txt', 'robots'),
        writeFixture(paths.rawApp, 'favicon-16x16.png', 'shared-16'),
        writeFixture(paths.rawApp, 'favicon-32x32.png', 'shared-32'),
        writeFixture(paths.rawApp, 'favicon-96x96.png', 'shared-96'),
        writeFixture(paths.rawApp, 'favicon.ico', 'shared-ico'),
        writeFixture(paths.rawApp, 'favicon.svg', 'shared-icon'),
        writeFixture(paths.rawApp, 'x.svg', 'shared-x'),
        writeFixture(paths.rawApp, 'icons/web-app-manifest-512x512.png', 'shared-png'),
        writeFixture(paths.rawSite, 'index.html', canonicalPage('/')),
        writeFixture(paths.rawSite, 'product/index.html', canonicalPage('/product/')),
        writeFixture(paths.rawSite, 'pricing/index.html', canonicalPage('/pricing/')),
        writeFixture(paths.rawSite, 'blog/index.html', canonicalPage('/blog/')),
        writeFixture(paths.rawSite, 'privacy/index.html', canonicalPage('/privacy/')),
        writeFixture(paths.rawSite, 'terms/index.html', canonicalPage('/terms/')),
        writeFixture(paths.rawSite, 'contact/index.html', canonicalPage('/contact/')),
        writeFixture(paths.rawSite, 'agents/index.html', canonicalPage('/agents/')),
        writeFixture(paths.rawSite, '_astro/site.css', 'site-css'),
        writeFixture(paths.rawSite, 'sitemap.xml', '<urlset />'),
        writeFixture(paths.rawSite, 'llms.txt', 'llms'),
        writeFixture(paths.rawSite, 'x.svg', 'shared-x'),
        writeFixture(paths.public, '.well-known/mcp-registry-auth', 'auth-discovery'),
        writeFixture(paths.public, '.well-known/tasktime-agent.json', '{}'),
        writeFixture(paths.public, 'robots.txt', 'robots'),
        writeFixture(paths.public, 'favicon-16x16.png', 'shared-16'),
        writeFixture(paths.public, 'favicon-32x32.png', 'shared-32'),
        writeFixture(paths.public, 'favicon-96x96.png', 'shared-96'),
        writeFixture(paths.public, 'favicon.ico', 'shared-ico'),
        writeFixture(paths.public, 'favicon.svg', 'shared-icon'),
        writeFixture(paths.public, 'icons/web-app-manifest-512x512.png', 'shared-png'),
    ]);

    return paths;
}

test('assembles isolated app/site artifacts and preserves the combined app root', async (t) => {
    const paths = await createFixture();

    t.after(() => rm(paths.root, { recursive: true, force: true }));

    await assembleBuildArtifacts({
        appBuildDir: paths.rawApp,
        siteBuildDir: paths.rawSite,
        publicDir: paths.public,
        appOutputDir: paths.app,
        siteOutputDir: paths.site,
        combinedOutputDir: paths.combined,
    });

    assert.equal(await readFile(path.join(paths.app, 'index.html'), 'utf8'), '<html><body>app-root</body></html>');
    assert.equal(await readFile(path.join(paths.app, '_redirects'), 'utf8'), APP_SPA_REDIRECTS);
    await assert.rejects(readFile(path.join(paths.app, 'robots.txt')));
    await assert.rejects(readFile(path.join(paths.app, '.well-known/tasktime-agent.json')));
    await assert.rejects(readFile(path.join(paths.app, 'product/index.html')));

    assert.match(await readFile(path.join(paths.site, 'index.html'), 'utf8'), /tasktime\.pro\//);
    assert.equal(await readFile(path.join(paths.site, 'tasktime-agent.json'), 'utf8'), '{}');
    assert.equal(await readFile(path.join(paths.site, 'mcp-registry-auth'), 'utf8'), 'auth-discovery');
    await assert.rejects(readFile(path.join(paths.site, 'manifest.json')));
    await assert.rejects(readFile(path.join(paths.site, 'sw.js')));
    await assert.rejects(readFile(path.join(paths.site, '_redirects')));

    assert.equal(await readFile(path.join(paths.combined, 'index.html'), 'utf8'), '<html><body>app-root</body></html>');
    assert.equal(await readFile(path.join(paths.combined, '_redirects'), 'utf8'), '/.well-known/example /example 200\n');
    assert.match(await readFile(path.join(paths.combined, 'product/index.html'), 'utf8'), /tasktime\.pro\/product\//);

    await validateBuildArtifacts({
        appOutputDir: paths.app,
        siteOutputDir: paths.site,
        combinedOutputDir: paths.combined,
    });
});

test('rejects unequal app/site collisions instead of overwriting either artifact', async (t) => {
    const paths = await createFixture();

    t.after(() => rm(paths.root, { recursive: true, force: true }));
    await writeFixture(paths.rawSite, 'x.svg', 'different-site-x');

    await assert.rejects(
        assembleBuildArtifacts({
            appBuildDir: paths.rawApp,
            siteBuildDir: paths.rawSite,
            publicDir: paths.public,
            appOutputDir: paths.app,
            siteOutputDir: paths.site,
            combinedOutputDir: paths.combined,
        }),
        ArtifactCollisionError,
    );
});

test('reports a missing required output before an artifact can be shipped', async (t) => {
    const paths = await createFixture();

    t.after(() => rm(paths.root, { recursive: true, force: true }));

    await assembleBuildArtifacts({
        appBuildDir: paths.rawApp,
        siteBuildDir: paths.rawSite,
        publicDir: paths.public,
        appOutputDir: paths.app,
        siteOutputDir: paths.site,
        combinedOutputDir: paths.combined,
    });
    await rm(path.join(paths.site, 'sitemap.xml'));

    await assert.rejects(
        validateBuildArtifacts({
            appOutputDir: paths.app,
            siteOutputDir: paths.site,
            combinedOutputDir: paths.combined,
        }),
        /missing required site output: sitemap\.xml/,
    );
});

test('rejects a wrong product canonical URL', async (t) => {
    const paths = await createFixture();

    t.after(() => rm(paths.root, { recursive: true, force: true }));

    await assembleBuildArtifacts({
        appBuildDir: paths.rawApp,
        siteBuildDir: paths.rawSite,
        publicDir: paths.public,
        appOutputDir: paths.app,
        siteOutputDir: paths.site,
        combinedOutputDir: paths.combined,
    });
    await writeFixture(
        paths.site,
        'product/index.html',
        '<link rel="canonical" href="https://app.tasktime.pro/product/">',
    );

    await assert.rejects(
        validateBuildArtifacts({
            appOutputDir: paths.app,
            siteOutputDir: paths.site,
            combinedOutputDir: paths.combined,
        }),
        /product canonical URL/,
    );
});

test('rejects missing root-relative assets referenced by site HTML', async (t) => {
    const paths = await createFixture();

    t.after(() => rm(paths.root, { recursive: true, force: true }));

    await assembleBuildArtifacts({
        appBuildDir: paths.rawApp,
        siteBuildDir: paths.rawSite,
        publicDir: paths.public,
        appOutputDir: paths.app,
        siteOutputDir: paths.site,
        combinedOutputDir: paths.combined,
    });
    await rm(path.join(paths.site, '_astro/site.css'));

    await assert.rejects(
        validateBuildArtifacts({
            appOutputDir: paths.app,
            siteOutputDir: paths.site,
            combinedOutputDir: paths.combined,
        }),
        /missing referenced site asset: \/_astro\/site\.css/,
    );
});
