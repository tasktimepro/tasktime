import { describe, expect, it } from 'vitest';
import { buildMarkInvoicePaidUpdates, buildMarkInvoiceUnpaidUpdates } from './invoicePayment';
import type { Invoice } from '@/stores/yjs/types';

describe('invoice payment update builders', () => {
    it('builds paid updates with optional payment snapshot and updatedAt', () => {
        const paymentCurrencySnapshot: Invoice['paymentCurrencySnapshot'] = {
            capturedAt: 10,
            sourceCurrency: 'EUR',
            sourceAmount: 100,
            preferredCurrencyAtPayment: 'USD',
            preferredCurrencyAmount: 110,
        };

        expect(buildMarkInvoicePaidUpdates({
            paidAt: 10,
            paymentCurrencySnapshot,
            updatedAt: 11,
        })).toEqual({
            status: 'paid',
            paidAt: 10,
            paymentCurrencySnapshot,
            updatedAt: 11,
        });
    });

    it('builds unpaid updates with UI status fallback and optional updatedAt', () => {
        const invoice: Invoice = {
            id: 'invoice-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-1',
            date: '2026-06-01',
            dueDate: '2026-06-30',
            status: 'paid',
            paidAt: 10,
            paymentCurrencySnapshot: {
                capturedAt: 10,
                sourceCurrency: 'EUR',
                sourceAmount: 100,
                preferredCurrencyAtPayment: 'USD',
                preferredCurrencyAmount: 110,
            },
            items: [],
            subtotal: 0,
            total: 0,
        };

        expect(buildMarkInvoiceUnpaidUpdates({
            invoice,
            referenceAt: Date.parse('2026-06-15T12:00:00Z'),
            updatedAt: 20,
        })).toEqual({
            status: 'sent',
            paidAt: null,
            paymentCurrencySnapshot: undefined,
            updatedAt: 20,
        });
    });
});
