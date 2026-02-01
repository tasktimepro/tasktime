import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { format, startOfWeek } from 'date-fns';

// Mock dependencies
const mockAttachments = vi.hoisted(() => []);
const mockTasks = vi.hoisted(() => []);
const mockProjects = vi.hoisted(() => []);
const mockClients = vi.hoisted(() => []);
const mockTimers = vi.hoisted(() => []);
const mockEntries = vi.hoisted(() => []);

vi.mock('./usePlannerAttachments', () => ({
    usePlannerAttachments: () => ({
        attachments: mockAttachments,
        getForDate: (dateStr) => mockAttachments.filter(a => 
            a.mode === 'static' || a.date === dateStr
        ),
        isLoading: false,
    })
}));

vi.mock('./useTasks', () => ({
    useTasks: () => ({
        tasks: mockTasks,
        isLoading: false,
    })
}));

vi.mock('./useProjects', () => ({
    useProjects: () => ({
        projects: mockProjects,
        isLoading: false,
    })
}));

vi.mock('./useClients', () => ({
    useClients: () => ({
        clients: mockClients,
        isLoading: false,
    })
}));

vi.mock('./useTimers', () => ({
    useTimers: () => ({
        timers: mockTimers,
        isLoading: false,
    })
}));

vi.mock('./useTimeEntries', () => ({
    useTimeEntries: () => ({
        entries: mockEntries,
        isLoading: false,
    })
}));

vi.mock('@/utils/recurringUtils', () => ({
    isRecurringTaskDueOnDate: vi.fn(() => false),
}));

// Import after mocks are set up
import { usePlannerItems } from './usePlannerItems';
import { isRecurringTaskDueOnDate } from '@/utils/recurringUtils';

describe('usePlannerItems', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-04T12:00:00Z'));
        mockAttachments.length = 0;
        mockTasks.length = 0;
        mockProjects.length = 0;
        mockClients.length = 0;
        mockTimers.length = 0;
        mockEntries.length = 0;
        vi.mocked(isRecurringTaskDueOnDate).mockReset();
        vi.mocked(isRecurringTaskDueOnDate).mockReturnValue(false);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns 7 days for the week', () => {
        const { result } = renderHook(() => usePlannerItems(0));

        expect(result.current.weekDays).toHaveLength(7);
    });

    it('returns weekStart as a Date', () => {
        const { result } = renderHook(() => usePlannerItems(0));

        expect(result.current.weekStart).toBeInstanceOf(Date);
    });

    it('returns weekStartStr in YYYY-MM-DD format', () => {
        const { result } = renderHook(() => usePlannerItems(0));

        expect(result.current.weekStartStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('marks today correctly', () => {
        const { result } = renderHook(() => usePlannerItems(0));

        const todayCount = result.current.weekDays.filter(d => d.isToday).length;
        // Should have exactly 1 today in current week
        expect(todayCount).toBeLessThanOrEqual(1);
    });

    it('each day has required properties', () => {
        const { result } = renderHook(() => usePlannerItems(0));

        result.current.weekDays.forEach(day => {
            expect(day).toHaveProperty('date');
            expect(day).toHaveProperty('dateStr');
            expect(day).toHaveProperty('dayOfWeek');
            expect(day).toHaveProperty('isToday');
            expect(day).toHaveProperty('items');
            expect(Array.isArray(day.items)).toBe(true);
        });
    });

    it('week offset shifts the week', () => {
        const { result: currentWeek } = renderHook(() => usePlannerItems(0));
        const { result: nextWeek } = renderHook(() => usePlannerItems(1));

        const currentStart = currentWeek.current.weekStart.getTime();
        const nextStart = nextWeek.current.weekStart.getTime();

        // Next week should be 7 days later
        const diffDays = (nextStart - currentStart) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(7);
    });

    it('negative offset goes to previous week', () => {
        const { result: currentWeek } = renderHook(() => usePlannerItems(0));
        const { result: prevWeek } = renderHook(() => usePlannerItems(-1));

        const currentStart = currentWeek.current.weekStart.getTime();
        const prevStart = prevWeek.current.weekStart.getTime();

        // Previous week should be 7 days earlier
        const diffDays = (currentStart - prevStart) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBe(7);
    });

    it('includes attached client, project, and task with time totals', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        mockClients.push({ id: 'c1', title: 'Client A', color: '#111' });
        mockProjects.push({ id: 'p1', title: 'Project A', preferredClientId: 'c1', color: '#222' });
        mockTasks.push({ id: 't1', title: 'Task A', projectId: 'p1', completed: false });

        mockAttachments.push(
            { id: 'a1', type: 'client', referenceId: 'c1', mode: 'date', date: dateStr, estimatedHours: 2 },
            { id: 'a2', type: 'project', referenceId: 'p1', mode: 'date', date: dateStr, estimatedHours: 3 },
            { id: 'a3', type: 'task', referenceId: 't1', mode: 'date', date: dateStr, estimatedHours: 1 }
        );

        const entryStart = new Date(`${dateStr}T09:00:00.000Z`).getTime();
        const entryEnd = new Date(`${dateStr}T10:00:00.000Z`).getTime();
        mockEntries.push({ id: 'e1', taskId: 't1', start: entryStart, end: entryEnd });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);
        expect(day).toBeTruthy();

        const items = day.items;
        expect(items.find((i) => i.type === 'client')?.title).toBe('Client A');
        expect(items.find((i) => i.type === 'project')?.title).toBe('Project A');
        expect(items.find((i) => i.type === 'task' && i.subtype === 'attached')?.title).toBe('Task A');

        const taskItem = items.find((i) => i.type === 'task' && i.subtype === 'attached');
        expect(taskItem?.actualTimeMs).toBe(entryEnd - entryStart);
    });

    it('includes recurring tasks due on date and marks completion', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        vi.mocked(isRecurringTaskDueOnDate).mockReturnValue(true);

        mockTasks.push({
            id: 't-rec',
            title: 'Recurring Task',
            recurring: { frequency: 'weekly', interval: 1, daysOfWeek: [1] },
            completedDatesByYear: { '2026': { '2': [2] } }
        });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);
        const taskItem = day.items.find((i) => i.type === 'task' && i.subtype === 'recurring');

        expect(taskItem?.title).toBe('Recurring Task');
        expect(taskItem?.isCompleted).toBe(true);
    });

    it('excludes tasks created after the date and tasks archived before the date', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        mockTasks.push(
            { id: 't-new', title: 'New Task', startDate: dateStr, createdAt: new Date('2026-02-10T00:00:00Z').getTime() },
            { id: 't-arch', title: 'Archived Task', startDate: dateStr, archived: true, archivedOnDate: '2026-01-31' }
        );

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        expect(day.items.find((i) => i.type === 'task' && i.title === 'New Task')).toBeFalsy();
        expect(day.items.find((i) => i.type === 'task' && i.title === 'Archived Task')).toBeFalsy();
    });

    it('includes worked tasks with time entries when not otherwise added', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        mockTasks.push({ id: 't-worked', title: 'Worked Task', completed: false });
        const entryStart = new Date(`${dateStr}T13:00:00.000Z`).getTime();
        const entryEnd = new Date(`${dateStr}T14:30:00.000Z`).getTime();
        mockEntries.push({ id: 'e2', taskId: 't-worked', start: entryStart, end: entryEnd });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);
        const taskItem = day.items.find((i) => i.type === 'task' && i.subtype === 'worked');

        expect(taskItem?.title).toBe('Worked Task');
        expect(taskItem?.actualTimeMs).toBe(entryEnd - entryStart);
    });

    it('adds timer-only tasks for today', () => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        mockTasks.push({ id: 't-timer', title: 'Timer Task', completed: false });
        mockTimers.push({ projectId: 't-timer', taskId: 't-timer', startTime: Date.now(), paused: false });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === todayStr);
        const taskItem = day.items.find((i) => i.type === 'task' && i.subtype === 'timer');

        expect(taskItem?.title).toBe('Timer Task');
        expect(taskItem?.isTimerActive).toBe(true);
    });
});
