/**
 * useInvoiceTemplates - React hook for invoice templates collection
 * 
 * Provides reactive template data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { InvoiceTemplate } from '@/stores/yjs/types';
import { planDefaultSelection } from '@/domain/settings/defaultSelection';

export function useInvoiceTemplates() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<InvoiceTemplate>(
        (store) => store.invoiceTemplates,
        { collectionName: 'invoiceTemplates' }
    );

    // Sorted by name
    const sortedTemplates = useMemo(
        () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
        [items]
    );

    // Get the next invoice number for a template
    const getNextInvoiceNumber = useCallback((templateId: string): string => {
        const template = get(templateId);
        if (!template) return '';

        const prefix = template.prefix || '';
        const num = template.currentSequentialNumber || 1;
        
        return `${prefix}${String(num).padStart(4, '0')}`;
    }, [get]);

    // Increment the sequential number for a template
    const incrementSequentialNumber = useCallback((templateId: string) => {
        const template = get(templateId);
        if (!template || !template.useSequentialNumbers) return;

        const nextNum = (template.currentSequentialNumber || 1) + 1;
        return update(templateId, { currentSequentialNumber: nextNum });
    }, [get, update]);

    // Set a template as default
    const setDefault = useCallback((id: string) => {
        let result: InvoiceTemplate | undefined;

        planDefaultSelection({ items, targetId: id }).forEach((change) => {
            result = update(change.id, change.updates);
        });

        return result;
    }, [items, update]);

    return {
        // Data
        invoiceTemplates: items,
        sortedTemplates,
        isLoading,
        
        // CRUD
        getInvoiceTemplate: get,
        createInvoiceTemplate: create,
        updateInvoiceTemplate: update,
        deleteInvoiceTemplate: remove,
        
        // Helpers
        getNextInvoiceNumber,
        incrementSequentialNumber,
        setDefault,
    };
}
