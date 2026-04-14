/**
 * useClients - React hook for clients collection
 * 
 * Provides reactive client data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import { useYjs } from '@/contexts/YjsContext';
import { cleanupAttachmentsForEntity } from '@/stores/yjs/collections/plannerAttachments';
import type { Client } from '@/stores/yjs/types';

export function useClients() {
    const { store, isReady } = useYjs();
    const { items, isLoading, get, create, update, remove } = useYjsCollection<Client>(
        (store) => store.clients,
        { collectionName: 'clients' }
    );

    // Sorted by title
    const sortedClients = useMemo(
        () => [...items].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })),
        [items]
    );

    // Find by title (case insensitive)
    const findByName = useCallback((name: string) => {
        const lower = name.toLowerCase();
        return items.find(c => (c.title || '').toLowerCase() === lower);
    }, [items]);

    const deleteClient = useCallback((id: string) => {
        const deleted = remove(id);

        if (deleted && isReady) {
            cleanupAttachmentsForEntity(store.plannerAttachments as any, id);
        }

        return deleted;
    }, [remove, store, isReady]);

    return {
        // Data
        clients: items,
        sortedClients,
        isLoading,
        
        // CRUD
        getClient: get,
        createClient: create,
        updateClient: update,
        deleteClient,
        
        // Helpers
        findByName,
    };
}
