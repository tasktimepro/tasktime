/**
 * Invoice template collection helpers
 * 
 * Provides CRUD operations for invoice templates
 */

import * as Y from 'yjs';
import type { InvoiceTemplate } from '../types';
import { generateId } from '@/utils/idUtils';

export interface InvoiceTemplateHelpers {

    /**
     * Get all templates as array
     */
    getAll(): InvoiceTemplate[];

    /**
     * Get template by ID
     */
    get(id: string): InvoiceTemplate | undefined;

    /**
     * Create a new template
     */
    create(data: Omit<InvoiceTemplate, 'id'>): InvoiceTemplate;

    /**
     * Update a template
     */
    update(id: string, updates: Partial<InvoiceTemplate>): InvoiceTemplate | undefined;

    /**
     * Delete a template
     */
    delete(id: string): boolean;

    /**
     * Get next invoice number from template
     */
    getNextNumber(id: string): string | undefined;

    /**
     * Increment sequential number after using
     */
    incrementSequentialNumber(id: string): InvoiceTemplate | undefined;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create invoice template helpers for a Y.Map
 */
export function createInvoiceTemplateHelpers(templates: Y.Map<string, InvoiceTemplate>): InvoiceTemplateHelpers {

    const getAllTemplates = (): InvoiceTemplate[] => {
        const result: InvoiceTemplate[] = [];
        templates.forEach((template) => {
            result.push(template);
        });
        return result;
    };

    return {

        getAll(): InvoiceTemplate[] {
            return getAllTemplates();
        },

        get(id: string): InvoiceTemplate | undefined {
            return templates.get(id);
        },

        create(data: Omit<InvoiceTemplate, 'id'>): InvoiceTemplate {
            const template: InvoiceTemplate = {
                id: generateId(),
                currentSequentialNumber: 1,
                ...data,
            };
            templates.set(template.id, template);
            return template;
        },

        update(id: string, updates: Partial<InvoiceTemplate>): InvoiceTemplate | undefined {
            const existing = templates.get(id);
            if (!existing) return undefined;

            const updated = { ...existing, ...updates };
            templates.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            return templates.delete(id);
        },

        getNextNumber(id: string): string | undefined {
            const template = templates.get(id);
            if (!template) return undefined;

            const prefix = template.prefix || '';
            const number = template.currentSequentialNumber || 1;

            if (template.useSequentialNumbers) {
                return `${prefix}${String(number).padStart(4, '0')}`;
            }

            // Non-sequential: use timestamp-based
            return `${prefix}${Date.now()}`;
        },

        incrementSequentialNumber(id: string): InvoiceTemplate | undefined {
            const template = templates.get(id);
            if (!template) return undefined;

            return this.update(id, {
                currentSequentialNumber: (template.currentSequentialNumber || 1) + 1,
            });
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            templates.observe(handler);
            return () => templates.unobserve(handler);
        },
    };
}
