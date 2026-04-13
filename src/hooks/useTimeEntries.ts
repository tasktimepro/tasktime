/**
 * useTimeEntries - React hook for time entries (multi-doc aware)
 * 
 * Handles active entries and on-demand loading of historical entries by year
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import type { TimeEntry } from '@/stores/yjs/types';
import { generateId } from '@/utils/idUtils';
import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { objectToYMap, updateEntityFields } from '@/stores/yjs/entityUtils';
import { readValidatedEntity, validateCollectionEntity } from '@/stores/yjs/validation';

export interface UseTimeEntriesOptions {
    /** Filter to a specific task */
    taskId?: string;
    /** Start date filter (timestamp) */
    startDate?: number;
    /** End date filter (timestamp) */
    endDate?: number;
    /** Project ID to filter by (via tasks) */
    projectId?: string;
}

export function useTimeEntries(options: UseTimeEntriesOptions = {}) {
    const { store, isReady, loadEntriesForYear, getAvailableYears } = useYjs();
    
    // State
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingYears, setLoadingYears] = useState<Set<number>>(new Set());
    const [loadedYears, setLoadedYears] = useState<Set<number>>(new Set());

    // Sync entries from store
    const syncEntries = useCallback(() => {
        if (!isReady) return;

        const allEntries = store.getAllTimeEntries();
        
        // Apply filters
        let filtered = allEntries;
        
        if (options.taskId) {
            filtered = filtered.filter(e => e.taskId === options.taskId);
        }
        
        if (options.startDate !== undefined) {
            filtered = filtered.filter((e) => {
                const entryEnd = typeof e.end === 'number' ? e.end : e.start;
                return entryEnd >= options.startDate!;
            });
        }
        
        if (options.endDate !== undefined) {
            filtered = filtered.filter(e => e.start <= options.endDate!);
        }
        
        // Sort by start time descending (most recent first)
        filtered.sort((a, b) => b.start - a.start);
        
        setEntries(filtered);
        setIsLoading(false);
    }, [isReady, store, options.taskId, options.startDate, options.endDate]);

    // Initial load and subscribe to active entries
    useEffect(() => {
        if (!isReady) return;

        syncEntries();

        // Subscribe to active entries
        const handler = () => syncEntries();
        store.activeTimeEntries.observeDeep(handler);

        return () => store.activeTimeEntries.unobserveDeep(handler);
    }, [isReady, store, syncEntries]);

    // Load entries for a specific year
    const loadYear = useCallback(async (year: number) => {
        if (loadingYears.has(year) || loadedYears.has(year)) return;

        setLoadingYears(prev => new Set(prev).add(year));
        
        try {
            await loadEntriesForYear(year);
            setLoadedYears(prev => new Set(prev).add(year));
            syncEntries();
        } finally {
            setLoadingYears(prev => {
                const next = new Set(prev);
                next.delete(year);
                return next;
            });
        }
    }, [loadEntriesForYear, loadingYears, loadedYears, syncEntries]);

    // Auto-load years for date range
    useEffect(() => {
        if (!isReady || options.startDate === undefined || options.endDate === undefined) return;

        const startYear = new Date(options.startDate).getFullYear();
        const endYear = new Date(options.endDate).getFullYear();

        for (let year = startYear; year <= endYear; year++) {
            if (!store.isYearLoaded(year) && !loadingYears.has(year) && !loadedYears.has(year)) {
                loadYear(year);
            }
        }
    }, [isReady, options.startDate, options.endDate, store, loadingYears, loadedYears, loadYear]);

    // CRUD operations
    const createEntry = useCallback((data: Omit<TimeEntry, 'id'>): TimeEntry => {
        if (!isReady) throw new Error('Store not ready');
        const now = Date.now();
        const createdAt = typeof data.createdAt === 'number' ? data.createdAt : now;
        const updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : now;
        
        const entry = validateCollectionEntity<TimeEntry>('timeEntries', {
            id: generateId(),
            ...data,
            createdAt,
            updatedAt,
        }, 'create time entry');
        const entityMap = objectToYMap(entry as unknown as Record<string, unknown>);
        (store.activeTimeEntries as any).set(entry.id, entityMap);
        markMeaningfulActivity();
        return entry;
    }, [isReady, store]);

    const updateEntry = useCallback((id: string, updates: Partial<TimeEntry>): TimeEntry | undefined => {
        if (!isReady) return undefined;
        
        // Check active entries first
        const activeEntry = readValidatedEntity<TimeEntry>('timeEntries', store.activeTimeEntries.get(id), `update time entry ${id}`);
        if (activeEntry) {
            const updatesWithTimestamp = { ...updates, updatedAt: Date.now() };
            const merged = { ...activeEntry, ...updatesWithTimestamp };
            const validated = validateCollectionEntity<TimeEntry>('timeEntries', merged, `update time entry ${id}`);

            const result = updateEntityFields(store.activeTimeEntries as any, id, updatesWithTimestamp as Record<string, unknown>);
            if (!result) {
                const entityMap = objectToYMap(validated as unknown as Record<string, unknown>);
                (store.activeTimeEntries as any).set(id, entityMap);
            }
            markMeaningfulActivity();
            return validated;
        }
        
        // Note: Updating archived entries would require loading the year doc
        // For now, we only support updating active entries
        return undefined;
    }, [isReady, store]);

    const deleteEntry = useCallback((id: string): boolean => {
        if (!isReady) return false;
        if (!store.activeTimeEntries.has(id)) return false;
        store.activeTimeEntries.delete(id);
        markMeaningfulActivity();
        return true;
    }, [isReady, store]);

    // Get entries for a specific task
    const getEntriesForTask = useCallback((taskId: string): TimeEntry[] => {
        return entries.filter(e => e.taskId === taskId);
    }, [entries]);

    // Get total time for a task
    const getTotalTimeForTask = useCallback((taskId: string): number => {
        return getEntriesForTask(taskId).reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [getEntriesForTask]);

    // Stats
    const totalTime = useMemo(() => {
        return entries.reduce((sum, e) => sum + (e.end - e.start), 0);
    }, [entries]);

    return {
        // Data
        entries,
        isLoading,
        isLoadingMore: loadingYears.size > 0,
        totalTime,
        
        // CRUD
        createEntry,
        updateEntry,
        deleteEntry,
        
        // Helpers
        getEntriesForTask,
        getTotalTimeForTask,
        loadYear,
        getAvailableYears,
    };
}
