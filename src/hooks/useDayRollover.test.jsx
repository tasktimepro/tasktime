import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTodayString } from './useDayRollover';

describe('useDayRollover', () => {

    beforeEach(() => {

        vi.useFakeTimers();
    });

    afterEach(() => {

        vi.useRealTimers();
    });

    it('updates today at local midnight', () => {

        const start = new Date(2026, 1, 2, 23, 59, 30);
        vi.setSystemTime(start);

        const { result, unmount } = renderHook(() => useTodayString());

        expect(result.current).toBe('2026-02-02');

        const nextMidnight = new Date(2026, 1, 3, 0, 0, 0, 0).getTime();
        const msUntilMidnight = nextMidnight - start.getTime();

        act(() => {

            vi.advanceTimersByTime(msUntilMidnight + 1100);
        });

        expect(result.current).toBe('2026-02-03');

        unmount();
    });

    it('refreshes on focus when day changed', () => {

        vi.setSystemTime(new Date(2026, 1, 2, 12, 0, 0));

        const { result, unmount } = renderHook(() => useTodayString());

        expect(result.current).toBe('2026-02-02');

        vi.setSystemTime(new Date(2026, 1, 3, 12, 0, 0));

        act(() => {

            window.dispatchEvent(new Event('focus'));
        });

        expect(result.current).toBe('2026-02-03');

        unmount();
    });

    it('only refreshes on visibility when visible', () => {

        vi.setSystemTime(new Date(2026, 1, 2, 12, 0, 0));

        const { result, unmount } = renderHook(() => useTodayString());

        expect(result.current).toBe('2026-02-02');

        vi.setSystemTime(new Date(2026, 1, 3, 12, 0, 0));

        Object.defineProperty(document, 'visibilityState', {
            value: 'hidden',
            configurable: true,
        });

        act(() => {

            window.dispatchEvent(new Event('visibilitychange'));
        });

        expect(result.current).toBe('2026-02-02');

        Object.defineProperty(document, 'visibilityState', {
            value: 'visible',
            configurable: true,
        });

        act(() => {

            window.dispatchEvent(new Event('visibilitychange'));
        });

        expect(result.current).toBe('2026-02-03');

        unmount();
    });
});
