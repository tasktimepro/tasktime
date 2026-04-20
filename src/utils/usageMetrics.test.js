import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
    getStoredUsageMetricsState,
    markMeaningfulActivity,
    maybeSendPendingUsageMetrics,
    resetUsageMetricsForTests,
    setUsageMetricsSessionId,
    startUsageMetrics,
} from './usageMetrics.ts';

const persistedValues = new Map();

const mockDb = {
    get: vi.fn(async (_storeName, key) => persistedValues.get(key)),
    put: vi.fn(async (_storeName, value, key) => {
        persistedValues.set(key, value);
    }),
};

vi.mock('idb', () => ({
    openDB: vi.fn(async () => mockDb),
}));

const flushAsyncWork = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe('usageMetrics', () => {
    let visibilityState = 'visible';
    let stopUsageMetrics = () => {};
    let isOnline = true;

    beforeEach(async () => {
        persistedValues.clear();
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-09T12:00:00Z'));

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => visibilityState,
        });

        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            get: () => isOnline,
        });

        global.fetch = vi.fn(async () => ({ ok: true }));
        stopUsageMetrics = () => {};
        isOnline = true;

        await resetUsageMetricsForTests();
    });

    afterEach(() => {
        stopUsageMetrics();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('creates a device install id only when meaningful activity is recorded', async () => {
        let state = await getStoredUsageMetricsState();
        expect(state.deviceInstallId).toBeNull();

        markMeaningfulActivity();
        await flushAsyncWork();

        state = await getStoredUsageMetricsState();

        expect(state.deviceInstallId).toMatch(/[0-9a-f-]{36}/i);
        expect(state.dayBuckets).toEqual([
            expect.objectContaining({
                day: '2026-04-09',
                meaningfulActivity: true,
                meaningfulActionCount: 1,
                actionCounts: {
                    generic_action: 1,
                },
                sessionCount: 0,
                syncEnabled: false,
                sent: false,
            }),
        ]);
    });

    it('increments meaningfulActionCount on each call to markMeaningfulActivity', async () => {
        markMeaningfulActivity();
        await flushAsyncWork();
        markMeaningfulActivity();
        await flushAsyncWork();
        markMeaningfulActivity();
        await flushAsyncWork();

        const state = await getStoredUsageMetricsState();
        expect(state.dayBuckets[0].meaningfulActionCount).toBe(3);
        expect(state.dayBuckets[0].actionCounts).toEqual({
            generic_action: 3,
        });
    });

    it('tracks specific action types separately from the total count', async () => {
        markMeaningfulActivity('project_create');
        await flushAsyncWork();
        markMeaningfulActivity('timer_start');
        await flushAsyncWork();
        markMeaningfulActivity('project_create');
        await flushAsyncWork();

        const state = await getStoredUsageMetricsState();

        expect(state.dayBuckets[0].meaningfulActionCount).toBe(3);
        expect(state.dayBuckets[0].actionCounts).toEqual({
            project_create: 2,
            timer_start: 1,
        });
    });

    it('records an initial session and sends one delayed daily batch', async () => {
        stopUsageMetrics = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        await flushAsyncWork();
        markMeaningfulActivity();
        await flushAsyncWork();
        await vi.advanceTimersByTimeAsync(30_000);

        expect(global.fetch).toHaveBeenCalledTimes(1);

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://sync.tasktime.pro/metrics/batch');
        expect(options.method).toBe('POST');

        const payload = JSON.parse(options.body);
        expect(payload).toEqual({
            schemaVersion: 1,
            appVersion: '1.2.3',
            deviceInstallId: expect.any(String),
            days: [
                {
                    day: '2026-04-09',
                    sessionCount: 1,
                    meaningfulActivity: true,
                    meaningfulActionCount: 1,
                    actionCounts: {
                        generic_action: 1,
                    },
                    syncEnabled: false,
                },
            ],
        });

        const state = await getStoredUsageMetricsState();
        expect(state.lastSendDay).toBe('2026-04-09');
        expect(state.dayBuckets[0].sent).toBe(true);
    });

    it('adds the session header only when sync is active for the pending bucket', async () => {
        stopUsageMetrics = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        await flushAsyncWork();
        setUsageMetricsSessionId('session-123');
        markMeaningfulActivity();
        await flushAsyncWork();
        await vi.advanceTimersByTimeAsync(30_000);

        expect(global.fetch).toHaveBeenCalledTimes(1);

        const [, options] = global.fetch.mock.calls[0];
        expect(options.headers).toEqual(expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-123',
        }));

        const payload = JSON.parse(options.body);
        expect(payload.days[0].syncEnabled).toBe(true);
    });

    it('does not send a second batch on the same day after one succeeds', async () => {
        stopUsageMetrics = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        await flushAsyncWork();
        markMeaningfulActivity();
        await flushAsyncWork();
        await vi.advanceTimersByTimeAsync(30_000);

        expect(global.fetch).toHaveBeenCalledTimes(1);

        markMeaningfulActivity();
        await flushAsyncWork();

        const didSend = await maybeSendPendingUsageMetrics('manual');
        expect(didSend).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('records a new session after the tab has been hidden for at least 30 minutes', async () => {
        stopUsageMetrics = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        await flushAsyncWork();

        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));

        await vi.advanceTimersByTimeAsync(31 * 60 * 1000);

        visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        await flushAsyncWork();

        const state = await getStoredUsageMetricsState();
        expect(state.dayBuckets).toEqual([
            expect.objectContaining({
                day: '2026-04-09',
                sessionCount: 2,
            }),
        ]);
    });

    it('skips sending when no meaningful device-backed activity exists yet', async () => {
        stopUsageMetrics = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        await flushAsyncWork();

        const didSend = await maybeSendPendingUsageMetrics('manual');

        expect(didSend).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not create a new session when the tab was hidden for less than 30 minutes', async () => {
        stopUsageMetrics = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        await flushAsyncWork();

        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));

        await vi.advanceTimersByTimeAsync(29 * 60 * 1000);

        visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        await flushAsyncWork();

        const state = await getStoredUsageMetricsState();
        expect(state.dayBuckets).toEqual([
            expect.objectContaining({
                day: '2026-04-09',
                sessionCount: 1,
            }),
        ]);
    });

    it('skips sending while offline and retries after reconnect', async () => {
        stopUsageMetrics = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        await flushAsyncWork();
        markMeaningfulActivity();
        await flushAsyncWork();

        isOnline = false;
        const didSendOffline = await maybeSendPendingUsageMetrics('manual');

        expect(didSendOffline).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();

        isOnline = true;
        const didSendOnline = await maybeSendPendingUsageMetrics('manual');

        expect(didSendOnline).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('keeps buckets unsent when the metrics request fails', async () => {
        global.fetch = vi.fn(async () => ({ ok: false }));

        stopUsageMetrics = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        await flushAsyncWork();
        markMeaningfulActivity();
        await flushAsyncWork();

        const didSend = await maybeSendPendingUsageMetrics('manual');
        const state = await getStoredUsageMetricsState();

        expect(didSend).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(state.lastSendDay).toBeNull();
        expect(state.dayBuckets[0].sent).toBe(false);
    });

    it('does not send or write when syncing is enabled without a current day bucket', async () => {
        stopUsageMetrics = startUsageMetrics({
            endpoint: null,
            appVersion: '1.2.3',
        });

        await flushAsyncWork();
        const putCallsBefore = mockDb.put.mock.calls.length;

        setUsageMetricsSessionId('session-123');
        await flushAsyncWork();

        expect(mockDb.put).toHaveBeenCalledTimes(putCallsBefore);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not duplicate listeners or sessions when started twice', async () => {
        const firstStop = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });
        const secondStop = startUsageMetrics({
            endpoint: 'https://sync.tasktime.pro/metrics/batch',
            appVersion: '1.2.3',
        });

        stopUsageMetrics = () => {
            secondStop();
            firstStop();
        };

        await flushAsyncWork();

        const state = await getStoredUsageMetricsState();
        expect(state.dayBuckets).toEqual([
            expect.objectContaining({
                day: '2026-04-09',
                sessionCount: 1,
            }),
        ]);
    });
});