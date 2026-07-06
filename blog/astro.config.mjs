import { defineConfig } from 'astro/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
    site: 'https://tasktime.pro',
    output: 'static',
    trailingSlash: 'always',
    devToolbar: {
        enabled: false,
    },
    vite: {
        resolve: {
            alias: {
                '@': path.resolve(repoRoot, 'src'),
            },
        },
        server: {
            fs: {
                allow: [repoRoot],
            },
        },
    },
});
