import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/utils/**', 'src/hooks/**'],
            exclude: [
                'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
                'src/hooks/yjs/**',
            ],
            thresholds: {
                statements: 75,
                branches: 75,
                functions: 75,
                lines: 75,
                perFile: true
            }
        },
    },
})
