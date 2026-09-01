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
import { buildClientEntity, buildClientUpdates } from '@/domain/work/workEntityOperations';
import { generateId } from '@/utils/idUtils';
import { useBilling } from '@/contexts/BillingContext';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import {
    assertActiveClientApplication,
    runActiveClientApplication,
} from '@/domain/work/activeClientApplication';
import { collectValidatedEntities } from '@/stores/yjs/validation';

export function useClients() {
    const { store, isReady } = useYjs();
    const { resolution } = useBilling();
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

    const readCurrentClients = useCallback(() => collectValidatedEntities<Client>(
        'clients',
        store.clients as any,
        'active client application',
    ), [store]);

    const createClient = useCallback((data: Omit<Client, 'id'> & { id?: string }) => {
        if (BILLING_FEATURES.clientLimitEnforcement) {
            assertActiveClientApplication({
                enforcementEnabled: true,
                clients: readCurrentClients(),
                resolution,
                transition: 'create',
            });
        }
        const id = data.id || generateId();
        return create(buildClientEntity({ data, id, now: Date.now() }));
    }, [create, readCurrentClients, resolution]);

    const updateClient = useCallback((id: string, updates: Partial<Client>) => {
        const existing = get(id);
        if (!existing) return undefined;
        if (BILLING_FEATURES.clientLimitEnforcement && updates.archived === false) {
            assertActiveClientApplication({
                enforcementEnabled: true,
                clients: readCurrentClients(),
                resolution,
                transition: 'update',
                existingClientId: id,
                nextArchived: false,
            });
        }
        const built = buildClientUpdates({ existing, updates, now: Date.now() });
        const normalizedUpdates = Object.prototype.hasOwnProperty.call(updates, 'title')
            ? { ...updates, title: built.title }
            : updates;
        const { id: _immutableId, ...persistedUpdates } = normalizedUpdates;
        return update(id, persistedUpdates);
    }, [get, readCurrentClients, resolution, update]);

    const createClientWithPolicyLock = useCallback((data: Omit<Client, 'id'> & { id?: string }) => (
        runActiveClientApplication({
            enforcementEnabled: BILLING_FEATURES.clientLimitEnforcement,
            readClients: readCurrentClients,
            resolution,
            transition: 'create',
            commit: () => createClient(data),
        })
    ), [createClient, readCurrentClients, resolution]);

    const updateClientWithPolicyLock = useCallback((id: string, updates: Partial<Client>) => (
        runActiveClientApplication({
            enforcementEnabled: BILLING_FEATURES.clientLimitEnforcement,
            readClients: readCurrentClients,
            resolution,
            transition: 'update',
            existingClientId: id,
            nextArchived: updates.archived,
            commit: () => updateClient(id, updates),
        })
    ), [readCurrentClients, resolution, updateClient]);

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
        createClient,
        createClientWithPolicyLock,
        updateClient,
        updateClientWithPolicyLock,
        deleteClient,
        
        // Helpers
        findByName,
    };
}
