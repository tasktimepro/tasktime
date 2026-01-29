import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMasterClock, { useTimerElapsed } from './useMasterClock';

describe('useMasterClock', () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns current time when disabled', () => {
        const now = new Date('2026-01-20T10:00:00.000Z');
        vi.setSystemTime(now);

        const { result, unmount } = renderHook(() => useMasterClock(false));

        expect(result.current).toBe(now.getTime());
        unmount();
    });

    it('ticks when enabled and aligns to the next second', () => {
        const start = new Date('2026-01-20T10:00:00.500Z');
        vi.setSystemTime(start);

        const { result, unmount } = renderHook(() => useMasterClock(true));

        expect(result.current).toBe(start.getTime());

        act(() => {
            vi.advanceTimersByTime(600);
        });

        expect(result.current).toBeGreaterThanOrEqual(start.getTime() + 500);
        unmount();
    });
});

describe('useTimerElapsed', () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns 0 when startTime is null', () => {
        const { result, unmount } = renderHook(() => useTimerElapsed(null, false));

        expect(result.current).toBe(0);
        unmount();
    });

    it('returns paused elapsed time when paused', () => {
        const { result, unmount } = renderHook(() => useTimerElapsed(1000, true, 450));

        expect(result.current).toBe(450);
        unmount();
    });

    it('returns 0 when running and startTime is in the future', () => {
        vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

        const { result, unmount } = renderHook(() => useTimerElapsed(Date.now() + 1000, false));

        expect(result.current).toBe(0);
        unmount();
    });

    it('returns elapsed time when running', () => {
        const now = new Date('2026-01-20T10:00:05.000Z');
        vi.setSystemTime(now);

        const { result, unmount } = renderHook(() => useTimerElapsed(now.getTime() - 2000, false));

        expect(result.current).toBe(2000);
        unmount();
    });
});
