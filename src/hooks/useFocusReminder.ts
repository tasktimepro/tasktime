import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluateFocusDeadline } from '@/utils/focusReminderScheduler';

type Interval = 0 | 20 | 30 | 40 | 60;

/** Local audio intent and lock ownership are deliberately absent from Yjs. */
export function useFocusReminder({ open, eligible, savedMinutes, preferencesReady = true }: {
    open: boolean;
    eligible: boolean;
    savedMinutes: Interval;
    preferencesReady?: boolean;
}) {
    const [minutes, setMinutes] = useState<Interval>(0);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [owner, setOwner] = useState(false);
    const [status, setStatus] = useState('Sound is off.');
    const [notice, setNotice] = useState('');
    const audioRef = useRef<AudioContext | null>(null);
    const deadlineRef = useRef<number | null>(null);
    const noticeTimeoutRef = useRef<number | null>(null);
    const previousOpenRef = useRef(false);
    const previousPreferencesReadyRef = useRef(false);

    useEffect(() => {
        if (open && (!previousOpenRef.current || (!previousPreferencesReadyRef.current && preferencesReady))) {
            setMinutes(savedMinutes);
            const enabledByEntryGesture = audioRef.current?.state === 'running';
            setAudioEnabled(enabledByEntryGesture);
            setStatus(savedMinutes
                ? enabledByEntryGesture ? 'Sound enabled.' : 'Enable sound for reminders on this device.'
                : 'Sound is off.');
        }
        if (!open) {
            setAudioEnabled(false);
            setOwner(false);
            setNotice('');
            if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
            noticeTimeoutRef.current = null;
            deadlineRef.current = null;
            void audioRef.current?.close();
            audioRef.current = null;
        }
        previousOpenRef.current = open;
        previousPreferencesReadyRef.current = preferencesReady;
    }, [open, savedMinutes, preferencesReady]);

    useEffect(() => () => {
        if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
        void audioRef.current?.close();
        audioRef.current = null;
    }, []);

    const tone = useCallback(() => {
        const context = audioRef.current;
        if (!context || context.state !== 'running') return false;
        try {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = 660;
            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.14);
            return true;
        } catch {
            return false;
        }
    }, []);

    const enable = useCallback(async () => {
        try {
            const AudioContextType = window.AudioContext
                || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextType) throw new Error('Audio is unavailable in this browser.');
            const context = audioRef.current ?? new AudioContextType();
            audioRef.current = context;
            await context.resume();
            if (context.state !== 'running') throw new Error('Sound was blocked. Use Enable sound to try again.');
            setAudioEnabled(true);
            setStatus('Sound enabled.');
        } catch (cause) {
            setAudioEnabled(false);
            setStatus(cause instanceof Error ? cause.message : 'Sound is unavailable.');
        }
    }, []);

    const preview = useCallback(async () => {
        await enable();
        if (!tone()) setStatus('Sound was blocked. Use Enable sound to try again.');
    }, [enable, tone]);

    const setInterval = useCallback((next: Interval) => {
        setMinutes(next);
        deadlineRef.current = null;
        if (next) void enable();
        else setStatus('Sound is off.');
    }, [enable]);

    useEffect(() => {
        if (!open || !eligible || !minutes || !audioEnabled) {
            setOwner(false);
            deadlineRef.current = null;
            return;
        }
        if (!navigator.locks?.request) {
            setStatus('Sound ownership is unavailable in this browser.');
            return;
        }
        let cancelled = false;
        let release: (() => void) | undefined;
        let requesting = false;
        const acquire = () => {
            if (cancelled || release || requesting) return;
            requesting = true;
            void navigator.locks.request('tasktime-focus-sound', { ifAvailable: true }, async lock => {
                requesting = false;
                if (!lock) {
                    if (!cancelled) setStatus('Sound is active in another tab.');
                    return;
                }
                if (cancelled) return;
                setOwner(true);
                setStatus('Reminders active.');
                await new Promise<void>(resolve => { release = resolve; });
                release = undefined;
                if (!cancelled) setOwner(false);
            }).catch(() => {
                requesting = false;
                if (!cancelled) setStatus('Sound ownership is unavailable.');
            });
        };
        acquire();
        const retry = window.setInterval(acquire, 5000);
        return () => { cancelled = true; window.clearInterval(retry); release?.(); setOwner(false); };
    }, [open, eligible, minutes, audioEnabled]);

    useEffect(() => {
        if (!open || !eligible || !minutes || !audioEnabled || !owner) {
            deadlineRef.current = null;
            return;
        }
        const intervalMs = minutes * 60_000;
        deadlineRef.current = Date.now() + intervalMs;
        let timeoutId: number;
        const schedule = () => {
            const deadline = deadlineRef.current;
            if (deadline === null) return;
            timeoutId = window.setTimeout(() => {
                if (deadlineRef.current !== deadline) return;
                const result = evaluateFocusDeadline(Date.now(), deadline, intervalMs);
                if (result.play) {
                    if (tone()) {
                        setNotice('Focus reminder');
                        if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
                        noticeTimeoutRef.current = window.setTimeout(() => {
                            noticeTimeoutRef.current = null;
                            setNotice('');
                        }, 4000);
                    } else {
                        setAudioEnabled(false);
                        setStatus('Sound was blocked. Enable it again to continue.');
                    }
                }
                deadlineRef.current = result.nextDeadline;
                schedule();
            }, Math.max(0, deadline - Date.now()));
        };
        schedule();
        return () => { window.clearTimeout(timeoutId); deadlineRef.current = null; };
    }, [open, eligible, minutes, audioEnabled, owner, tone]);

    return { minutes, audioEnabled, status, notice, enable, preview, setInterval };
}
