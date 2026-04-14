/**
 * useEmailTemplates - React hook for email templates collection
 *
 * Provides reactive template data and CRUD operations, mirroring
 * the useInvoiceTemplates pattern.
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { EmailTemplate } from '@/stores/yjs/types';

export function useEmailTemplates() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<EmailTemplate>(
        (store) => store.emailTemplates,
        { collectionName: 'emailTemplates' }
    );

    const sortedTemplates = useMemo(
        () => [...items].sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
        }),
        [items]
    );

    /** Templates filtered by type */
    const getByType = useCallback(
        (type: EmailTemplate['type']) => sortedTemplates.filter(t => t.type === type),
        [sortedTemplates]
    );

    /** Get the default template for a given type, or the first one */
    const getDefaultForType = useCallback(
        (type: EmailTemplate['type']): EmailTemplate | undefined => {
            const typed = sortedTemplates.filter(t => t.type === type);
            return typed.find(t => t.isDefault) || typed[0];
        },
        [sortedTemplates]
    );

    /** Set a template as the default (unsets previous default of the same type) */
    const setDefault = useCallback((id: string) => {
        const target = get(id);
        if (!target) return;

        items.forEach(t => {
            if (t.isDefault && t.id !== id && t.type === target.type) {
                update(t.id, { isDefault: false });
            }
        });

        return update(id, { isDefault: true });
    }, [items, get, update]);

    return {
        emailTemplates: items,
        sortedTemplates,
        isLoading,

        getEmailTemplate: get,
        createEmailTemplate: create,
        updateEmailTemplate: update,
        deleteEmailTemplate: remove,

        getByType,
        getDefaultForType,
        setDefault,
    };
}
