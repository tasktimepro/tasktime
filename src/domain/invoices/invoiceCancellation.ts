import type { Expense, Invoice, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { getInvoiceStatus, isInvoiceCanceled } from '@/utils/invoiceUtils';
import {
    buildInvoiceSourceReleaseApplication,
    type InvoiceSourceReleaseApplicationPlan,
} from './invoiceUndoApplication';

export const INVOICE_CANCELLATION_REASON_MAX_LENGTH = 500;

export interface InvoiceCancellationApplicationPlan extends InvoiceSourceReleaseApplicationPlan {
    invoiceUpdates: Partial<Invoice>;
    retainedProjectLinkCount: number;
}

export interface InvoiceCancellationResult {
    invoice: Invoice;
    releasedTimeEntryCount: number;
    deletedAdjustmentCount: number;
    releasedExpenseCount: number;
    releasedQuotedTaskCount: number;
    restoredTaskCutoffCount: number;
    retainedProjectLinkCount: number;
    retainedInvoiceNumber: true;
    alreadyApplied: boolean;
}

export function normalizeInvoiceCancellationReason(reason: unknown): string {
    const normalized = typeof reason === 'string' ? reason.trim() : '';

    if (!normalized) {
        throw new Error('Cancellation reason is required.');
    }

    if (normalized.length > INVOICE_CANCELLATION_REASON_MAX_LENGTH) {
        throw new Error(`Cancellation reason must be ${INVOICE_CANCELLATION_REASON_MAX_LENGTH} characters or fewer.`);
    }

    return normalized;
}

export function getInvoiceCancellationBlockReason(
    invoice: Invoice | null | undefined,
    referenceDate?: Date,
): string | null {
    if (!invoice) {
        return 'Invoice not found.';
    }

    if (isInvoiceCanceled(invoice)) {
        return 'This invoice is already canceled.';
    }

    const status = getInvoiceStatus(invoice, referenceDate);

    if (status === 'draft') {
        return 'Draft invoices should be edited or deleted instead of canceled.';
    }

    const hasPaymentEvidence = status === 'paid'
        || typeof invoice.paidAt === 'number'
        || Boolean(invoice.paymentCurrencySnapshot)
        || (invoice as Invoice & { paymentProcessed?: boolean }).paymentProcessed === true;

    if (hasPaymentEvidence) {
        return 'Paid invoices cannot be canceled. Use a credit-note or refund workflow outside TaskTime Pro.';
    }

    if (status !== 'sent' && status !== 'overdue') {
        return 'Only finalized unpaid invoices can be canceled.';
    }

    return null;
}

export function buildInvoiceCancellationApplication({
    invoice,
    entries,
    expenses,
    tasks,
    projects,
    reason,
    canceledAt,
    referenceDate,
}: {
    invoice: Invoice;
    entries: TimeEntry[];
    expenses: Expense[];
    tasks: Task[];
    projects: Project[];
    reason: unknown;
    canceledAt: number;
    referenceDate?: Date;
}): {
    desiredInvoice: Invoice;
    application: InvoiceCancellationApplicationPlan;
    result: InvoiceCancellationResult;
} {
    const blockReason = getInvoiceCancellationBlockReason(invoice, referenceDate);

    if (blockReason) {
        throw new Error(blockReason);
    }

    const cancellationReason = normalizeInvoiceCancellationReason(reason);

    if (!Number.isFinite(canceledAt) || canceledAt <= 0) {
        throw new Error('Cancellation time must be a finite positive timestamp.');
    }

    const sourceRelease = buildInvoiceSourceReleaseApplication({
        invoice,
        invoiceId: invoice.id,
        entries,
        expenses,
        tasks,
        releasedAt: canceledAt,
    }).application;
    const retainedProjectLinkCount = projects.filter((project) => (
        Array.isArray(project.invoiceIds) && project.invoiceIds.includes(invoice.id)
    )).length;
    const invoiceUpdates: Partial<Invoice> = {
        status: 'canceled',
        canceledAt,
        cancellationReason,
        paidAt: null,
        paymentCurrencySnapshot: null,
        updatedAt: canceledAt,
    };
    const desiredInvoice: Invoice = {
        ...invoice,
        ...invoiceUpdates,
    };
    const application: InvoiceCancellationApplicationPlan = {
        ...sourceRelease,
        invoiceUpdates,
        retainedProjectLinkCount,
    };

    return {
        desiredInvoice,
        application,
        result: buildInvoiceCancellationResult({
            desiredInvoice,
            application,
            alreadyApplied: false,
        }),
    };
}

export function buildInvoiceCancellationResult({
    desiredInvoice,
    application,
    alreadyApplied,
}: {
    desiredInvoice: Invoice;
    application: InvoiceCancellationApplicationPlan;
    alreadyApplied: boolean;
}): InvoiceCancellationResult {
    return {
        invoice: desiredInvoice,
        releasedTimeEntryCount: application.releasedTimeEntryCount,
        deletedAdjustmentCount: application.deletedAdjustmentCount,
        releasedExpenseCount: application.releasedExpenseCount,
        releasedQuotedTaskCount: application.releasedQuotedTaskCount,
        restoredTaskCutoffCount: application.restoredTaskCutoffCount,
        retainedProjectLinkCount: application.retainedProjectLinkCount,
        retainedInvoiceNumber: true,
        alreadyApplied,
    };
}
