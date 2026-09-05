import { spawnSync } from 'node:child_process';
import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assembleBuildArtifacts, validateBuildArtifacts } from './build-artifacts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const blogDir = path.join(repoRoot, 'blog');
const blogDistDir = path.join(blogDir, 'dist');
const temporaryBuildDir = path.join(repoRoot, '.tasktime-build');
const appBuildDir = path.join(temporaryBuildDir, 'app');
const appOutputDir = path.join(repoRoot, 'dist-app');
const siteOutputDir = path.join(repoRoot, 'dist-site');
const combinedOutputDir = path.join(repoRoot, 'dist');
const publicDir = path.join(repoRoot, 'public');

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        stdio: 'inherit',
        ...options,
    });

    if (result.status !== 0) {
        throw new Error(`${command} failed with exit code ${result.status ?? 1}`);
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

export async function main() {
    const blogAstroBinary = path.join(blogDir, 'node_modules', 'astro', 'package.json');

    if (!(await pathExists(blogAstroBinary))) {
        run('npm', ['ci'], { cwd: blogDir });
    }

    await rm(temporaryBuildDir, { force: true, recursive: true });

    try {
        run('npm', [
            'run',
            'build:app',
            '--',
            '--outDir',
            path.relative(repoRoot, appBuildDir),
        ]);
        run('npm', ['run', 'build'], { cwd: blogDir });

        await assembleBuildArtifacts({
            appBuildDir,
            siteBuildDir: blogDistDir,
            publicDir,
            appOutputDir,
            siteOutputDir,
            combinedOutputDir,
        });
        await validateBuildArtifacts({
            appOutputDir,
            siteOutputDir,
            combinedOutputDir,
        });
    } finally {
        await rm(temporaryBuildDir, { force: true, recursive: true });
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    await main().catch((error) => {
        console.error(error instanceof Error ? error.message : 'Build failed');
        process.exitCode = 1;
    });
}
