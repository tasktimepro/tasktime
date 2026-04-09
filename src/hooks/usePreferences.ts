/**
 * usePreferences - React hook for user preferences
 * 
 * Provides reactive preferences and update functions
 */

import { useState, useEffect, useCallback } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { markMeaningfulActivity } from '@/utils/usageMetrics';
import type { Preferences } from '@/stores/yjs/types';
import { validatePreferencesRecord } from '@/stores/yjs/validation';

const DEFAULT_PREFERENCES: Preferences = {
    currency: 'EUR',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
    theme: 'system',
    defaultView: 'dashboard',
    weekStartsOn: 1, // Monday
    autoHideTotalsOnRevisit: false,
    showCompletedTasks: true,
    defaultBillable: true,
    projectSort: 'createdAt',
    clientSort: 'createdAt',
    autoSyncEnabled: false,
    autoSyncMode: 'backup',
    weeklyGoalTargetHours: null,
    weeklyGoalTargetEarnings: null,
};

export function usePreferences() {
    const { store, isReady } = useYjs();
    const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
    const [isLoading, setIsLoading] = useState(true);

    // Sync from Yjs
    const syncPreferences = useCallback(() => {
        if (!isReady) return;

        const prefs: Preferences = { ...DEFAULT_PREFERENCES };
        store.preferences.forEach((value, key) => {
            (prefs as Record<string, unknown>)[key] = value;
        });
        setPreferences(validatePreferencesRecord(prefs as Record<string, unknown>, 'sync preferences'));
        setIsLoading(false);
    }, [isReady, store]);

    // Initial load and subscribe
    useEffect(() => {
        if (!isReady) return;

        syncPreferences();

        const handler = () => syncPreferences();
        store.preferences.observe(handler);

        return () => store.preferences.unobserve(handler);
    }, [isReady, store, syncPreferences]);

    // Update a single preference
    const setPreference = useCallback(<K extends keyof Preferences>(
        key: K, 
        value: Preferences[K]
    ) => {
        if (!isReady) return;
        const nextPreferences = validatePreferencesRecord({
            ...preferences,
            [key]: value,
        } as Record<string, unknown>, `set preference ${String(key)}`);
        store.preferences.set(key, nextPreferences[key]);
        markMeaningfulActivity();
    }, [isReady, preferences, store]);

    // Update multiple preferences
    const updatePreferences = useCallback((updates: Partial<Preferences>) => {
        if (!isReady) return;

        const nextPreferences = validatePreferencesRecord({
            ...preferences,
            ...updates,
        } as Record<string, unknown>, 'update preferences');
        
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                store.preferences.set(key, (nextPreferences as Record<string, unknown>)[key]);
            }
        });

        markMeaningfulActivity();
    }, [isReady, preferences, store]);

    // Reset to defaults
    const resetPreferences = useCallback(() => {
        if (!isReady) return;
        
        const nextPreferences = validatePreferencesRecord(DEFAULT_PREFERENCES as Record<string, unknown>, 'reset preferences');

        Object.entries(nextPreferences).forEach(([key, value]) => {
            store.preferences.set(key, value);
        });

        markMeaningfulActivity();
    }, [isReady, store]);

    return {
        preferences,
        isLoading,
        setPreference,
        updatePreferences,
        resetPreferences,
    };
}
