import * as Y from 'yjs';
import { normalizeCurrencyCode } from '@/utils/currencyUtils';
import { parseStoredDate } from '@/utils/dateUtils';
import {
    createInvoicePaymentCurrencySnapshot,
    getInvoicePaymentCurrencySnapshot,
    isInvoicePaid,
} from '@/utils/invoiceUtils';
import { objectToYMap, readEntity } from './entityUtils';

type BackfillOptions = {
    preferredCurrency: string;
    exchangeRates?: Record<string, number> | null;
};

function resolveSnapshotCapturedAt(invoice: Record<string, unknown>): number {
    if (typeof invoice.paidAt === 'number' && Number.isFinite(invoice.paidAt)) {
        return invoice.paidAt;
    }

    const parsedInvoiceDate = parseStoredDate(typeof invoice.date === 'string' ? invoice.date : null);
    if (parsedInvoiceDate) {
        return parsedInvoiceDate.getTime();
    }

    if (typeof invoice.updatedAt === 'number' && Number.isFinite(invoice.updatedAt)) {
        return invoice.updatedAt;
    }

    if (typeof invoice.createdAt === 'number' && Number.isFinite(invoice.createdAt)) {
        return invoice.createdAt;
    }

    return Date.now();
}

export function hasPaidInvoicesMissingCurrencySnapshotsInMap(
    invoicesMap: Y.Map<string, unknown>
): boolean {
    let hasMissingSnapshot = false;

    invoicesMap.forEach((value) => {
        if (hasMissingSnapshot) {
            return;
        }

        const invoice = readEntity<Record<string, unknown>>(value);
        if (!invoice || !isInvoicePaid(invoice)) {
            return;
        }

        if (!getInvoicePaymentCurrencySnapshot(invoice)) {
            hasMissingSnapshot = true;
        }
    });

    return hasMissingSnapshot;
}

export function backfillPaidInvoiceCurrencySnapshotsInMap(
    invoicesMap: Y.Map<string, unknown>,
    options: BackfillOptions
): number {
    let backfilledCount = 0;
    const preferredCurrency = normalizeCurrencyCode(options.preferredCurrency);

    invoicesMap.forEach((value, id) => {
        const invoice = readEntity<Record<string, unknown>>(value);
        if (!invoice || !isInvoicePaid(invoice)) {
            return;
        }

        if (getInvoicePaymentCurrencySnapshot(invoice)) {
            return;
        }

        const invoiceCurrency = normalizeCurrencyCode(
            typeof invoice.currency === 'string' ? invoice.currency : preferredCurrency
        );

        if (!options.exchangeRates && invoiceCurrency !== preferredCurrency) {
            return;
        }

        const capturedAt = resolveSnapshotCapturedAt(invoice);
        const snapshot = createInvoicePaymentCurrencySnapshot({
            invoice,
            preferredCurrency,
            exchangeRates: options.exchangeRates,
            capturedAt,
        });

        if (value instanceof Y.Map) {
            value.set('paymentCurrencySnapshot', snapshot);
        } else {
            invoicesMap.set(id, objectToYMap({
                ...invoice,
                paymentCurrencySnapshot: snapshot,
            }));
        }

        backfilledCount += 1;
    });

    return backfilledCount;
}

export function backfillPaidInvoiceCurrencySnapshotsInDoc(
    doc: Y.Doc,
    options: BackfillOptions
): number {
    const invoicesMap = doc.getMap('invoices') as Y.Map<string, unknown>;
    if (invoicesMap.size === 0) {
        return 0;
    }

    let backfilledCount = 0;

    doc.transact(() => {
        backfilledCount = backfillPaidInvoiceCurrencySnapshotsInMap(invoicesMap, options);
    }, 'invoice-payment-snapshot-backfill');

    return backfilledCount;
}
