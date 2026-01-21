/**
 * Time entry collection helpers
 * 
 * Provides CRUD operations for time entries.
 * Note: Time entries span multiple documents (active + year archives)
 * This helper works with the YjsStore to handle multi-doc complexity.
 */

import * as Y from 'yjs';
import type { TimeEntry } from '../types';
import type { YjsStore } from '../YjsStore';
import { generateId } from '@/utils/idUtils';

export interface TimeEntryHelpers {

    /**
     * Get all entries from currently loaded documents
     */
    getAll(): TimeEntry[];

    /**
     * Get entries for a specific task
     */
    getByTask(taskId: string): TimeEntry[];

    /**
     * Get entries for multiple tasks
     */
    getByTasks(taskIds: string[]): TimeEntry[];

    /**
     * Get entries in a date range (loads year docs as needed)
     */
    getByDateRange(startDate: number, endDate: number): Promise<TimeEntry[]>;

    /**
     * Get a single entry by ID (searches all loaded docs)
     */
    get(id: string): TimeEntry | undefined;

    /**
     * Create a new time entry
     */
    create(data: Omit<TimeEntry, 'id'>): TimeEntry;

    /**
     * Update an entry
     */
    update(id: string, updates: Partial<TimeEntry>): TimeEntry | undefined;

    /**
     * Delete an entry
     */
    delete(id: string): boolean;

    /**
     * Get total duration for entries
     */
    getTotalDuration(entries: TimeEntry[]): number;

    /**
     * Observe active entries (most common use case)
     */
    observe(callback: () => void): () => void;
}

/**
 * Create time entry helpers for a YjsStore
 */
export function createTimeEntryHelpers(store: YjsStore): TimeEntryHelpers {

    /**
     * Find which Y.Map contains an entry
     */
    const findDocForEntry = (id: string): Y.Map<string, TimeEntry> | null => {
        // Check active first (most common)
        if (store.activeTimeEntries.has(id)) {
            return store.activeTimeEntries;
        }

        // Search in other loaded entries
        const allEntries = store.getAllTimeEntries();
        const entry = allEntries.find(e => e.id === id);
        if (entry) {
            // The entry exists in some loaded doc, but we need to find which one
            // For now, return activeTimeEntries as fallback - in practice, updates
            // to archived entries should be rare
            return store.activeTimeEntries;
        }

        return null;
    };

    return {

        getAll(): TimeEntry[] {
            return store.getAllTimeEntries();
        },

        getByTask(taskId: string): TimeEntry[] {
            return store.getAllTimeEntries().filter(e => e.taskId === taskId);
        },

        getByTasks(taskIds: string[]): TimeEntry[] {
            const taskIdSet = new Set(taskIds);
            return store.getAllTimeEntries().filter(e => taskIdSet.has(e.taskId));
        },

        async getByDateRange(startDate: number, endDate: number): Promise<TimeEntry[]> {
            const startYear = new Date(startDate).getFullYear();
            const endYear = new Date(endDate).getFullYear();

            // Load needed year docs
            for (let year = startYear; year <= endYear; year++) {
                if (!store.isYearLoaded(year)) {
                    await store.loadEntriesForYear(year);
                }
            }

            return store.getAllTimeEntries().filter(
                e => e.start >= startDate && e.start <= endDate
            );
        },

        get(id: string): TimeEntry | undefined {
            // Check active first (most common)
            const active = store.activeTimeEntries.get(id);
            if (active) return active;

            // Check all loaded entries
            return store.getAllTimeEntries().find(e => e.id === id);
        },

        create(data: Omit<TimeEntry, 'id'>): TimeEntry {
            const entry: TimeEntry = {
                id: generateId(),
                ...data,
            };

            // New entries always go to active (will be archived later if old)
            store.activeTimeEntries.set(entry.id, entry);
            return entry;
        },

        update(id: string, updates: Partial<TimeEntry>): TimeEntry | undefined {
            // Find entry in active first
            const activeEntry = store.activeTimeEntries.get(id);
            if (activeEntry) {
                const updated = { ...activeEntry, ...updates };
                store.activeTimeEntries.set(id, updated);
                return updated;
            }

            // Search all loaded entries
            const allEntries = store.getAllTimeEntries();
            const existing = allEntries.find(e => e.id === id);
            if (!existing) return undefined;

            // For archived entries, we update in activeTimeEntries
            // (the archival process will handle it later)
            const updated = { ...existing, ...updates };
            store.activeTimeEntries.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            // Try active first
            if (store.activeTimeEntries.has(id)) {
                return store.activeTimeEntries.delete(id);
            }

            // Note: Deleting from archived docs requires loading them
            // For now, we only support deleting from active
            console.warn(`[TimeEntryHelpers] Cannot delete archived entry ${id} without loading archive`);
            return false;
        },

        getTotalDuration(entries: TimeEntry[]): number {
            return entries.reduce((total, entry) => {
                return total + (entry.end - entry.start);
            }, 0);
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            store.activeTimeEntries.observe(handler);
            return () => store.activeTimeEntries.unobserve(handler);
        },
    };
}
