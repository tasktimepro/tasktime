import { format } from 'date-fns';
import type { FocusItem, Project, Task } from '@/stores/yjs/types';
import { isRecurringCompletedOnDate } from '@/utils/recurringCompletionUtils';
import { findNextRecurringDueDate, isRecurringTaskDueOnDate } from '@/utils/recurringUtils';

export interface FocusRow {
    item: FocusItem;
    task: Task;
}

export interface FocusGroup {
    id: string | null;
    title: string;
    items: FocusRow[];
}

/** Validate a calendar date without UTC conversion of local occurrences. */
export function parseFocusDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid occurrence date.');
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (format(parsed, 'yyyy-MM-dd') !== value) throw new Error('Choose a valid occurrence date.');
    return parsed;
}

/** Suggest the current or next actionable occurrence; never infer today blindly. */
export function resolveFocusOccurrence(task: Task, now: Date): string | undefined {
    if (!task.recurring || task.recurring.paused) return undefined;
    const today = format(now, 'yyyy-MM-dd');
    if (isRecurringTaskDueOnDate(now, task.recurring)
        && !isRecurringCompletedOnDate(task.completedDatesByYear, today)
        && !(task.skipUntilNextRecurring && task.skippedOccurrenceDate === today)) return today;
    let candidate = findNextRecurringDueDate(now, task.recurring);
    for (let attempts = 0; candidate && attempts < 370; attempts++) {
        const date = format(candidate, 'yyyy-MM-dd');
        if (!isRecurringCompletedOnDate(task.completedDatesByYear, date)
            && !(task.skipUntilNextRecurring && task.skippedOccurrenceDate === date)) return date;
        candidate = findNextRecurringDueDate(candidate, task.recurring);
    }
    return undefined;
}

/** The creation plan is pure; adapters commit only after every selection validates. */
export function buildFocusItem({ task, projects, existing, occurrenceDate, now, selectionId }: {
    task: Task;
    projects: Project[];
    existing: FocusItem[];
    occurrenceDate?: string;
    now: number;
    selectionId: string;
}): FocusItem {
    if (!task.id || task.archived || task.archivedOnDate || task.completed) throw new Error('This task is unavailable for Focus.');
    if (task.projectId && !projects.some(project => project.id === task.projectId && !project.archived && !project.archivedOnDate)) {
        throw new Error('This project is unavailable for Focus.');
    }
    if (existing.some(item => item.taskId === task.id)) throw new Error('This task is already in Focus.');
    if (!selectionId || !Number.isFinite(now)) throw new Error('Invalid Focus selection.');
    if (task.recurring) {
        if (!occurrenceDate) throw new Error('Choose a recurring occurrence.');
        if (!isRecurringTaskDueOnDate(parseFocusDate(occurrenceDate), task.recurring)
            || isRecurringCompletedOnDate(task.completedDatesByYear, occurrenceDate)
            || (task.skipUntilNextRecurring && task.skippedOccurrenceDate === occurrenceDate)) {
            throw new Error('This occurrence is unavailable for Focus.');
        }
    } else if (occurrenceDate) {
        throw new Error('A one-time task has no recurring occurrence.');
    }
    const sameGroup = existing.filter(item => item.taskId !== task.id);
    const position = Math.max(0, ...sameGroup.map(item => item.position)) + 1;
    return {
        id: task.id,
        taskId: task.id,
        selectionId,
        ...(occurrenceDate ? { occurrenceDate } : {}),
        position,
        addedAt: now,
    };
}

/** Completion elsewhere retires only the exact selected occurrence. */
export function shouldRetireFocusItem(item: FocusItem, task: Task): boolean {
    if (task.recurring) return Boolean(item.occurrenceDate
        && isRecurringCompletedOnDate(task.completedDatesByYear, item.occurrenceDate));
    return !item.occurrenceDate && Boolean(task.completed);
}

/** Schedule changes make a selection unavailable, never silently retarget it. */
export function isFocusItemActionable(item: FocusItem, task: Task): boolean {
    if (task.archived || task.archivedOnDate || shouldRetireFocusItem(item, task)) return false;
    if (task.recurring) {
        return Boolean(item.occurrenceDate && !task.recurring.paused
            && isRecurringTaskDueOnDate(parseFocusDate(item.occurrenceDate), task.recurring)
            && !(task.skipUntilNextRecurring && task.skippedOccurrenceDate === item.occurrenceDate));
    }
    return !item.occurrenceDate && !task.completed;
}

/** Derive project groups from current relationships rather than copying names. */
export function groupFocusItems(items: FocusItem[], tasks: Task[], projects: Project[]): FocusGroup[] {
    const tasksById = new Map(tasks.map(task => [task.id, task]));
    const projectsById = new Map(projects.map(project => [project.id, project]));
    const groups = new Map<string | null, FocusGroup>();
    for (const item of items) {
        const task = tasksById.get(item.taskId);
        if (!task || !isFocusItemActionable(item, task)) continue;
        const id = task.projectId || null;
        const project = id ? projectsById.get(id) : null;
        if (id && (!project || project.archived || project.archivedOnDate)) continue;
        const title = id ? project?.title || 'Unavailable project' : 'Unassigned';
        if (!groups.has(id)) groups.set(id, { id, title, items: [] });
        groups.get(id)!.items.push({ item, task });
    }
    for (const group of groups.values()) {
        group.items.sort((left, right) => left.item.position - right.item.position
            || left.item.addedAt - right.item.addedAt || left.item.id.localeCompare(right.item.id));
    }
    return [...groups.values()].sort((left, right) => left.id === null ? -1 : right.id === null ? 1
        : left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
}

/** Return one reordered group, with stable finite ranks. */
export function moveFocusItem(items: FocusItem[], taskId: string, direction: 'up' | 'down'): FocusItem[] {
    const ordered = [...items].sort((a, b) => a.position - b.position || a.addedAt - b.addedAt || a.id.localeCompare(b.id));
    const index = ordered.findIndex(item => item.taskId === taskId);
    if (index < 0) throw new Error('This task is no longer in Focus.');
    const other = direction === 'up' ? index - 1 : index + 1;
    if (other < 0 || other >= ordered.length) return ordered;
    [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
    return ordered.map((item, position) => ({ ...item, position: position + 1 }));
}
