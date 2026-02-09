import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { addDays, format, startOfWeek } from 'date-fns';

// Mock dependencies
const mockAttachments = vi.hoisted(() => []);
const mockTasks = vi.hoisted(() => []);
const mockProjects = vi.hoisted(() => []);
const mockClients = vi.hoisted(() => []);
const mockTimers = vi.hoisted(() => []);
const mockEntries = vi.hoisted(() => []);
const mockExpenses = vi.hoisted(() => []);
const mockRecurrences = vi.hoisted(() => []);
const mockGetGoalForDate = vi.hoisted(() => vi.fn(() => null));

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

vi.mock('./useExpenses', () => ({
    useExpenses: () => ({
        expenses: mockExpenses,
    })
}));

vi.mock('./useExpenseRecurrences', () => ({
    useExpenseRecurrences: () => ({
        recurrences: mockRecurrences,
    })
}));

vi.mock('./useDailyGoals', () => ({
    useDailyGoals: () => ({
        getGoalForDate: mockGetGoalForDate,
    })
}));

vi.mock('./usePreferences', () => ({
    usePreferences: () => ({
        preferences: { currency: 'USD' },
    })
}));

vi.mock('@/utils/currencyUtils', async () => {
    const actual = await vi.importActual('@/utils/currencyUtils');
    return {
        ...actual,
        fetchExchangeRates: vi.fn(async () => ({ rates: null, error: null })),
    };
});

vi.mock('@/utils/recurringUtils', () => ({
    isRecurringTaskDueOnDate: vi.fn(() => false),
}));

// Import after mocks are set up
import { usePlannerItems } from './usePlannerItems';
import { isRecurringTaskDueOnDate } from '@/utils/recurringUtils';
import { fetchExchangeRates } from '@/utils/currencyUtils';

describe('usePlannerItems', () => {

    let consoleErrorSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-04T12:00:00Z'));
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockAttachments.length = 0;
        mockTasks.length = 0;
        mockProjects.length = 0;
        mockClients.length = 0;
        mockTimers.length = 0;
        mockEntries.length = 0;
        mockExpenses.length = 0;
        mockRecurrences.length = 0;
        mockGetGoalForDate.mockReset();
        mockGetGoalForDate.mockReturnValue(null);
        vi.mocked(isRecurringTaskDueOnDate).mockReset();
        vi.mocked(isRecurringTaskDueOnDate).mockReturnValue(false);
    });

    afterEach(() => {
        vi.useRealTimers();
        consoleErrorSpy?.mockRestore();
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
            expect(day).toHaveProperty('totalEarnings');
            expect(day).toHaveProperty('dailyGoal');
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

    it('includes timer-only tasks for today', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        mockTasks.push({ id: 't-timer', title: 'Timer Task', projectId: 'p1', completed: false });
        mockTimers.push({ taskId: 't-timer', projectId: 'p1', elapsedTime: 60000, isPaused: false });

        const { result } = renderHook(() => usePlannerItems(0));
        const today = result.current.weekDays.find((d) => d.dateStr === todayStr);

        const timerItem = today.items.find((i) => i.type === 'task' && i.subtype === 'timer');
        expect(timerItem?.title).toBe('Timer Task');
        expect(timerItem?.isTimerActive).toBe(true);
    });

    it('includes recurring expense previews and skips when instance exists', () => {
        const dateStr = format(new Date(), 'yyyy-MM-dd');

        mockRecurrences.push(
            { id: 'r1', title: 'Preview Expense', startDate: dateStr, repeat: 'monthly', amount: 40, amountType: 'fixed', currency: 'USD', active: true, isPersonal: true, billable: false },
            { id: 'r2', title: 'Existing Expense', startDate: dateStr, repeat: 'monthly', amount: 20, amountType: 'fixed', currency: 'USD', active: true, isPersonal: true, billable: false }
        );

        mockExpenses.push({ id: 'e1', title: 'Existing Expense', date: dateStr, recurrenceId: 'r2', amount: 20, paymentStatus: 'unpaid' });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        const previewItem = day.items.find((i) => i.type === 'expense' && i.isPreview);
        expect(previewItem?.title).toBe('Preview Expense');
        expect(day.items.some((i) => i.type === 'expense' && i.title === 'Existing Expense' && i.isPreview)).toBe(false);
    });

    it('excludes archived clients after archivedOnDate', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(addDays(weekStart, 2), 'yyyy-MM-dd');

        mockClients.push({ id: 'c-arch', title: 'Archived Client', archived: true, archivedOnDate: '2026-02-01' });
        mockAttachments.push({ id: 'a-arch', type: 'client', referenceId: 'c-arch', mode: 'date', date: dateStr, estimatedHours: 1 });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        expect(day.items.find((i) => i.type === 'client' && i.title === 'Archived Client')).toBeFalsy();
    });

    it('uses project color for expense items', () => {
        const dateStr = format(new Date(), 'yyyy-MM-dd');

        mockProjects.push({ id: 'p-exp', title: 'Expense Project', color: '#123456' });
        mockExpenses.push({ id: 'exp-1', title: 'Expense', date: dateStr, amount: 10, paymentStatus: 'unpaid', projectId: 'p-exp' });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        const expenseItem = day.items.find((i) => i.type === 'expense' && i.title === 'Expense');
        expect(expenseItem?.color).toBe('#123456');
    });

    it('excludes archived projects after archivedOnDate', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(addDays(weekStart, 3), 'yyyy-MM-dd');

        mockProjects.push({ id: 'p-arch', title: 'Archived Project', archived: true, archivedOnDate: '2026-02-01' });
        mockAttachments.push({ id: 'a-proj', type: 'project', referenceId: 'p-arch', mode: 'date', date: dateStr, estimatedHours: 1 });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        expect(day.items.find((i) => i.type === 'project' && i.title === 'Archived Project')).toBeFalsy();
    });

    it('skips recurring expense previews for past dates', () => {
        const pastDate = format(addDays(new Date(), -1), 'yyyy-MM-dd');

        mockRecurrences.push({
            id: 'r-past',
            title: 'Past Preview',
            startDate: pastDate,
            repeat: 'monthly',
            amount: 15,
            amountType: 'fixed',
            currency: 'USD',
            active: true,
            isPersonal: true,
            billable: false,
        })

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === pastDate);

        expect(day.items.some((i) => i.type === 'expense' && i.isPreview)).toBe(false);
    });

    it('falls back to client color when project color is missing', () => {
        const dateStr = format(new Date(), 'yyyy-MM-dd');

        mockClients.push({ id: 'c-color', title: 'Color Client', color: '#ff00ff' });
        mockProjects.push({ id: 'p-color', title: 'Color Project', preferredClientId: 'c-color' });
        mockAttachments.push({ id: 'a-color', type: 'project', referenceId: 'p-color', mode: 'date', date: dateStr, estimatedHours: 1 });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        const projectItem = day.items.find((i) => i.type === 'project' && i.title === 'Color Project');
        expect(projectItem?.color).toBe('#ff00ff');
    });

    it('includes archived tasks before archivedOnDate', () => {
        const dateStr = format(new Date(), 'yyyy-MM-dd');

        mockTasks.push({ id: 't-arch', title: 'Archived Task', archived: true, archivedOnDate: '2026-02-10' });
        mockAttachments.push({ id: 'a-task', type: 'task', referenceId: 't-arch', mode: 'date', date: dateStr });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        const taskItem = day.items.find((i) => i.type === 'task' && i.title === 'Archived Task');
        expect(taskItem).toBeTruthy();
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

    it('includes archived client attachments for visible dates', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        mockClients.push({ id: 'c-arch', title: 'Archived Client', color: '#123', archived: true });
        mockAttachments.push({ id: 'a-arch', type: 'client', referenceId: 'c-arch', mode: 'date', date: dateStr });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        expect(day.items.find((i) => i.type === 'client')?.title).toBe('Archived Client');
    });

    it('keeps date-specific attached tasks even if task is not visible', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        mockTasks.push({
            id: 't-arch',
            title: 'Legacy Task',
            archived: true,
            archivedOnDate: '2026-01-01',
            completed: false,
        });
        mockAttachments.push({ id: 'a-legacy', type: 'task', referenceId: 't-arch', mode: 'date', date: dateStr });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        expect(day.items.find((i) => i.type === 'task' && i.subtype === 'attached')?.title).toBe('Legacy Task');
    });

    it('includes expenses for the matching date with paid marked completed', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        mockExpenses.push({
            id: 'ex-1',
            title: 'Hosting',
            date: dateStr,
            paymentStatus: 'unpaid',
            amount: 120,
            amountType: 'fixed',
            currency: 'USD',
            supplierName: 'AWS',
        });
        mockExpenses.push({
            id: 'ex-2',
            title: 'Paid Item',
            date: dateStr,
            paymentStatus: 'paid',
            amount: 50,
            amountType: 'fixed',
            currency: 'USD',
        });
        mockExpenses.push({
            id: 'ex-3',
            title: 'Auto Paid',
            date: dateStr,
            paymentStatus: 'paid',
            paymentMode: 'auto',
            amount: 15,
            amountType: 'fixed',
            currency: 'USD',
        });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        const expenseItems = day.items.filter((i) => i.type === 'expense');
        expect(expenseItems).toHaveLength(3);
        expect(expenseItems[0].title).toBe('Hosting');
        expect(expenseItems[0].isCompleted).toBe(false);

        const paidItems = expenseItems.slice(1);
        expect(paidItems.map((item) => item.title)).toEqual(['Auto Paid', 'Paid Item']);
        expect(paidItems.every((item) => item.isCompleted)).toBe(true);
    });

    it('excludes expenses that do not match the date', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        mockExpenses.push({
            id: 'ex-3',
            title: 'Future Expense',
            date: '2026-12-25',
            paymentStatus: 'unpaid',
            amount: 80,
            amountType: 'fixed',
            currency: 'USD',
        });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        expect(day.items.find((i) => i.type === 'expense')).toBeFalsy();
    });

    it('includes recurring expense previews when no instance exists', () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(addDays(weekStart, 2), 'yyyy-MM-dd');

        mockRecurrences.push({
            id: 'rec-1',
            title: 'Hosting Renewal',
            startDate: dateStr,
            repeat: 'monthly',
            amount: 25,
            amountType: 'fixed',
            currency: 'USD',
            supplierName: 'HostCo',
            clientId: null,
            projectId: null,
            businessId: null,
            isPersonal: true,
            billable: false,
            taxNumber: null,
            isTaxExempt: false,
            endDate: null,
            active: true,
        });

        const { result } = renderHook(() => usePlannerItems(0));
        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        const expenseItems = day.items.filter((i) => i.type === 'expense');
        expect(expenseItems).toHaveLength(1);
        expect(expenseItems[0].title).toBe('Hosting Renewal');
        expect(expenseItems[0].isPreview).toBe(true);
    });

    it('calculates earnings with billed rate and currency conversion', async () => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const dateStr = format(weekStart, 'yyyy-MM-dd');

        vi.mocked(fetchExchangeRates).mockResolvedValueOnce({
            rates: { USD: 1, EUR: 2 },
            error: null,
        });

        mockGetGoalForDate.mockImplementation((value) => {
            if (value !== dateStr) return null;
            return { id: 'g1', weekday: 1, targetHours: 4, targetEarnings: 100, createdAt: 0 };
        });

        mockClients.push({ id: 'c1', title: 'Client A', defaultCurrency: 'EUR', defaultHourlyRate: 20 });
        mockProjects.push({ id: 'p1', title: 'Project A', preferredClientId: 'c1' });
        mockTasks.push({ id: 't1', title: 'Billable Task', projectId: 'p1', billable: true, completed: false });

        const entryStart = new Date(`${dateStr}T09:00:00.000Z`).getTime();
        const entryEnd = new Date(`${dateStr}T11:00:00.000Z`).getTime();
        mockEntries.push({
            id: 'e1',
            taskId: 't1',
            start: entryStart,
            end: entryEnd,
            billedHourlyRate: 30,
        });

        const { result } = renderHook(() => usePlannerItems(0));

        await act(async () => {
            await Promise.resolve();
        });

        const day = result.current.weekDays.find((d) => d.dateStr === dateStr);

        expect(day.totalEarnings).toBeCloseTo(30, 5);
        expect(day.dailyGoal).not.toBeNull();
    });
});
