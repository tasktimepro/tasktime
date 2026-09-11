import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateAppArtifact } from './build-app.mjs';
import { publicPageRedirect } from '../src/config/publicRoutes.js';

test('requires a fresh high/critical dependency audit before the core release gate', async () => {
    const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(scripts['audit:security'], 'npm audit --audit-level=high');
    assert.ok(scripts.release.startsWith('npm run audit:security && '));
    const makefile = await readFile(new URL('../Makefile', import.meta.url), 'utf8');
    assert.match(makefile, /release-gate:\n\t\$\(APP_RUN\) npm run audit:security\n/);
});

test('redirects former public routes without capturing app or OAuth routes', () => {
    assert.equal(publicPageRedirect('/pricing/?from=app', 'https://tasktime.pro'), 'https://tasktime.pro/pricing/?from=app');
    assert.equal(publicPageRedirect('/blog/old-post/', 'https://tasktime.pro'), 'https://tasktime.pro/blog/old-post/');
    assert.equal(publicPageRedirect('/.well-known/tasktime-agent.json', 'https://tasktime.pro'), 'https://tasktime.pro/.well-known/tasktime-agent.json');
    for (const route of ['/', '/projects/a', '/auth/callback?code=x', '/auth/dropbox/callback', '/blogger', '/account?section=billing']) {
        assert.equal(publicPageRedirect(route, 'https://tasktime.pro'), null);
    }
});

test('validates an app alone and rejects accidentally included site content', async t => {
    const root = await mkdtemp(path.join(tmpdir(), 'tasktime-app-artifact-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const file of ['index.html', 'sw.js', 'manifest.json', '_redirects', 'robots.txt']) {
        const content = file === '_redirects' ? '/* /index.html 200\n'
            : file === 'index.html' ? '<meta name="robots" content="noindex,nofollow">' : file;
        await writeFile(path.join(root, file), content);
    }
    await validateAppArtifact(root);
    await writeFile(path.join(root, 'index.html'), '<meta name="robots" content="index,follow">');
    await assert.rejects(validateAppArtifact(root), /indexing/);
    await writeFile(path.join(root, 'index.html'), '<meta name="robots" content="noindex,nofollow">');
    await mkdir(path.join(root, 'blog'));
    await assert.rejects(validateAppArtifact(root), /site content/);
    await rm(path.join(root, 'blog'), { recursive: true });
    await rm(path.join(root, 'sw.js'));
    await assert.rejects(validateAppArtifact(root), /sw.js/);
});
