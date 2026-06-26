/**
 * usePaymentMethods - React hook for payment methods collection
 * 
 * Provides reactive payment method data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { PaymentMethod } from '@/stores/yjs/types';
import { planDefaultSelection } from '@/domain/settings/defaultSelection';

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
        let result: PaymentMethod | undefined;

        planDefaultSelection({ items, targetId: id }).forEach((change) => {
            result = update(change.id, change.updates);
        });

        return result;
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
