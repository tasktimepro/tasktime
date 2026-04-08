import * as Y from 'yjs';
import { objectToYMap, readEntity } from './entityUtils';
import { normalizeInvoiceRecord } from '@/utils/invoiceUtils';

function invoicesDiffer(currentInvoice: Record<string, unknown>, normalizedInvoice: Record<string, unknown>): boolean {
    return currentInvoice.total !== normalizedInvoice.total
        || currentInvoice.subtotal !== normalizedInvoice.subtotal
        || currentInvoice.status !== normalizedInvoice.status
    || currentInvoice.projectId !== normalizedInvoice.projectId
    || currentInvoice.clientId !== normalizedInvoice.clientId
        || (currentInvoice.paidAt ?? null) !== (normalizedInvoice.paidAt ?? null)
        || (currentInvoice.businessInfoId ?? null) !== (normalizedInvoice.businessInfoId ?? null)
        || (currentInvoice.paymentMethodId ?? null) !== (normalizedInvoice.paymentMethodId ?? null)
        || (currentInvoice.dueDate ?? null) !== (normalizedInvoice.dueDate ?? null)
    || !Array.isArray(currentInvoice.items)
    || JSON.stringify(currentInvoice.items) !== JSON.stringify(normalizedInvoice.items)
        || Object.prototype.hasOwnProperty.call(currentInvoice, 'totalAmount')
        || Object.prototype.hasOwnProperty.call(currentInvoice, 'paymentProcessed');
}

export function migrateInvoiceMap(invoicesMap: Y.Map<string, unknown>): number {
    let migratedCount = 0;

    invoicesMap.forEach((value, id) => {
        const invoice = readEntity<Record<string, unknown>>(value);

        if (!invoice) {
            return;
        }

        const normalizedInvoice = normalizeInvoiceRecord(invoice) as Record<string, unknown>;

        if (!invoicesDiffer(invoice, normalizedInvoice)) {
            return;
        }

        if (value instanceof Y.Map) {
            Object.entries(normalizedInvoice).forEach(([key, normalizedValue]) => {
                value.set(key, normalizedValue);
            });

            value.delete('totalAmount');
            value.delete('paymentProcessed');
        } else {
            invoicesMap.set(id, objectToYMap(normalizedInvoice));
        }

        migratedCount += 1;
    });

    return migratedCount;
}

export function migrateInvoicesInDoc(doc: Y.Doc): number {
    const invoicesMap = doc.getMap('invoices') as Y.Map<string, unknown>;

    if (invoicesMap.size === 0) {
        return 0;
    }

    let migratedCount = 0;

    doc.transact(() => {
        migratedCount = migrateInvoiceMap(invoicesMap);
    }, 'invoice-migration');

    return migratedCount;
}