/**
 * usePlannerAttachments - React hook for planner attachments collection
 * 
 * Provides reactive planner attachment data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { PlannerAttachment } from '@/stores/yjs/types';

export function usePlannerAttachments() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<PlannerAttachment>(
        (store) => store.plannerAttachments,
        { collectionName: 'plannerAttachments' }
    );

    /**
     * Get attachments for a specific date.
     * Includes static items created on or before this date,
     * date-specific items, and weekday-matching items.
     */
    const getForDate = useCallback((dateStr: string): PlannerAttachment[] => {
        // Parse date correctly for local timezone
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const startOfDayMs = date.getTime();
        const endOfDayMs = startOfDayMs + 86400000 - 1; // End of day in ms
        const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

        return items.filter((a) => {
            if (a.mode === 'static') {
                // Static items appear from their creation date forward
                return a.createdAt <= endOfDayMs;
            }
            if (a.mode === 'weekday') {
                // Weekday items appear on matching days of the week
                // Include if created on or before the end of this day
                return a.weekday === dayOfWeek && a.createdAt <= endOfDayMs;
            }
            return a.date === dateStr;
        });
    }, [items]);

    /**
     * Get all static (pinned) attachments
     */
    const staticAttachments = useMemo(
        () => items.filter((a) => a.mode === 'static'),
        [items]
    );

    /**
     * Create a planner attachment with auto-generated fields
     */
    const createAttachment = useCallback((
        data: Omit<PlannerAttachment, 'id' | 'sortOrder'> & { createdAt?: number }
    ): PlannerAttachment => {
        // Calculate next sortOrder
        const maxSortOrder = items.reduce((max, a) => Math.max(max, a.sortOrder), 0);

        return create({
            ...data,
            sortOrder: maxSortOrder + 1,
            createdAt: data.createdAt ?? Date.now(),
        } as Omit<PlannerAttachment, 'id'>);
    }, [items, create]);

    /**
     * Delete all attachments for a specific reference (e.g., when entity is deleted)
     */
    const deleteByReference = useCallback((referenceId: string): number => {
        const toDelete = items.filter((a) => a.referenceId === referenceId);
        toDelete.forEach((a) => remove(a.id));
        return toDelete.length;
    }, [items, remove]);

    /**
     * Check if an entity is already attached (to prevent duplicates)
     */
    const isAttached = useCallback((
        type: PlannerAttachment['type'],
        referenceId: string,
        options?: { date?: string; weekday?: number }
    ): boolean => {
        return items.some((a) => {
            if (a.type !== type || a.referenceId !== referenceId) return false;
            if (options?.date && a.mode === 'date') return a.date === options.date;
            if (options?.weekday !== undefined && a.mode === 'weekday') return a.weekday === options.weekday;
            if (!options?.date && !options?.weekday && a.mode === 'static') return true;
            return false;
        });
    }, [items]);

    return {
        // Data
        attachments: items,
        staticAttachments,
        isLoading,

        // Queries
        getAttachment: get,
        getForDate,
        isAttached,

        // Mutations
        createAttachment,
        updateAttachment: update,
        deleteAttachment: remove,
        deleteByReference,
    };
}
