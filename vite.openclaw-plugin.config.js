import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    publicDir: false,
    resolve: {
        alias: {
            '@': path.resolve(rootDir, 'src'),
        },
    },
    build: {
        ssr: path.resolve(rootDir, 'integrations/openclaw/tasktime/src/index.js'),
        outDir: path.resolve(rootDir, 'integrations/openclaw/tasktime/dist'),
        emptyOutDir: true,
        rollupOptions: {
            output: {
                entryFileNames: 'index.js',
            },
        },
    },
});
