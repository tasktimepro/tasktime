/**
 * Payment method collection helpers
 * 
 * Provides CRUD operations for payment methods
 */

import * as Y from 'yjs';
import type { PaymentMethod } from '../types';
import { generateId } from '@/utils/idUtils';

export interface PaymentMethodHelpers {

    /**
     * Get all payment methods as array
     */
    getAll(): PaymentMethod[];

    /**
     * Get payment method by ID
     */
    get(id: string): PaymentMethod | undefined;

    /**
     * Get the default payment method
     */
    getDefault(): PaymentMethod | undefined;

    /**
     * Create a new payment method
     */
    create(data: Omit<PaymentMethod, 'id'>): PaymentMethod;

    /**
     * Update a payment method
     */
    update(id: string, updates: Partial<PaymentMethod>): PaymentMethod | undefined;

    /**
     * Delete a payment method
     */
    delete(id: string): boolean;

    /**
     * Set as default (clears default from others)
     */
    setDefault(id: string): PaymentMethod | undefined;

    /**
     * Subscribe to changes
     */
    observe(callback: () => void): () => void;
}

/**
 * Create payment method helpers for a Y.Map
 */
export function createPaymentMethodHelpers(paymentMethods: Y.Map<string, PaymentMethod>): PaymentMethodHelpers {

    const getAllPaymentMethods = (): PaymentMethod[] => {
        const result: PaymentMethod[] = [];
        paymentMethods.forEach((method) => {
            result.push(method);
        });
        return result;
    };

    return {

        getAll(): PaymentMethod[] {
            return getAllPaymentMethods();
        },

        get(id: string): PaymentMethod | undefined {
            return paymentMethods.get(id);
        },

        getDefault(): PaymentMethod | undefined {
            return getAllPaymentMethods().find(method => method.isDefault);
        },

        create(data: Omit<PaymentMethod, 'id'>): PaymentMethod {
            const allMethods = getAllPaymentMethods();
            const isFirst = allMethods.length === 0;

            const paymentMethod: PaymentMethod = {
                id: generateId(),
                isDefault: isFirst, // First one is default
                ...data,
            };
            paymentMethods.set(paymentMethod.id, paymentMethod);
            return paymentMethod;
        },

        update(id: string, updates: Partial<PaymentMethod>): PaymentMethod | undefined {
            const existing = paymentMethods.get(id);
            if (!existing) return undefined;

            const updated = { ...existing, ...updates };
            paymentMethods.set(id, updated);
            return updated;
        },

        delete(id: string): boolean {
            return paymentMethods.delete(id);
        },

        setDefault(id: string): PaymentMethod | undefined {
            // Clear default from all others
            getAllPaymentMethods().forEach(method => {
                if (method.isDefault && method.id !== id) {
                    paymentMethods.set(method.id, { ...method, isDefault: false });
                }
            });

            // Set new default
            return this.update(id, { isDefault: true });
        },

        observe(callback: () => void): () => void {
            const handler = () => callback();
            paymentMethods.observe(handler);
            return () => paymentMethods.unobserve(handler);
        },
    };
}
