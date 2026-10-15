import { describe, expect, it } from 'vitest';
import { evaluateFocusDeadline } from './focusReminderScheduler';

describe('Focus reminder deadline', () => {
    it('waits for the deadline and accepts small scheduler jitter', () => {
        expect(evaluateFocusDeadline(999, 1000, 1200)).toEqual({ play: false, nextDeadline: 1000 });
        expect(evaluateFocusDeadline(1007, 1000, 1200)).toEqual({ play: true, nextDeadline: 2207 });
    });

    it('skips a materially missed ping and starts a fresh interval', () => {
        expect(evaluateFocusDeadline(10000, 1000, 1200)).toEqual({ play: false, nextDeadline: 11200 });
    });
});
