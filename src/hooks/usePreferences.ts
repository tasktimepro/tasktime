/**
 * usePreferences - React hook for user preferences
 * 
 * Provides reactive preferences and update functions
 */

import { useState, useEffect, useCallback } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import type { Preferences } from '@/stores/yjs/types';

const DEFAULT_PREFERENCES: Preferences = {
    currency: 'USD',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
    theme: 'system',
    defaultView: 'dashboard',
    weekStartsOn: 0, // Sunday
    showCompletedTasks: true,
    defaultBillable: true,
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
        setPreferences(prefs);
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
        store.preferences.set(key, value);
    }, [isReady, store]);

    // Update multiple preferences
    const updatePreferences = useCallback((updates: Partial<Preferences>) => {
        if (!isReady) return;
        
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                store.preferences.set(key, value);
            }
        });
    }, [isReady, store]);

    // Reset to defaults
    const resetPreferences = useCallback(() => {
        if (!isReady) return;
        
        Object.entries(DEFAULT_PREFERENCES).forEach(([key, value]) => {
            store.preferences.set(key, value);
        });
    }, [isReady, store]);

    return {
        preferences,
        isLoading,
        setPreference,
        updatePreferences,
        resetPreferences,
    };
}
