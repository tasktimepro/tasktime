import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudAuthRecovery, cloudAuthRetryAfter, withCloudAuthTimeout } from './cloudAuthRecovery';

describe('cloud auth recovery', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    });
    afterEach(() => vi.useRealTimers());

    it('shares one bounded retry sequence and coalesces wake signals', async () => {
        const recovery = new CloudAuthRecovery();
        const first = vi.fn(async () => {});
        const second = vi.fn(async () => {});
        const unsubscribeFirst = recovery.subscribe(first);
        recovery.pending('session');
        await vi.advanceTimersByTimeAsync(1000);
        const unsubscribeSecond = recovery.subscribe(second);
        recovery.pending('session');
        await vi.advanceTimersByTimeAsync(500 + 5000 + 15000 + 60_000);
        expect(first).toHaveBeenCalledTimes(3);
        expect(second).toHaveBeenCalledTimes(3);

        window.dispatchEvent(new Event('online'));
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);
        expect(first).toHaveBeenCalledTimes(4);
        recovery.clear('different-session');
        await vi.advanceTimersByTimeAsync(5000);
        expect(first).toHaveBeenCalledTimes(5);
        recovery.clear('session');
        await vi.advanceTimersByTimeAsync(60_000);
        expect(first).toHaveBeenCalledTimes(5);
        unsubscribeFirst();
        unsubscribeSecond();
    });

    it('waits while hidden or offline, respects Retry-After and cleans up on unmount', async () => {
        const recovery = new CloudAuthRecovery();
        const listener = vi.fn(async () => {});
        const unsubscribe = recovery.subscribe(listener);
        recovery.pending('session', Date.now() + 20_000);
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        await vi.advanceTimersByTimeAsync(20_000);
        expect(listener).not.toHaveBeenCalled();
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(5000);
        expect(listener).not.toHaveBeenCalled();
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
        recovery.pending('session', Date.now() + 10_000);
        window.dispatchEvent(new Event('online'));
        await vi.advanceTimersByTimeAsync(9999);
        expect(listener).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not overlap slow attempts or resurrect a cleared retry', async () => {
        const recovery = new CloudAuthRecovery();
        let resolve!: () => void;
        const listener = vi.fn(() => new Promise<void>(done => { resolve = done; }));
        const unsubscribe = recovery.subscribe(listener);
        recovery.pending('old-session');
        await vi.advanceTimersByTimeAsync(1500);
        window.dispatchEvent(new Event('online'));
        await vi.advanceTimersByTimeAsync(60_000);
        expect(listener).toHaveBeenCalledTimes(1);
        recovery.clear();
        resolve();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it('honors a newer Retry-After while a retry is already scheduled', async () => {
        const recovery = new CloudAuthRecovery();
        const listener = vi.fn(async () => {});
        const unsubscribe = recovery.subscribe(listener);
        recovery.pending('session');
        await vi.advanceTimersByTimeAsync(1000);
        recovery.pending('session', Date.now() + 20_000);
        await vi.advanceTimersByTimeAsync(19_999);
        expect(listener).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(listener).toHaveBeenCalledOnce();
        recovery.clear();
        unsubscribe();
    });

    it('bounds stalled status bodies, aborts the request and releases timers after success', async () => {
        let signal!: AbortSignal;
        const request = withCloudAuthTimeout(async value => {
            signal = value;
            return new Promise<never>(() => {});
        });
        const assertion = expect(request).rejects.toThrow('temporarily unavailable');
        await vi.advanceTimersByTimeAsync(10_000);
        await assertion;
        expect(signal.aborted).toBe(true);
        await expect(withCloudAuthTimeout(async () => 'ready')).resolves.toBe('ready');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('parses numeric and date Retry-After values with a finite upper bound', () => {
        const header = (value?: string) => ({ headers: new Headers(value ? { 'Retry-After': value } : {}) });
        expect(cloudAuthRetryAfter(header())).toBe(0);
        expect(cloudAuthRetryAfter(header('invalid'))).toBe(0);
        expect(cloudAuthRetryAfter(header('-5'))).toBe(0);
        expect(cloudAuthRetryAfter(header('2'))).toBe(Date.now() + 2000);
        expect(cloudAuthRetryAfter(header('9999999'))).toBe(Date.now() + 3_600_000);
        const future = new Date(Date.now() + 60_000).toUTCString();
        expect(cloudAuthRetryAfter(header(future))).toBe(Date.parse(future));
    });
});
