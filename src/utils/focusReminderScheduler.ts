/** A late browser wake never replays reminders missed during sleep. */
export function evaluateFocusDeadline(now: number, deadline: number, intervalMs: number, toleranceMs = 2000) {
    if (!Number.isFinite(now) || !Number.isFinite(deadline) || !Number.isFinite(intervalMs) || intervalMs <= 0) {
        throw new Error('Invalid Focus reminder deadline.');
    }
    if (now < deadline) return { play: false, nextDeadline: deadline };
    return { play: now - deadline <= toleranceMs, nextDeadline: now + intervalMs };
}
