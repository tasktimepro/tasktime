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
        include: ['src/**/*.{test,spec}.{js,jsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/utils/**', 'src/hooks/**'],
            thresholds: {
                statements: 75,
                branches: 70,
                functions: 75,
                lines: 75
            }
        },
    },
})
