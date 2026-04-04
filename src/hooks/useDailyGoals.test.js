// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useDailyGoals } from './useDailyGoals';
import { useYjs } from '@/contexts/YjsContext';
import { createTestYMap } from '@/test/yjs-test-helpers';

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }));

const mockUseYjs = useYjs;

describe('useDailyGoals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates and retrieves a goal by weekday', async () => {
        const mockMap = createTestYMap();
        mockUseYjs.mockReturnValue({ store: { dailyGoals: mockMap }, isReady: true });

        const { result } = renderHook(() => useDailyGoals());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.setGoal(1, { targetHours: 6, targetEarnings: 300 });
        });

        const goal = result.current.getGoalForWeekday(1);
        expect(goal).toBeTruthy();
        expect(goal.weekday).toBe(1);
        expect(goal.targetHours).toBe(6);
        expect(goal.targetEarnings).toBe(300);
    });

    it('retrieves a goal by date string', async () => {
        const mockMap = createTestYMap({
            '1': { id: '1', weekday: 1, targetHours: 4, targetEarnings: 200, createdAt: Date.now() },
        });
        mockUseYjs.mockReturnValue({ store: { dailyGoals: mockMap }, isReady: true });

        const { result } = renderHook(() => useDailyGoals());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const goal = result.current.getGoalForDate('2026-02-02');
        expect(goal?.weekday).toBe(1);
        expect(goal?.targetHours).toBe(4);
    });

    it('removes a goal by weekday', async () => {
        const mockMap = createTestYMap({
            '2': { id: '2', weekday: 2, targetHours: 5, targetEarnings: 0, createdAt: Date.now() },
        });
        mockUseYjs.mockReturnValue({ store: { dailyGoals: mockMap }, isReady: true });

        const { result } = renderHook(() => useDailyGoals());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.removeGoal(2);
        });

        expect(result.current.getGoalForWeekday(2)).toBeNull();
    });

    it('returns null for invalid weekday and empty date', async () => {
        const mockMap = createTestYMap({
            '0': { id: '0', weekday: 0, targetHours: 2, targetEarnings: 50, createdAt: Date.now() },
        });
        mockUseYjs.mockReturnValue({ store: { dailyGoals: mockMap }, isReady: true });

        const { result } = renderHook(() => useDailyGoals());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.getGoalForWeekday(-1)).toBeNull();
        expect(result.current.getGoalForWeekday(7)).toBeNull();
        expect(result.current.getGoalForDate('')).toBeNull();
    });

    it('updates an existing goal when setting the same weekday', async () => {
        const mockMap = createTestYMap({
            '3': { id: '3', weekday: 3, targetHours: 2, targetEarnings: 80, createdAt: Date.now() },
        });
        mockUseYjs.mockReturnValue({ store: { dailyGoals: mockMap }, isReady: true });

        const { result } = renderHook(() => useDailyGoals());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.setGoal(3, { targetHours: 5 });
        });

        const updated = result.current.getGoalForWeekday(3);
        expect(updated?.targetHours).toBe(5);
        expect(updated?.targetEarnings).toBe(80);
    });
});
