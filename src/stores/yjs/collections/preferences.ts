/**
 * Preferences helpers
 * 
 * Provides accessors for user preferences stored in a Y.Map
 */

import * as Y from 'yjs';
import type { Preferences } from '../types';

export interface PreferencesHelpers {

    /**
     * Get all preferences as an object
     */
    getAll(): Preferences;

    /**
     * Get a single preference value
     */
    get<K extends keyof Preferences>(key: K): Preferences[K] | undefined;

    /**
     * Set a single preference value
     */
    set<K extends keyof Preferences>(key: K, value: Preferences[K]): void;

    /**
     * Set multiple preferences at once
     */
    setAll(updates: Partial<Preferences>): void;

    /**
     * Reset preferences to defaults
     */
    reset(): void;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

const DEFAULT_PREFERENCES: Preferences = {
    currency: 'USD',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: 'HH:mm',
    theme: 'system',
    weekStartsOn: 0,
    showCompletedTasks: true,
    defaultBillable: false,
};

/**
 * Create preferences helpers for a Y.Map
 */
export function createPreferencesHelpers(preferences: Y.Map<string, Preferences[keyof Preferences]>): PreferencesHelpers {

    return {

        getAll(): Preferences {
            const result: Preferences = { ...DEFAULT_PREFERENCES };
            preferences.forEach((value, key) => {
                if (key in DEFAULT_PREFERENCES) {
                    (result as Record<string, unknown>)[key] = value;
                }
            });
            return result;
        },

        get<K extends keyof Preferences>(key: K): Preferences[K] | undefined {
            const value = preferences.get(key);
            if (value !== undefined) {
                return value as Preferences[K];
            }
            return DEFAULT_PREFERENCES[key];
        },

        set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
            preferences.set(key, value);
        },

        setAll(updates: Partial<Preferences>): void {
            for (const [key, value] of Object.entries(updates)) {
                if (value !== undefined) {
                    preferences.set(key, value);
                }
            }
        },

        reset(): void {
            // Clear all
            const keys: string[] = [];
            preferences.forEach((_, key) => keys.push(key));
            keys.forEach(key => preferences.delete(key));

            // Set defaults
            for (const [key, value] of Object.entries(DEFAULT_PREFERENCES)) {
                preferences.set(key, value);
            }
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            preferences.observe(handler);
            return () => preferences.unobserve(handler);
        },
    };
}
