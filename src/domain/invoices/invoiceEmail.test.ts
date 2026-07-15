import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/stores/yjs/types';
import { resolveInvoiceEmailDraft } from './invoiceEmail';

describe('resolveInvoiceEmailDraft', () => {
    it('rejects canceled invoices before resolving an email draft', () => {
        const invoice = {
            id: 'invoice-canceled',
            invoiceNumber: 'INV-CANCELED',
            status: 'canceled',
            canceledAt: 2,
            cancellationReason: 'Duplicate invoice',
        } as Invoice;

        expect(() => resolveInvoiceEmailDraft({
            invoice,
            emailTemplates: [],
        })).toThrow('Canceled invoices cannot be sent by email.');
    });
});
