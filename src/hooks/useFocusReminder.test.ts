import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFocusReminder } from './useFocusReminder';

const oscillatorStart = vi.fn();
const closeAudio = vi.fn(async () => undefined);

class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => undefined);
    close = closeAudio;
    createOscillator() {
        return { type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: oscillatorStart, stop: vi.fn() };
    }
    createGain() {
        return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    }
}

describe('useFocusReminder', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-10T10:00:00Z'));
        vi.stubGlobal('AudioContext', FakeAudioContext);
        oscillatorStart.mockClear();
        closeAudio.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    });

    it('never schedules or unlocks audio when reminders are off', () => {
        const { result, unmount } = renderHook(() => useFocusReminder({ open: true, eligible: true, savedMinutes: 0 }));
        expect(result.current.audioEnabled).toBe(false);
        act(() => { vi.advanceTimersByTime(3_600_000); });
        expect(oscillatorStart).not.toHaveBeenCalled();
        unmount();
    });

    it('accepts sound unlocked by the explicit Focus entry gesture', async () => {
        const { result, rerender, unmount } = renderHook(({ open }) => useFocusReminder({ open, eligible: false, savedMinutes: 30 }), {
            initialProps: { open: false },
        });
        await act(async () => { await result.current.enable(); });
        await act(async () => { rerender({ open: true }); await Promise.resolve(); });
        expect(result.current.audioEnabled).toBe(true);
        expect(result.current.status).toBe('Sound enabled.');
        unmount();
        expect(closeAudio).toHaveBeenCalled();
    });

    it('loads the saved cadence after a direct-link preference read without enabling audio', () => {
        const { result, rerender, unmount } = renderHook(({ saved, ready }) => useFocusReminder({
            open: true, eligible: true, savedMinutes: saved, preferencesReady: ready,
        }), { initialProps: { saved: 0 as 0 | 20, ready: false } });
        expect(result.current.status).toBe('Sound is off.');
        rerender({ saved: 20, ready: true });
        expect(result.current.status).toBe('Enable sound for reminders on this device.');
        expect(result.current.audioEnabled).toBe(false);
        unmount();
    });

    it('defers a remotely changed preference until the next Focus entry', () => {
        const { result, rerender, unmount } = renderHook(({ open, saved }) => useFocusReminder({
            open, eligible: false, savedMinutes: saved,
        }), { initialProps: { open: true, saved: 20 as 20 | 40 } });
        expect(result.current.minutes).toBe(20);
        rerender({ open: true, saved: 40 });
        expect(result.current.minutes).toBe(20);
        rerender({ open: false, saved: 40 });
        rerender({ open: true, saved: 40 });
        expect(result.current.minutes).toBe(40);
        unmount();
    });

    it('fails closed without Web Locks and allows a manual sound preview', async () => {
        Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
        const { result, unmount } = renderHook(() => useFocusReminder({ open: true, eligible: true, savedMinutes: 20 }));
        await act(async () => { await result.current.preview(); });
        expect(oscillatorStart).toHaveBeenCalledTimes(1);
        expect(result.current.status).toMatch(/ownership is unavailable/i);
        act(() => { vi.advanceTimersByTime(20 * 60_000); });
        expect(oscillatorStart).toHaveBeenCalledTimes(1);
        unmount();
    });

    it('does not enable sound from unavailable or blocked audio and can turn an interval off', async () => {
        vi.stubGlobal('AudioContext', undefined);
        const { result, unmount } = renderHook(() => useFocusReminder({ open: true, eligible: true, savedMinutes: 20 }));
        await act(async () => { await result.current.enable(); });
        expect(result.current.audioEnabled).toBe(false);
        expect(result.current.status).toMatch(/unavailable/);
        await act(async () => { await result.current.preview(); });
        expect(result.current.status).toMatch(/blocked/);
        act(() => { result.current.setInterval(0); });
        expect(result.current.status).toBe('Sound is off.');
        unmount();
    });

    it('waits for another tab to release sound ownership', async () => {
        let attempts = 0;
        const request = vi.fn((_name, _options, callback) => Promise.resolve(callback(++attempts === 1 ? null : { name: 'tasktime-focus-sound' })));
        Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
        const { result, unmount } = renderHook(() => useFocusReminder({ open: true, eligible: true, savedMinutes: 20 }));
        await act(async () => { await result.current.enable(); });
        expect(result.current.status).toMatch(/another tab/);
        act(() => { vi.advanceTimersByTime(5000); });
        expect(request).toHaveBeenCalledTimes(2);
        expect(result.current.status).toBe('Reminders active.');
        unmount();
    });

    it('keeps the list usable when lock acquisition rejects or audio is blocked', async () => {
        const request = vi.fn(async () => { throw new Error('locks failed'); });
        Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
        const { result, unmount } = renderHook(() => useFocusReminder({ open: true, eligible: true, savedMinutes: 20 }));
        await act(async () => { await result.current.enable(); await Promise.resolve(); });
        expect(result.current.status).toMatch(/ownership is unavailable/);
        unmount();

        class BlockedAudioContext extends FakeAudioContext { state = 'suspended'; }
        vi.stubGlobal('AudioContext', BlockedAudioContext);
        const blocked = renderHook(() => useFocusReminder({ open: true, eligible: true, savedMinutes: 20 }));
        await act(async () => { await blocked.result.current.enable(); });
        expect(blocked.result.current.audioEnabled).toBe(false);
        expect(blocked.result.current.status).toMatch(/blocked/);
        blocked.unmount();
    });

    it('pings once under the lock and cancels when the timer pauses or Focus exits', async () => {
        const request = vi.fn((_name, _options, callback) => Promise.resolve(callback({ name: 'tasktime-focus-sound' })));
        Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
        const { result, rerender, unmount } = renderHook(({ open, eligible }) => useFocusReminder({ open, eligible, savedMinutes: 20 }), {
            initialProps: { open: true, eligible: true },
        });
        await act(async () => { await result.current.enable(); });
        expect(request).toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(20 * 60_000); });
        expect(oscillatorStart).toHaveBeenCalledTimes(1);
        expect(result.current.notice).toBe('Focus reminder');
        rerender({ open: true, eligible: false });
        act(() => { vi.advanceTimersByTime(20 * 60_000); });
        expect(oscillatorStart).toHaveBeenCalledTimes(1);
        rerender({ open: false, eligible: false });
        expect(closeAudio).toHaveBeenCalled();
        unmount();
    });
});
