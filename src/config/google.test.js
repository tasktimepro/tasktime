import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('isMetricsOriginAllowed', () => {
    it.each(['tasktime.pro', 'app.tasktime.pro'])('allows exact cutover-window app hostname %s', async (hostname) => {
        vi.stubGlobal('window', { location: { hostname } });

        const { isMetricsOriginAllowed } = await import('./google.ts');

        expect(isMetricsOriginAllowed()).toBe(true);
    });

    it.each([
        'localhost',
        '127.0.0.1',
        'tasktime.pages.dev',
        'preview.tasktime.pro',
    ])('blocks metrics for %s', async (hostname) => {
        vi.stubGlobal('window', {
            location: {
                hostname,
            },
        });

        const { isMetricsOriginAllowed } = await import('./google.ts');

        expect(isMetricsOriginAllowed()).toBe(false);
    });
});
