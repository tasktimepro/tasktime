import { describe, expect, it } from 'vitest';
import {
    TimeEntryOperationError,
    buildManualTimeEntry,
    buildManualTimeEntryUpdate,
    assertManualTimeEntryDeletion,
} from './manualTimeEntryOperations';

const task = { id: 'task-1', title: 'Task', projectId: 'project-1', lastBilledAt: 2_000 };
const tasks = [task];

describe('manual time entry operations', () => {
    it('applies duration snapshots after shared cutoff and overlap validation', () => {
        const entry = buildManualTimeEntry({
            id: 'entry-1',
            task,
            tasks,
            entries: [],
            start: 3_000,
            end: 63_000,
            billingIncrementMinutes: 15,
            now: 70_000,
        });

        expect(entry.billedDurationMs).toBe(900_000);
        expect(entry.billingIncrementMinutes).toBe(15);
    });

    it('rejects overlap, billed updates/deletes, and ranges before the billing cutoff', () => {
        expect(() => buildManualTimeEntry({
            id: 'entry-2', task, tasks, entries: [], start: 1_000, end: 3_000, now: 4_000,
        })).toThrow(TimeEntryOperationError);

        const billed = { id: 'entry-1', taskId: task.id, start: 3_000, end: 4_000, billedInvoiceId: 'invoice-1' };
        expect(() => buildManualTimeEntryUpdate({
            entry: billed, task, tasks, entries: [billed], updates: { end: 5_000 }, now: 6_000,
        })).toThrow(TimeEntryOperationError);
        expect(() => assertManualTimeEntryDeletion(billed)).toThrow(TimeEntryOperationError);

        const existing = { id: 'existing', taskId: task.id, start: 4_000, end: 8_000 };
        expect(() => buildManualTimeEntry({
            id: 'entry-3', task, tasks, entries: [existing], start: 5_000, end: 7_000, now: 9_000,
        })).toThrow(/overlaps/);
        expect(() => assertManualTimeEntryDeletion({
            id: 'legacy-cutoff', taskId: task.id, start: 1_500, end: 1_800,
        }, task)).toThrow(TimeEntryOperationError);
    });

    it('keeps the original task billing lock when an entry is reassigned', () => {
        const sourceTask = { id: 'source', title: 'Source', projectId: 'project-1', lastBilledAt: 5_000 };
        const targetTask = { id: 'target', title: 'Target', projectId: 'project-2' };
        const legacyBilledEntry = { id: 'entry-legacy', taskId: sourceTask.id, start: 4_000, end: 4_500 };

        expect(() => buildManualTimeEntryUpdate({
            entry: legacyBilledEntry,
            sourceTask,
            task: targetTask,
            tasks: [sourceTask, targetTask],
            entries: [legacyBilledEntry],
            updates: { taskId: targetTask.id, start: 6_000, end: 7_000 },
            now: 8_000,
        })).toThrow(/Billed time entries/);
    });

    it('preserves legacy billable duration evidence unless clearing it is explicit', () => {
        const legacyDurationEntry = {
            id: 'entry-duration',
            taskId: task.id,
            start: 3_000,
            end: 4_000,
            billedDurationMs: 900_000,
        };
        const preserved = buildManualTimeEntryUpdate({
            entry: legacyDurationEntry,
            sourceTask: task,
            task,
            tasks,
            entries: [legacyDurationEntry],
            updates: { note: 'Keep snapshot' },
            now: 5_000,
        });
        const cleared = buildManualTimeEntryUpdate({
            entry: legacyDurationEntry,
            sourceTask: task,
            task,
            tasks,
            entries: [legacyDurationEntry],
            updates: { billingIncrementMinutes: null },
            now: 5_000,
        });

        expect(preserved.billedDurationMs).toBe(900_000);
        expect(Object.prototype.hasOwnProperty.call(preserved, 'billingIncrementMinutes')).toBe(false);
        expect(cleared.billedDurationMs).toBeNull();
        expect(cleared.billingIncrementMinutes).toBeNull();
    });
});
