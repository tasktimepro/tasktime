// @ts-nocheck
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useWeeklyGoals } from './useWeeklyGoals';
import { usePreferences } from './usePreferences';

vi.mock('./usePreferences', () => ({ usePreferences: vi.fn() }));

const mockUsePreferences = usePreferences;

describe('useWeeklyGoals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses defaults when preferences are missing', () => {
        mockUsePreferences.mockReturnValue({
            preferences: {},
            updatePreferences: vi.fn(),
        });

        const { result } = renderHook(() => useWeeklyGoals());

        expect(result.current.weeklyGoals.targetHours).toBeNull();
        expect(result.current.weeklyGoals.targetEarnings).toBeNull();
    });

    it('sets weekly goals and merges updates', () => {
        const updatePreferences = vi.fn();
        mockUsePreferences.mockReturnValue({
            preferences: {
                weeklyGoalTargetHours: 10,
                weeklyGoalTargetEarnings: 200,
            },
            updatePreferences,
        });

        const { result } = renderHook(() => useWeeklyGoals());

        act(() => {
            result.current.setWeeklyGoals({
                targetHours: 40,
                targetEarnings: 500,
            });
        });

        expect(updatePreferences).toHaveBeenCalledWith({
            weeklyGoalTargetHours: 40,
            weeklyGoalTargetEarnings: 500,
        });
    });

    it('clears weekly goals', () => {
        const updatePreferences = vi.fn();
        mockUsePreferences.mockReturnValue({
            preferences: {
                weeklyGoalTargetHours: 12,
                weeklyGoalTargetEarnings: 300,
            },
            updatePreferences,
        });

        const { result } = renderHook(() => useWeeklyGoals());

        act(() => {
            result.current.clearWeeklyGoals();
        });

        expect(updatePreferences).toHaveBeenCalledWith({
            weeklyGoalTargetHours: null,
            weeklyGoalTargetEarnings: null,
        });
    });

    it('marks hasGoals when either value is set and merges partial updates', () => {
        const updatePreferences = vi.fn();
        mockUsePreferences.mockReturnValue({
            preferences: {
                weeklyGoalTargetHours: 8,
                weeklyGoalTargetEarnings: null,
            },
            updatePreferences,
        });

        const { result } = renderHook(() => useWeeklyGoals());

        expect(result.current.hasGoals).toBe(true);

        act(() => {
            result.current.setWeeklyGoals({ targetEarnings: 400 });
        });

        expect(updatePreferences).toHaveBeenCalledWith({
            weeklyGoalTargetHours: 8,
            weeklyGoalTargetEarnings: 400,
        });
    });
});
