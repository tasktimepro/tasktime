import { describe, expect, it } from 'vitest';
import {
    TaskStateOperationError,
    buildTaskCompletionUpdates,
    buildRecurringSkipUpdates,
    buildTaskStatePatchUpdates,
} from './taskStateOperations';

describe('task state operations', () => {
    it('uses occurrence completion for recurring tasks and calendar completion for ordinary tasks', () => {
        const recurring = buildTaskCompletionUpdates({
            task: { id: 'recurring', title: 'Weekly', recurring: { type: 'weekly', weeklyDays: [1] } },
            occurrenceDate: '2026-07-13',
            now: Date.parse('2026-07-13T12:00:00Z'),
        });
        const ordinary = buildTaskCompletionUpdates({
            task: { id: 'ordinary', title: 'Once' },
            completed: true,
            completionDate: '2026-07-13',
            now: 10,
        });

        expect(recurring.completedDatesByYear?.['2026']?.['7']).toContain(13);
        expect(recurring.skipUntilNextRecurring).toBe(false);
        expect(ordinary).toEqual(expect.objectContaining({ completed: true, completedOnDate: '2026-07-13' }));
    });

    it('preserves an existing ordinary completion date when completion is replayed', () => {
        const replayed = buildTaskCompletionUpdates({
            task: {
                id: 'ordinary',
                title: 'Once',
                completed: true,
                completedOnDate: '2026-07-01',
            },
            completed: true,
            now: Date.parse('2026-07-13T12:00:00Z'),
        });

        expect(replayed.completedOnDate).toBe('2026-07-01');
    });

    it('records recurring skip state as durable occurrence evidence', () => {
        const task = {
            id: 'recurring',
            title: 'Weekly',
            recurring: { type: 'weekly' as const, weeklyDays: [1] },
            skipUntilNextRecurring: true,
            skippedOccurrenceDate: '2026-07-06',
        };

        expect(buildRecurringSkipUpdates(task, '2026-07-13', 20)).toEqual(expect.objectContaining({
            skipUntilNextRecurring: true,
            skippedOccurrenceDate: '2026-07-13',
        }));
        expect(task).toEqual(expect.objectContaining({
            skipUntilNextRecurring: true,
            skippedOccurrenceDate: '2026-07-06',
        }));
        expect(() => buildRecurringSkipUpdates({ id: 'once', title: 'Once' }, '2026-07-13', 20))
            .toThrow(TaskStateOperationError);
    });

    it('normalizes generic completion and recurring skip state updates', () => {
        const now = Date.parse('2026-07-13T12:00:00Z');
        const ordinary = buildTaskStatePatchUpdates({
            task: { id: 'ordinary', title: 'Once' },
            updates: { completed: true },
            now,
        });
        const recurringTask = {
            id: 'recurring',
            title: 'Weekly',
            recurring: { type: 'weekly' as const, weeklyDays: [1] },
            skipUntilNextRecurring: true,
            skippedOccurrenceDate: '2026-07-06',
        };
        const recurringCompletion = buildTaskStatePatchUpdates({
            task: recurringTask,
            updates: { completedDatesByYear: { '2026': { '7': [13] } } },
            now,
        });
        const recurringSkip = buildTaskStatePatchUpdates({
            task: recurringTask,
            updates: { skippedOccurrenceDate: '2026-07-13' },
            now,
        });

        expect(ordinary).toEqual(expect.objectContaining({
            completed: true,
            completedOnDate: '2026-07-13',
        }));
        expect(recurringCompletion).toEqual(expect.objectContaining({
            skipUntilNextRecurring: false,
            skippedOccurrenceDate: null,
        }));
        expect(recurringSkip).toEqual(expect.objectContaining({
            skipUntilNextRecurring: true,
            skippedOccurrenceDate: '2026-07-13',
        }));
        expect(() => buildTaskStatePatchUpdates({
            task: recurringTask,
            updates: { completed: true },
            now,
        })).toThrow(/occurrence/i);
    });
});


describe('recurrence pause lifecycle', () => {
    const now = new Date(2026, 8, 8, 12).getTime();
    const task = { id: 't', title: 'Weekly', recurring: { type: 'weekly' as const, weeklyDays: [1], paused: true }, completedDatesByYear: { '2026': { '8': [31] } } };
    it('resumes with a local date boundary and leaves completion and skip history untouched', () => {
        const patch = buildTaskStatePatchUpdates({ task, updates: { recurring: { ...task.recurring, paused: false } }, now });
        expect(patch).toEqual({ recurring: { ...task.recurring, paused: false, resumeFrom: '2026-09-08' } });
        expect(task.completedDatesByYear).toEqual({ '2026': { '8': [31] } });
        expect(buildTaskStatePatchUpdates({ task: { ...task, ...patch }, updates: { recurring: patch.recurring }, now: now + 86400000 })).toEqual(patch);
    });
    it('preserves pause when a schedule-only edit replaces recurrence configuration', () => {
        expect(buildTaskStatePatchUpdates({ task, updates: { recurring: { type: 'monthly', monthlyType: 'first' } }, now }).recurring)
            .toEqual({ type: 'monthly', monthlyType: 'first', paused: true });
    });
    it('retains the current resume boundary when a stale task editor saves its schedule', () => {
        const resumedTask = { ...task, recurring: { ...task.recurring, paused: false, resumeFrom: '2026-09-08' } };
        expect(buildTaskStatePatchUpdates({ task: resumedTask, updates: { recurring: { type: 'weekly', weeklyDays: [2] } }, now }).recurring)
            .toEqual({ type: 'weekly', weeklyDays: [2], paused: false, resumeFrom: '2026-09-08' });
    });
    it('rejects invalid pause state and recurring subtasks', () => {
        expect(() => buildTaskStatePatchUpdates({ task, updates: { recurring: { ...task.recurring, paused: 'yes' as never } }, now })).toThrow(/paused/);
        expect(() => buildTaskStatePatchUpdates({ task: { ...task, parentTaskId: 'parent' }, updates: { recurring: { ...task.recurring, paused: false } }, now })).toThrow(/Subtasks/);
    });
});
