/**
 * useDailyGoals - React hook for weekday-based daily goals
 * 
 * Stores at most one goal per weekday (0-6).
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { DailyGoal } from '@/stores/yjs/types';

const WEEKDAY_COUNT = 7;

export function useDailyGoals() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<DailyGoal>(
        (store) => store.dailyGoals
    );

    const goalsByWeekday = useMemo(() => {
        const map = new Map<number, DailyGoal>();
        items.forEach((goal) => {
            if (typeof goal.weekday === 'number') {
                map.set(goal.weekday, goal);
            }
        });
        return map;
    }, [items]);

    const getGoalForWeekday = useCallback((weekday: number): DailyGoal | null => {
        if (weekday < 0 || weekday >= WEEKDAY_COUNT) return null;
        return goalsByWeekday.get(weekday) || null;
    }, [goalsByWeekday]);

    const getGoalForDate = useCallback((dateStr: string): DailyGoal | null => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const weekday = date.getDay();
        return goalsByWeekday.get(weekday) || null;
    }, [goalsByWeekday]);

    const setGoal = useCallback((weekday: number, goal: Partial<DailyGoal>): DailyGoal => {
        const id = String(weekday);
        const existing = get(id);

        if (existing) {
            return update(id, {
                ...goal,
                weekday,
            }) as DailyGoal;
        }

        return create({
            id,
            weekday,
            targetHours: goal.targetHours ?? null,
            targetEarnings: goal.targetEarnings ?? null,
            createdAt: Date.now(),
        });
    }, [get, update, create]);

    const removeGoal = useCallback((weekday: number): boolean => {
        const id = String(weekday);
        return remove(id);
    }, [remove]);

    return {
        goals: items,
        isLoading,
        getGoalForWeekday,
        getGoalForDate,
        setGoal,
        removeGoal,
    };
}
