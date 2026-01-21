/**
 * Task collection helpers
 * 
 * Provides CRUD operations and utilities for the tasks Y.Map
 * Note: Archived tasks are in a separate document - use YjsStore methods for archive operations
 */

import * as Y from 'yjs';
import type { Task } from '../types';
import { generateId } from '@/utils/idUtils';

export interface TaskHelpers {

    /**
     * Get all tasks as array
     */
    getAll(): Task[];

    /**
     * Get tasks by project ID
     */
    getByProject(projectId: string): Task[];

    /**
     * Get root tasks for a project (no parent)
     */
    getRootTasksByProject(projectId: string): Task[];

    /**
     * Get subtasks for a parent task
     */
    getSubtasks(parentTaskId: string): Task[];

    /**
     * Get task by ID
     */
    get(id: string): Task | undefined;

    /**
     * Create a new task
     */
    create(data: Omit<Task, 'id'>): Task;

    /**
     * Update a task
     */
    update(id: string, updates: Partial<Task>): Task | undefined;

    /**
     * Delete a task (hard delete)
     */
    delete(id: string): boolean;

    /**
     * Toggle task completion
     */
    toggleComplete(id: string): Task | undefined;

    /**
     * Toggle task billable status
     */
    toggleBillable(id: string): Task | undefined;

    /**
     * Mark task as last active (touch)
     */
    touch(id: string): Task | undefined;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create task helpers for a Y.Map
 */
export function createTaskHelpers(tasks: Y.Map<string, Task>): TaskHelpers {

    const getAllTasks = (): Task[] => {
        const result: Task[] = [];
        tasks.forEach((task) => {
            result.push(task);
        });
        return result;
    };

    return {

        getAll(): Task[] {
            return getAllTasks();
        },

        getByProject(projectId: string): Task[] {
            return getAllTasks().filter(t => t.projectId === projectId);
        },

        getRootTasksByProject(projectId: string): Task[] {
            return getAllTasks().filter(t => t.projectId === projectId && !t.parentTaskId);
        },

        getSubtasks(parentTaskId: string): Task[] {
            return getAllTasks().filter(t => t.parentTaskId === parentTaskId);
        },

        get(id: string): Task | undefined {
            return tasks.get(id);
        },

        create(data: Omit<Task, 'id'>): Task {
            const task: Task = {
                id: generateId(),
                completed: false,
                archived: false,
                billable: false,
                billableSetByUser: false,
                lastActive: Date.now(),
                ...data,
            };
            tasks.set(task.id, task);
            return task;
        },

        update(id: string, updates: Partial<Task>): Task | undefined {
            const existing = tasks.get(id);
            if (!existing) return undefined;

            const updated = {
                ...existing,
                ...updates,
                lastActive: Date.now(),
            };
            tasks.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            return tasks.delete(id);
        },

        toggleComplete(id: string): Task | undefined {
            const task = tasks.get(id);
            if (!task) return undefined;
            return this.update(id, { completed: !task.completed });
        },

        toggleBillable(id: string): Task | undefined {
            const task = tasks.get(id);
            if (!task) return undefined;
            return this.update(id, {
                billable: !task.billable,
                billableSetByUser: true,
            });
        },

        touch(id: string): Task | undefined {
            return this.update(id, { lastActive: Date.now() });
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            tasks.observe(handler);
            return () => tasks.unobserve(handler);
        },
    };
}
