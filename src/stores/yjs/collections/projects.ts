/**
 * Project collection helpers
 * 
 * Provides CRUD operations and utilities for the projects Y.Map
 */

import * as Y from 'yjs';
import type { Project } from '../types';
import { generateSlugId } from '@/utils/idUtils';

export interface ProjectHelpers {

    /**
     * Get all projects as array
     */
    getAll(): Project[];

    /**
     * Get all non-archived projects
     */
    getActive(): Project[];

    /**
     * Get all archived projects
     */
    getArchived(): Project[];

    /**
     * Get project by ID
     */
    get(id: string): Project | undefined;

    /**
     * Get projects by client ID
     */
    getByClient(clientId: string): Project[];

    /**
     * Create a new project
     */
    create(data: Omit<Project, 'id'>): Project;

    /**
     * Update a project
     */
    update(id: string, updates: Partial<Project>): Project | undefined;

    /**
     * Delete a project (hard delete - Yjs handles conflict)
     */
    delete(id: string): boolean;

    /**
     * Archive a project
     */
    archive(id: string): Project | undefined;

    /**
     * Unarchive a project
     */
    unarchive(id: string): Project | undefined;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create project helpers for a Y.Map
 */
export function createProjectHelpers(projects: Y.Map<string, Project>): ProjectHelpers {

    const getAllProjects = (): Project[] => {
        const result: Project[] = [];
        projects.forEach((project) => {
            result.push(project);
        });
        return result;
    };

    return {

        getAll(): Project[] {
            return getAllProjects();
        },

        getActive(): Project[] {
            return getAllProjects().filter(p => !p.archived);
        },

        getArchived(): Project[] {
            return getAllProjects().filter(p => p.archived);
        },

        get(id: string): Project | undefined {
            return projects.get(id);
        },

        getByClient(clientId: string): Project[] {
            return getAllProjects().filter(p => p.preferredClientId === clientId);
        },

        create(data: Omit<Project, 'id'>): Project {
            const now = Date.now();
            const project: Project = {
                id: generateSlugId(data.title),
                archived: false,
                ...data,
                createdAt: data.createdAt ?? now,
                updatedAt: data.updatedAt ?? data.createdAt ?? now,
            };
            projects.set(project.id, project);
            return project;
        },

        update(id: string, updates: Partial<Project>): Project | undefined {
            const existing = projects.get(id);
            if (!existing) return undefined;

            const updated = { ...existing, ...updates, updatedAt: Date.now() };
            projects.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            return projects.delete(id);
        },

        archive(id: string): Project | undefined {
            return this.update(id, { archived: true });
        },

        unarchive(id: string): Project | undefined {
            return this.update(id, { archived: false });
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            projects.observe(handler);
            return () => projects.unobserve(handler);
        },
    };
}
