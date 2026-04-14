/**
 * PlannerAttachment collection helpers
 * 
 * Provides CRUD operations for planner attachments (pinned clients/projects/tasks)
 */

import * as Y from 'yjs';
import type { PlannerAttachment } from '../types';
import { readEntity } from '../entityUtils';
import { generateId } from '@/utils/idUtils';

/**
 * Remove all planner attachments whose referenceId matches the given entity ID.
 * Operates directly on the Y.Map, handling both Y.Map and plain-object storage formats.
 */
export function cleanupAttachmentsForEntity(
    attachmentsMap: Y.Map<string, unknown>,
    referenceId: string,
): number {

    const toDelete: string[] = [];

    attachmentsMap.forEach((value, key) => {
        const entity = readEntity<{ referenceId?: string }>(value);

        if (entity?.referenceId === referenceId) {
            toDelete.push(key);
        }
    });

    toDelete.forEach((key) => attachmentsMap.delete(key));
    return toDelete.length;
}

export interface PlannerAttachmentHelpers {

    /**
     * Get all attachments as array
     */
    getAll(): PlannerAttachment[];

    /**
     * Get attachment by ID
     */
    get(id: string): PlannerAttachment | undefined;

    /**
     * Get attachments for a specific date (includes static items created on or before this date)
     */
    getForDate(dateStr: string): PlannerAttachment[];

    /**
     * Get all static (pinned) attachments
     */
    getStatic(): PlannerAttachment[];

    /**
     * Create a new attachment
     */
    create(data: Omit<PlannerAttachment, 'id' | 'createdAt' | 'sortOrder'>): PlannerAttachment;

    /**
     * Update an attachment
     */
    update(id: string, updates: Partial<PlannerAttachment>): PlannerAttachment | undefined;

    /**
     * Delete an attachment
     */
    delete(id: string): boolean;

    /**
     * Delete all attachments for a specific reference (when entity is deleted)
     */
    deleteByReference(referenceId: string): number;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create planner attachment helpers for a Y.Map
 */
export function createPlannerAttachmentHelpers(
    attachments: Y.Map<string, PlannerAttachment>
): PlannerAttachmentHelpers {

    const getAll = (): PlannerAttachment[] => {
        const result: PlannerAttachment[] = [];
        attachments.forEach((attachment) => {
            result.push(attachment);
        });
        return result;
    };

    const getMaxSortOrder = (): number => {
        let max = 0;
        attachments.forEach((a) => {
            if (a.sortOrder > max) max = a.sortOrder;
        });
        return max;
    };

    return {

        getAll,

        get(id: string): PlannerAttachment | undefined {
            return attachments.get(id);
        },

        getForDate(dateStr: string): PlannerAttachment[] {
            const dateTimestamp = new Date(dateStr).getTime();
            const endOfDay = dateTimestamp + 86400000; // Include same day

            return getAll().filter((a) => {
                if (a.mode === 'static') {
                    // Static items appear from their creation date forward
                    return a.createdAt <= endOfDay;
                }
                return a.date === dateStr;
            });
        },

        getStatic(): PlannerAttachment[] {
            return getAll().filter((a) => a.mode === 'static');
        },

        create(data: Omit<PlannerAttachment, 'id' | 'createdAt' | 'sortOrder'>): PlannerAttachment {
            const attachment: PlannerAttachment = {
                id: generateId(),
                ...data,
                sortOrder: getMaxSortOrder() + 1,
                createdAt: Date.now(),
            };
            attachments.set(attachment.id, attachment);
            return attachment;
        },

        update(id: string, updates: Partial<PlannerAttachment>): PlannerAttachment | undefined {
            const existing = attachments.get(id);
            if (!existing) return undefined;

            const updated = { ...existing, ...updates };
            attachments.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            return attachments.delete(id);
        },

        deleteByReference(referenceId: string): number {
            let count = 0;
            const toDelete: string[] = [];

            attachments.forEach((a, id) => {
                if (a.referenceId === referenceId) {
                    toDelete.push(id);
                }
            });

            toDelete.forEach((id) => {
                attachments.delete(id);
                count++;
            });

            return count;
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            attachments.observe(handler);
            return () => attachments.unobserve(handler);
        },
    };
}
