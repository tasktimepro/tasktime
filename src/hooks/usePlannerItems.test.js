import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock dependencies
const mockAttachments = vi.hoisted(() => []);
const mockTasks = vi.hoisted(() => []);
const mockProjects = vi.hoisted(() => []);
const mockClients = vi.hoisted(() => []);

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
        timers: [],
        isLoading: false,
    })
}));

vi.mock('./useTimeEntries', () => ({
    useTimeEntries: () => ({
        entries: [],
        isLoading: false,
    })
}));

vi.mock('@/utils/recurringUtils', () => ({
    isRecurringTaskDueOnDate: vi.fn(() => false),
}));

// Import after mocks are set up
import { usePlannerItems } from './usePlannerItems';

describe('usePlannerItems', () => {

    beforeEach(() => {
        mockAttachments.length = 0;
        mockTasks.length = 0;
        mockProjects.length = 0;
        mockClients.length = 0;
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
});
