/**
 * useProjects - React hook for projects collection
 * 
 * Provides reactive project data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import { useYjs } from '@/contexts/YjsContext';
import { cleanupAttachmentsForEntity } from '@/stores/yjs/collections/plannerAttachments';
import { toStorageDate } from '@/utils/dateUtils';
import type { Project } from '@/stores/yjs/types';
import type { Client } from '@/stores/yjs/types';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import { buildProjectEntity, buildProjectUpdates } from '@/domain/work/workEntityOperations';
import { generateId } from '@/utils/idUtils';

export function useProjects() {
    const { store, isReady } = useYjs();
    const { items, isLoading, get, create, update, remove } = useYjsCollection<Project>(
        (store) => store.projects,
        { collectionName: 'projects' }
    );

    // Derived data
    const activeProjects = useMemo(
        () => items.filter(p => !p.archived),
        [items]
    );

    const archivedProjects = useMemo(
        () => items.filter(p => p.archived),
        [items]
    );

    const createProject = useCallback((data: Omit<Project, 'id'> & { id?: string }) => {
        const id = data.id || generateId();
        const clients = store.clients
            ? collectValidatedEntities<Client>('clients', store.clients as any, 'UI create project clients')
            : [];
        return create(buildProjectEntity({ data, id, now: Date.now(), clients }));
    }, [create, store]);

    const updateProject = useCallback((
        id: string,
        updates: Partial<Project>,
        updateOptions?: { origin?: unknown },
    ) => {
        const existing = get(id);
        if (!existing) return undefined;
        let normalizedUpdates = updates;
        if (store.clients) {
            const built = buildProjectUpdates({
                existing,
                updates,
                now: Date.now(),
                clients: collectValidatedEntities<Client>('clients', store.clients as any, 'UI update project clients'),
            });
            normalizedUpdates = Object.prototype.hasOwnProperty.call(updates, 'title')
                ? { ...updates, title: built.title }
                : updates;
        }
        const { id: _immutableId, ...persistedUpdates } = normalizedUpdates;
        return updateOptions
            ? update(id, persistedUpdates, updateOptions)
            : update(id, persistedUpdates);
    }, [get, store, update]);

    // Helper methods
    const archiveProject = useCallback((id: string) => {
        return update(id, { archived: true, archivedOnDate: toStorageDate(new Date()) });
    }, [update]);

    const unarchiveProject = useCallback((id: string) => {
        return update(id, { archived: false, archivedOnDate: null });
    }, [update]);

    const getProjectsByClient = useCallback((clientId: string) => {
        return items.filter(p => p.preferredClientId === clientId);
    }, [items]);

    const deleteProject = useCallback((id: string) => {
        const deleted = remove(id);

        if (deleted && isReady) {
            cleanupAttachmentsForEntity(store.plannerAttachments as any, id);
        }

        return deleted;
    }, [remove, store, isReady]);

    return {
        // Data
        projects: items,
        activeProjects,
        archivedProjects,
        isLoading,
        
        // CRUD
        getProject: get,
        createProject,
        updateProject,
        deleteProject,
        
        // Helpers
        archiveProject,
        unarchiveProject,
        getProjectsByClient,
    };
}
