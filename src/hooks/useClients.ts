/**
 * useClients - React hook for clients collection
 * 
 * Provides reactive client data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { Client } from '@/stores/yjs/types';

export function useClients() {
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

    return {
        // Data
        clients: items,
        sortedClients,
        isLoading,
        
        // CRUD
        getClient: get,
        createClient: create,
        updateClient: update,
        deleteClient: remove,
        
        // Helpers
        findByName,
    };
}
