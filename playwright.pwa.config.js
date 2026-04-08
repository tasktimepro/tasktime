import fs from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_PWA_BASE_URL || 'http://127.0.0.1:4173';

const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || ['/usr/bin/chromium-browser', '/usr/bin/chromium'].find((candidate) => fs.existsSync(candidate));

const launchOptions = {
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}),
};

export default defineConfig({
    testDir: './e2e',
    testMatch: 'pwa.cached-boot.spec.js',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'off',
    },
    webServer: {
        command: 'npm run preview -- --host 0.0.0.0 --port 4173',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions,
            },
        },
    ],
});