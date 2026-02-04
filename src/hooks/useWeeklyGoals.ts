/**
 * useWeeklyGoals - React hook for weekly goal settings
 * 
 * Stores a single weekly goal configuration in preferences.
 */

import { useMemo, useCallback } from 'react';
import { usePreferences } from './usePreferences';

export interface WeeklyGoalSettings {
    targetHours: number | null;
    targetEarnings: number | null;
}

const DEFAULT_WEEKLY_GOALS: WeeklyGoalSettings = {
    targetHours: null,
    targetEarnings: null,
};

export function useWeeklyGoals() {
    const { preferences, updatePreferences } = usePreferences();

    const weeklyGoals = useMemo<WeeklyGoalSettings>(() => {
        return {
            targetHours: typeof preferences.weeklyGoalTargetHours === 'number'
                ? preferences.weeklyGoalTargetHours
                : null,
            targetEarnings: typeof preferences.weeklyGoalTargetEarnings === 'number'
                ? preferences.weeklyGoalTargetEarnings
                : null,
        };
    }, [preferences]);

    const hasGoals = useMemo(() => {
        return typeof weeklyGoals.targetHours === 'number'
            || typeof weeklyGoals.targetEarnings === 'number';
    }, [weeklyGoals]);

    const setWeeklyGoals = useCallback((updates: Partial<WeeklyGoalSettings>) => {
        updatePreferences({
            weeklyGoalTargetHours: updates.targetHours ?? weeklyGoals.targetHours ?? null,
            weeklyGoalTargetEarnings: updates.targetEarnings ?? weeklyGoals.targetEarnings ?? null,
        });
    }, [updatePreferences, weeklyGoals]);

    const clearWeeklyGoals = useCallback(() => {
        updatePreferences({
            weeklyGoalTargetHours: null,
            weeklyGoalTargetEarnings: null,
        });
    }, [updatePreferences]);

    return {
        weeklyGoals,
        hasGoals,
        setWeeklyGoals,
        clearWeeklyGoals,
    };
}
