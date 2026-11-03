import { defineConfig } from '@playwright/test';
import pwaConfig from './playwright.pwa.config.js';

const previewURL = 'http://127.0.0.1:4174';

export default defineConfig({
    ...pwaConfig,
    testMatch: 'product-analytics.spec.js',
    use: { ...pwaConfig.use, baseURL: 'https://app.tasktime.pro', serviceWorkers: 'block' },
    webServer: {
        command: 'npm run preview -- --host 0.0.0.0 --port 4174',
        url: previewURL,
        reuseExistingServer: false,
    },
});
