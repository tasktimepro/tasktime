import { defineConfig } from 'vite';
import path from 'node:path';

// Deliberately excludes the app/PWA plugins, provider lifecycle and environment.
export default defineConfig({
    publicDir: false,
    resolve: { alias: { '@': path.resolve('src') } },
    build: {
        outDir: 'artifacts/site-recovery',
        emptyOutDir: true,
        sourcemap: false,
        lib: {
            entry: 'src/recovery/browser.ts',
            formats: ['es'],
            fileName: () => 'reader.js',
        },
    },
});
