/**
 * usePaymentMethods - React hook for payment methods collection
 * 
 * Provides reactive payment method data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { PaymentMethod } from '@/stores/yjs/types';

export function usePaymentMethods() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<PaymentMethod>(
        (store) => store.paymentMethods,
        { collectionName: 'paymentMethods' }
    );

    // Get the default payment method
    const defaultPaymentMethod = useMemo(
        () => items.find(p => p.isDefault) ?? items[0],
        [items]
    );

    // Set a payment method as default
    const setDefault = useCallback((id: string) => {
        // First, unset any existing default
        items.forEach(p => {
            if (p.isDefault && p.id !== id) {
                update(p.id, { isDefault: false });
            }
        });
        // Then set the new default
        return update(id, { isDefault: true });
    }, [items, update]);

    return {
        // Data
        paymentMethods: items,
        defaultPaymentMethod,
        isLoading,
        
        // CRUD
        getPaymentMethod: get,
        createPaymentMethod: create,
        updatePaymentMethod: update,
        deletePaymentMethod: remove,
        
        // Helpers
        setDefault,
    };
}
