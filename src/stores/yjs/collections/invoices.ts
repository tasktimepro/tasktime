/**
 * Invoice collection helpers
 * 
 * Provides CRUD operations for invoices
 * Note: Archived invoices (paid from previous years) are in a separate document
 */

import * as Y from 'yjs';
import type { Invoice } from '../types';
import { generateId } from '@/utils/idUtils';
import { invoiceBelongsToProject, isInvoiceCanceled, isInvoiceOutstanding } from '@/utils/invoiceUtils';

export interface InvoiceHelpers {

    /**
     * Get all invoices as array
     */
    getAll(): Invoice[];

    /**
     * Get invoice by ID
     */
    get(id: string): Invoice | undefined;

    /**
     * Get invoices by project ID
     */
    getByProject(projectId: string): Invoice[];

    /**
     * Get invoices by client ID
     */
    getByClient(clientId: string): Invoice[];

    /**
     * Get invoices by status
     */
    getByStatus(status: Invoice['status']): Invoice[];

    /**
     * Get unpaid invoices
     */
    getUnpaid(): Invoice[];

    /**
     * Create a new invoice
     */
    create(data: Omit<Invoice, 'id'>): Invoice;

    /**
     * Update an invoice
     */
    update(id: string, updates: Partial<Invoice>): Invoice | undefined;

    /**
     * Delete an invoice
     */
    delete(id: string): boolean;

    /**
     * Mark invoice as paid
     */
    markPaid(id: string): Invoice | undefined;

    /**
     * Mark invoice as sent
     */
    markSent(id: string): Invoice | undefined;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create invoice helpers for a Y.Map
 */
export function createInvoiceHelpers(invoices: Y.Map<string, Invoice>): InvoiceHelpers {

    const getAllInvoices = (): Invoice[] => {
        const result: Invoice[] = [];
        invoices.forEach((invoice) => {
            result.push(invoice);
        });
        return result;
    };

    return {

        getAll(): Invoice[] {
            return getAllInvoices();
        },

        get(id: string): Invoice | undefined {
            return invoices.get(id);
        },

        getByProject(projectId: string): Invoice[] {
            return getAllInvoices().filter((invoice) => invoiceBelongsToProject(invoice, projectId));
        },

        getByClient(clientId: string): Invoice[] {
            return getAllInvoices().filter(i => i.clientId === clientId);
        },

        getByStatus(status: Invoice['status']): Invoice[] {
            return getAllInvoices().filter(i => i.status === status);
        },

        getUnpaid(): Invoice[] {
            return getAllInvoices().filter((invoice) => isInvoiceOutstanding(invoice));
        },

        create(data: Omit<Invoice, 'id'>): Invoice {
            const now = Date.now();
            const invoice: Invoice = {
                id: generateId(),
                ...data,
                createdAt: data.createdAt ?? now,
                updatedAt: data.updatedAt ?? data.createdAt ?? now,
            };
            invoices.set(invoice.id, invoice);
            return invoice;
        },

        update(id: string, updates: Partial<Invoice>): Invoice | undefined {
            const existing = invoices.get(id);
            if (!existing) return undefined;
            if (isInvoiceCanceled(existing)) {
                throw new Error('Canceled invoices are read-only historical records.');
            }

            const updated = { ...existing, ...updates, updatedAt: Date.now() };
            invoices.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            return invoices.delete(id);
        },

        markPaid(id: string): Invoice | undefined {
            const existing = this.get(id);
            if (isInvoiceCanceled(existing)) {
                throw new Error('Canceled invoices are read-only historical records.');
            }

            return this.update(id, {
                status: 'paid',
                paidAt: Date.now(),
            });
        },

        markSent(id: string): Invoice | undefined {
            const existing = this.get(id);
            if (isInvoiceCanceled(existing)) {
                throw new Error('Canceled invoices are read-only historical records.');
            }

            return this.update(id, { status: 'sent' });
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            invoices.observe(handler);
            return () => invoices.unobserve(handler);
        },
    };
}
