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
        (store) => store.clients
    );

    // Sorted by name
    const sortedClients = useMemo(
        () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
        [items]
    );

    // Find by name (case insensitive)
    const findByName = useCallback((name: string) => {
        const lower = name.toLowerCase();
        return items.find(c => c.name.toLowerCase() === lower);
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
