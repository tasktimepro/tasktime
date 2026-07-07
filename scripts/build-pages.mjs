import { spawnSync } from 'node:child_process';
import { cp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const appDistDir = path.join(repoRoot, 'dist');
const blogDir = path.join(repoRoot, 'blog');
const blogDistDir = path.join(blogDir, 'dist');
const wellKnownAliases = [
    ['.well-known/mcp-registry-auth', 'mcp-registry-auth'],
    ['.well-known/tasktime-agent.json', 'tasktime-agent.json'],
];

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

async function copyWellKnownAliases() {
    for (const [source, alias] of wellKnownAliases) {
        const sourcePath = path.join(appDistDir, source);

        if (!(await pathExists(sourcePath))) {
            continue;
        }

        await cp(sourcePath, path.join(appDistDir, alias), { force: true });
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
    await copyWellKnownAliases();
}

await main();
