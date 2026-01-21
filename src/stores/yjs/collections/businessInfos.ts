/**
 * Business info collection helpers
 * 
 * Provides CRUD operations for business info entities
 */

import * as Y from 'yjs';
import type { BusinessInfo } from '../types';
import { generateId } from '@/utils/idUtils';

export interface BusinessInfoHelpers {

    /**
     * Get all business infos as array
     */
    getAll(): BusinessInfo[];

    /**
     * Get business info by ID
     */
    get(id: string): BusinessInfo | undefined;

    /**
     * Get the default business info
     */
    getDefault(): BusinessInfo | undefined;

    /**
     * Create a new business info
     */
    create(data: Omit<BusinessInfo, 'id'>): BusinessInfo;

    /**
     * Update a business info
     */
    update(id: string, updates: Partial<BusinessInfo>): BusinessInfo | undefined;

    /**
     * Delete a business info
     */
    delete(id: string): boolean;

    /**
     * Set as default (clears default from others)
     */
    setDefault(id: string): BusinessInfo | undefined;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create business info helpers for a Y.Map
 */
export function createBusinessInfoHelpers(businessInfos: Y.Map<string, BusinessInfo>): BusinessInfoHelpers {

    const getAllBusinessInfos = (): BusinessInfo[] => {
        const result: BusinessInfo[] = [];
        businessInfos.forEach((info) => {
            result.push(info);
        });
        return result;
    };

    return {

        getAll(): BusinessInfo[] {
            return getAllBusinessInfos();
        },

        get(id: string): BusinessInfo | undefined {
            return businessInfos.get(id);
        },

        getDefault(): BusinessInfo | undefined {
            return getAllBusinessInfos().find(info => info.isDefault);
        },

        create(data: Omit<BusinessInfo, 'id'>): BusinessInfo {
            const allInfos = getAllBusinessInfos();
            const isFirst = allInfos.length === 0;

            const businessInfo: BusinessInfo = {
                id: generateId(),
                isDefault: isFirst, // First one is default
                ...data,
            };
            businessInfos.set(businessInfo.id, businessInfo);
            return businessInfo;
        },

        update(id: string, updates: Partial<BusinessInfo>): BusinessInfo | undefined {
            const existing = businessInfos.get(id);
            if (!existing) return undefined;

            const updated = { ...existing, ...updates };
            businessInfos.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            return businessInfos.delete(id);
        },

        setDefault(id: string): BusinessInfo | undefined {
            // Clear default from all others
            getAllBusinessInfos().forEach(info => {
                if (info.isDefault && info.id !== id) {
                    businessInfos.set(info.id, { ...info, isDefault: false });
                }
            });

            // Set new default
            return this.update(id, { isDefault: true });
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            businessInfos.observe(handler);
            return () => businessInfos.unobserve(handler);
        },
    };
}
