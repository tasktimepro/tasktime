/**
 * Client collection helpers
 * 
 * Provides CRUD operations for clients
 */

import * as Y from 'yjs';
import type { Client } from '../types';
import { generateId } from '@/utils/idUtils';

export interface ClientHelpers {

    /**
     * Get all clients as array
     */
    getAll(): Client[];

    /**
     * Get client by ID
     */
    get(id: string): Client | undefined;

    /**
     * Create a new client
     */
    create(data: Omit<Client, 'id'>): Client;

    /**
     * Update a client
     */
    update(id: string, updates: Partial<Client>): Client | undefined;

    /**
     * Delete a client
     */
    delete(id: string): boolean;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create client helpers for a Y.Map
 */
export function createClientHelpers(clients: Y.Map<string, Client>): ClientHelpers {

    const getAllClients = (): Client[] => {
        const result: Client[] = [];
        clients.forEach((client) => {
            result.push(client);
        });
        return result;
    };

    return {

        getAll(): Client[] {
            return getAllClients();
        },

        get(id: string): Client | undefined {
            return clients.get(id);
        },

        create(data: Omit<Client, 'id'>): Client {
            const now = Date.now();
            const client: Client = {
                id: generateId(),
                ...data,
                createdAt: data.createdAt ?? now,
                updatedAt: data.updatedAt ?? data.createdAt ?? now,
            };
            clients.set(client.id, client);
            return client;
        },

        update(id: string, updates: Partial<Client>): Client | undefined {
            const existing = clients.get(id);
            if (!existing) return undefined;

            const updated = { ...existing, ...updates, updatedAt: Date.now() };
            clients.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            return clients.delete(id);
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            clients.observe(handler);
            return () => clients.unobserve(handler);
        },
    };
}
