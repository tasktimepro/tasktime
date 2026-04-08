/**
 * useBusinessInfos - React hook for business info collection
 * 
 * Provides reactive business info data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { BusinessInfo } from '@/stores/yjs/types';

export function useBusinessInfos() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<BusinessInfo>(
        (store) => store.businessInfos,
        { collectionName: 'businessInfos' }
    );

    // Get the default business info
    const defaultBusinessInfo = useMemo(
        () => items.find(b => b.isDefault) ?? items[0],
        [items]
    );

    // Set a business info as default
    const setDefault = useCallback((id: string) => {
        // First, unset any existing default
        items.forEach(b => {
            if (b.isDefault && b.id !== id) {
                update(b.id, { isDefault: false });
            }
        });
        // Then set the new default
        return update(id, { isDefault: true });
    }, [items, update]);

    return {
        // Data
        businessInfos: items,
        defaultBusinessInfo,
        isLoading,
        
        // CRUD
        getBusinessInfo: get,
        createBusinessInfo: create,
        updateBusinessInfo: update,
        deleteBusinessInfo: remove,
        
        // Helpers
        setDefault,
    };
}
