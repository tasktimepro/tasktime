import type { Expense, Invoice, TimeEntry } from '@/stores/yjs/types';
import { getInvoicePaidAtTimestamp, getInvoiceTotal, isInvoicePaid, isInvoiceRevenueBearing } from '@/utils/invoiceUtils';
import { parseStoredDate } from '@/utils/dateUtils';
import { getActualDurationMs } from '@/utils/timeEntryDurationUtils';

export interface BasicReportsOverviewV1 {
    version: 1;
    scope: 'basic-current-month';
    period: { startAt: string; endBefore: string; timeZone: string };
    received: Array<{ currency: string; amount: number }>;
    expenses: Array<{ currency: string; amount: number }>;
    trackedTimeMs: number;
}

function currency(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function add(totals: Map<string, number>, code: string | null, amount: unknown): void {
    if (!code || typeof amount !== 'number' || !Number.isFinite(amount)) return;
    totals.set(code, (totals.get(code) ?? 0) + amount);
}

function sorted(totals: Map<string, number>): Array<{ currency: string; amount: number }> {
    return [...totals.entries()]
        .filter(([, amount]) => Number.isFinite(amount))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, amount]) => ({ currency: code, amount }));
}

function paidSource(invoice: Invoice): { code: string | null; amount: number } {
    const snapshot = invoice.paymentCurrencySnapshot;
    if (snapshot
        && Number.isFinite(snapshot.capturedAt)
        && Number.isFinite(snapshot.sourceAmount)
        && currency(snapshot.sourceCurrency)) {
        return { code: currency(snapshot.sourceCurrency), amount: snapshot.sourceAmount };
    }
    return { code: currency(invoice.currency), amount: getInvoiceTotal(invoice) };
}

export function buildBasicReportsOverview(input: {
    invoices: readonly Invoice[];
    expenses: readonly Expense[];
    entries: readonly TimeEntry[];
    nowMs?: number;
    timeZone?: string;
}): BasicReportsOverviewV1 {
    const now = new Date(input.nowMs ?? Date.now());
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startMs = start.getTime();
    const endMs = end.getTime();
    const zone = input.timeZone
        ?? Intl.DateTimeFormat().resolvedOptions().timeZone
        ?? 'UTC';
    if (zone.length < 1 || zone.length > 64) throw new Error('INVALID_TIME_ZONE');
    const received = new Map<string, number>();
    for (const invoice of input.invoices) {
        if (!isInvoicePaid(invoice) || !isInvoiceRevenueBearing(invoice)) continue;
        const paidAt = getInvoicePaidAtTimestamp(invoice);
        if (paidAt === null || !Number.isFinite(paidAt) || paidAt < startMs || paidAt >= endMs) continue;
        const source = paidSource(invoice);
        add(received, source.code, source.amount);
    }
    const expenses = new Map<string, number>();
    for (const expense of input.expenses) {
        const date = parseStoredDate(expense.date);
        const timestamp = date?.getTime();
        if (timestamp === undefined || !Number.isFinite(timestamp)
            || timestamp < startMs || timestamp >= endMs) continue;
        add(expenses, currency(expense.currency), expense.amount);
    }
    let trackedTimeMs = 0;
    for (const entry of input.entries) {
        if (!Number.isFinite(entry.start) || entry.start < startMs || entry.start >= endMs) continue;
        trackedTimeMs += getActualDurationMs(entry);
    }
    return {
        version: 1,
        scope: 'basic-current-month',
        period: { startAt: start.toISOString(), endBefore: end.toISOString(), timeZone: zone },
        received: sorted(received),
        expenses: sorted(expenses),
        trackedTimeMs,
    };
}
