import { describe, expect, it } from 'vitest';
import type { FocusItem, Project, Task } from '@/stores/yjs/types';
import {
    buildFocusItem,
    groupFocusItems,
    isFocusItemActionable,
    moveFocusItem,
    resolveFocusOccurrence,
    shouldRetireFocusItem,
} from './focusOperations';

const project: Project = { id: 'project-1', title: 'Client work' };
const task: Task = { id: 'task-1', title: 'Review draft', projectId: project.id };

const selected = (taskId: string, position: number): FocusItem => ({
    id: taskId,
    taskId,
    selectionId: `selection-${taskId}`,
    position,
    addedAt: 100,
});

describe('Focus operations', () => {
    it('keeps one selected task and validates existing project/occurrence', () => {
        expect(buildFocusItem({ task, projects: [project], existing: [], now: 100, selectionId: 'new' }))
            .toMatchObject({ taskId: task.id, position: 1, selectionId: 'new' });
        expect(() => buildFocusItem({ task, projects: [project], existing: [selected(task.id, 1)], now: 100, selectionId: 'new' }))
            .toThrow(/already in Focus/);
        expect(() => buildFocusItem({ task: { ...task, projectId: 'missing' }, projects: [project], existing: [], now: 100, selectionId: 'new' }))
            .toThrow(/project/);

        const recurring: Task = { ...task, recurring: { type: 'weekly', weeklyDays: [6] } };
        expect(() => buildFocusItem({ task: recurring, projects: [project], existing: [], now: 100, selectionId: 'new' }))
            .toThrow(/occurrence/);
        expect(buildFocusItem({ task: recurring, projects: [project], existing: [], now: 100, selectionId: 'new', occurrenceDate: '2026-10-10' }))
            .toMatchObject({ occurrenceDate: '2026-10-10' });
        expect(() => buildFocusItem({ task: recurring, projects: [project], existing: [], now: 100, selectionId: 'new', occurrenceDate: '2026-10-11' }))
            .toThrow(/occurrence/);
    });

    it('groups from current projects and keeps task order independent of project order', () => {
        const standalone: Task = { id: 'standalone', title: 'Independent' };
        const items = [selected(task.id, 2), selected(standalone.id, 1)];
        const groups = groupFocusItems(items, [task, standalone], [project]);
        expect(groups.map(group => group.title)).toEqual(['Unassigned', 'Client work']);
        expect(groups[1].items[0].task.title).toBe('Review draft');
        expect(groupFocusItems(items, [{ ...task, projectId: null }, standalone], [project])[0].items).toHaveLength(2);
    });

    it('moves within a group and preserves the other tasks', () => {
        const items = [selected('first', 1), selected('second', 2), selected('third', 3)];
        const moved = moveFocusItem(items, 'third', 'up');
        expect(moved.map(item => item.id)).toEqual(['first', 'third', 'second']);
        expect(moved.find(item => item.id === 'first')?.position).toBe(1);
    });

    it('retires only the selected completed occurrence and never auto-pins tomorrow', () => {
        const recurring: Task = {
            ...task,
            recurring: { type: 'weekly', weeklyDays: [6] },
            completedDatesByYear: { '2026': { '10': [10] } },
        };
        const item: FocusItem = { ...selected(task.id, 1), occurrenceDate: '2026-10-10' };
        expect(shouldRetireFocusItem(item, recurring)).toBe(true);
        expect(shouldRetireFocusItem({ ...item, occurrenceDate: '2026-10-17' }, recurring)).toBe(false);
        expect(resolveFocusOccurrence(recurring, new Date(2026, 9, 10))).toBe('2026-10-17');
        expect(shouldRetireFocusItem(selected(task.id, 1), { ...task, completed: true })).toBe(true);
    });

    it('retains but does not offer a selected occurrence after pause or schedule change', () => {
        const item: FocusItem = { ...selected(task.id, 1), occurrenceDate: '2026-10-10' };
        const recurring: Task = { ...task, recurring: { type: 'weekly', weeklyDays: [6] } };
        expect(isFocusItemActionable(item, recurring)).toBe(true);
        expect(isFocusItemActionable(item, { ...recurring, recurring: { ...recurring.recurring!, paused: true } })).toBe(false);
        expect(isFocusItemActionable(item, { ...recurring, skipUntilNextRecurring: true, skippedOccurrenceDate: item.occurrenceDate })).toBe(false);
        expect(resolveFocusOccurrence({ ...recurring, skipUntilNextRecurring: true, skippedOccurrenceDate: item.occurrenceDate }, new Date(2026, 9, 10))).toBe('2026-10-17');
        expect(groupFocusItems([item], [{ ...recurring, recurring: { type: 'weekly', weeklyDays: [0] } }], [project])).toEqual([]);
        expect(isFocusItemActionable(item, task)).toBe(false);
        expect(shouldRetireFocusItem(item, task)).toBe(false);
    });
});
