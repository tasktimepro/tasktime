/**
 * useProjects - React hook for projects collection
 * 
 * Provides reactive project data and CRUD operations
 */

import { useMemo, useCallback } from 'react';
import { useYjsCollection } from './useYjsCollection';
import { toStorageDate } from '@/utils/dateUtils';
import type { Project } from '@/stores/yjs/types';

export function useProjects() {
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

    return {
        // Data
        projects: items,
        activeProjects,
        archivedProjects,
        isLoading,
        
        // CRUD
        getProject: get,
        createProject: create,
        updateProject: update,
        deleteProject: remove,
        
        // Helpers
        archiveProject,
        unarchiveProject,
        getProjectsByClient,
    };
}
