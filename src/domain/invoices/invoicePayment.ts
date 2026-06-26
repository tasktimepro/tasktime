import type { Invoice } from '@/stores/yjs/types';
import { getInvoiceStatusAfterMarkingUnpaid } from '@/utils/invoiceUtils';

export interface BuildMarkInvoicePaidUpdatesInput {
    paidAt: number;
    paymentCurrencySnapshot?: Invoice['paymentCurrencySnapshot'];
    updatedAt?: number;
}

export interface BuildMarkInvoiceUnpaidUpdatesInput {
    invoice: Invoice;
    referenceAt?: number;
    updatedAt?: number;
}

export function buildMarkInvoicePaidUpdates(input: BuildMarkInvoicePaidUpdatesInput): Partial<Invoice> {
    return {
        status: 'paid',
        paidAt: input.paidAt,
        paymentCurrencySnapshot: input.paymentCurrencySnapshot,
        ...(typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
            ? { updatedAt: input.updatedAt }
            : {}),
    };
}

export function buildMarkInvoiceUnpaidUpdates(input: BuildMarkInvoiceUnpaidUpdatesInput): Partial<Invoice> {
    const referenceDate = typeof input.referenceAt === 'number' && Number.isFinite(input.referenceAt)
        ? new Date(input.referenceAt)
        : undefined;

    return {
        status: getInvoiceStatusAfterMarkingUnpaid(input.invoice, referenceDate),
        paidAt: null,
        paymentCurrencySnapshot: undefined,
        ...(typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
            ? { updatedAt: input.updatedAt }
            : {}),
    };
}
