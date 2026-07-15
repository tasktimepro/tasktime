import type { InvoiceFinalizationApplicationPlan } from './invoiceFinalizationApplication';
import type { InvoiceUndoApplicationPlan } from './invoiceUndoApplication';
import {
    getInvoiceCancellationBlockReason,
    INVOICE_CANCELLATION_REASON_MAX_LENGTH,
    type InvoiceCancellationApplicationPlan,
} from './invoiceCancellation';
import type { Invoice } from '@/stores/yjs/types';

export type InvoiceBillingOperationPhase =
    | 'prepared'
    | 'entries-applied'
    | 'expenses-applied'
    | 'tasks-applied'
    | 'core-links-applied'
    | 'invoice-applied'
    | 'complete';

interface InvoiceBillingOperationBase {
    version: 1;
    operationId: string;
    invoiceId: string;
    createdAt: number;
    updatedAt: number;
    state: 'prepared' | 'complete';
    lastCompletedPhase: InvoiceBillingOperationPhase;
}

export interface InvoiceFinalizationOperation extends InvoiceBillingOperationBase {
    kind: 'finalize';
    desiredInvoice: Invoice;
    application: InvoiceFinalizationApplicationPlan;
}

export interface InvoiceUndoOperation extends InvoiceBillingOperationBase {
    kind: 'undo';
    invoice: Invoice;
    application: InvoiceUndoApplicationPlan;
}

export interface InvoiceCancellationOperation extends InvoiceBillingOperationBase {
    kind: 'cancel';
    invoice: Invoice;
    desiredInvoice: Invoice;
    application: InvoiceCancellationApplicationPlan;
}

export type InvoiceBillingOperation = InvoiceFinalizationOperation | InvoiceUndoOperation | InvoiceCancellationOperation;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasOnlyKeys(record: Record<string, unknown>, allowedKeys: string[]): boolean {
    const allowed = new Set(allowedKeys);

    return Object.keys(record).every((key) => allowed.has(key));
}

function isFiniteOrNull(value: unknown): boolean {
    return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isNonNegativeInteger(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isCancellationEntryClear(value: unknown, invoiceId: string): boolean {
    if (!isRecord(value) || !isRecord(value.entry) || !isRecord(value.updates)) return false;

    const { entry, updates } = value;

    return typeof entry.id === 'string'
        && entry.id.length > 0
        && entry.billedInvoiceId === invoiceId
        && entry.source !== 'invoice-adjustment'
        && hasOnlyKeys(updates, ['billedAt', 'billedHourlyRate', 'billedInvoiceId', 'updatedAt'])
        && updates.billedAt === null
        && updates.billedHourlyRate === null
        && updates.billedInvoiceId === null
        && typeof updates.updatedAt === 'number'
        && Number.isFinite(updates.updatedAt);
}

function isCancellationExpenseUpdate(value: unknown): boolean {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id || !isRecord(value.updates)) return false;

    const { updates } = value;

    return hasOnlyKeys(updates, ['billingStatus', 'invoiceId', 'billedAt', 'updatedAt'])
        && updates.billingStatus === 'unbilled'
        && updates.invoiceId === null
        && updates.billedAt === null
        && typeof updates.updatedAt === 'number'
        && Number.isFinite(updates.updatedAt);
}

function isCancellationQuotedTaskUpdate(value: unknown): boolean {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id || !isRecord(value.updates)) return false;

    const { updates } = value;

    return hasOnlyKeys(updates, ['estimatedFlatAmount', 'quotedAmountBilling', 'updatedAt'])
        && typeof updates.estimatedFlatAmount === 'number'
        && Number.isFinite(updates.estimatedFlatAmount)
        && updates.estimatedFlatAmount >= 0
        && updates.quotedAmountBilling === null
        && typeof updates.updatedAt === 'number'
        && Number.isFinite(updates.updatedAt);
}

function isCancellationTaskCutoffUpdate(value: unknown): boolean {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id || !isRecord(value.updates)) return false;

    const { updates } = value;

    return hasOnlyKeys(updates, ['lastBilledAt', 'updatedAt'])
        && isFiniteOrNull(value.expectedLastBilledAt)
        && isFiniteOrNull(updates.lastBilledAt)
        && typeof updates.updatedAt === 'number'
        && Number.isFinite(updates.updatedAt);
}

function isCancellationApplication(
    operation: Partial<InvoiceCancellationOperation>,
    application: Record<string, unknown>,
): boolean {
    const invoice = operation.invoice as Invoice | undefined;
    const desiredInvoice = operation.desiredInvoice as Invoice | undefined;
    const invoiceUpdates = application.invoiceUpdates;

    if (!invoice || !desiredInvoice || !isRecord(invoiceUpdates)) return false;
    if (getInvoiceCancellationBlockReason(invoice, new Date(operation.createdAt as number)) !== null) return false;

    const cancellationUpdateKeys = new Set([
        'status',
        'canceledAt',
        'cancellationReason',
        'paidAt',
        'paymentCurrencySnapshot',
        'updatedAt',
    ]);
    const immutableKeys = new Set([
        ...Object.keys(invoice as unknown as Record<string, unknown>),
        ...Object.keys(desiredInvoice as unknown as Record<string, unknown>),
    ]);

    for (const key of immutableKeys) {
        if (cancellationUpdateKeys.has(key)) continue;

        if (JSON.stringify((invoice as unknown as Record<string, unknown>)[key])
            !== JSON.stringify((desiredInvoice as unknown as Record<string, unknown>)[key])) {
            return false;
        }
    }

    const cancellationReason = desiredInvoice.cancellationReason;
    const canceledAt = desiredInvoice.canceledAt;
    const validCancellationMetadata = typeof cancellationReason === 'string'
        && cancellationReason.trim() === cancellationReason
        && cancellationReason.length > 0
        && cancellationReason.length <= INVOICE_CANCELLATION_REASON_MAX_LENGTH
        && typeof canceledAt === 'number'
        && Number.isFinite(canceledAt)
        && canceledAt > 0;

    if (!validCancellationMetadata) return false;
    if (!hasOnlyKeys(invoiceUpdates, [
        'status',
        'canceledAt',
        'cancellationReason',
        'paidAt',
        'paymentCurrencySnapshot',
        'updatedAt',
    ])) return false;
    if (
        invoiceUpdates.status !== 'canceled'
        || invoiceUpdates.canceledAt !== canceledAt
        || invoiceUpdates.cancellationReason !== cancellationReason
        || (Object.prototype.hasOwnProperty.call(invoiceUpdates, 'paidAt') && invoiceUpdates.paidAt !== null)
        || (Object.prototype.hasOwnProperty.call(invoiceUpdates, 'paymentCurrencySnapshot') && invoiceUpdates.paymentCurrencySnapshot !== null)
        || typeof invoiceUpdates.updatedAt !== 'number'
        || !Number.isFinite(invoiceUpdates.updatedAt)
    ) return false;

    const entriesToDelete = application.entriesToDelete;
    const entriesToClear = application.entriesToClear;
    const expenseUpdatesToUnbill = application.expenseUpdatesToUnbill;
    const quotedTaskUpdates = application.quotedTaskUpdates;
    const taskCutoffUpdates = application.taskCutoffUpdates;

    return Array.isArray(entriesToDelete)
        && entriesToDelete.every((entry) => (
            isRecord(entry)
            && typeof entry.id === 'string'
            && entry.id.length > 0
            && entry.billedInvoiceId === operation.invoiceId
            && entry.source === 'invoice-adjustment'
        ))
        && Array.isArray(entriesToClear)
        && entriesToClear.every((entry) => isCancellationEntryClear(entry, operation.invoiceId as string))
        && Array.isArray(expenseUpdatesToUnbill)
        && expenseUpdatesToUnbill.every(isCancellationExpenseUpdate)
        && Array.isArray(quotedTaskUpdates)
        && quotedTaskUpdates.every(isCancellationQuotedTaskUpdate)
        && Array.isArray(taskCutoffUpdates)
        && taskCutoffUpdates.every(isCancellationTaskCutoffUpdate)
        && isNonNegativeInteger(application.releasedTimeEntryCount)
        && isNonNegativeInteger(application.deletedAdjustmentCount)
        && isNonNegativeInteger(application.releasedExpenseCount)
        && isNonNegativeInteger(application.releasedQuotedTaskCount)
        && isNonNegativeInteger(application.restoredTaskCutoffCount)
        && isNonNegativeInteger(application.retainedProjectLinkCount);
}

export function createInvoiceFinalizationOperation({
    operationId,
    desiredInvoice,
    application,
    createdAt,
}: {
    operationId: string;
    desiredInvoice: Invoice;
    application: InvoiceFinalizationApplicationPlan;
    createdAt: number;
}): InvoiceFinalizationOperation {
    return {
        version: 1,
        operationId,
        invoiceId: desiredInvoice.id,
        kind: 'finalize',
        state: 'prepared',
        lastCompletedPhase: 'prepared',
        desiredInvoice,
        application,
        createdAt,
        updatedAt: createdAt,
    };
}

export function createInvoiceUndoOperation({
    operationId,
    invoice,
    application,
    createdAt,
}: {
    operationId: string;
    invoice: Invoice;
    application: InvoiceUndoApplicationPlan;
    createdAt: number;
}): InvoiceUndoOperation {
    return {
        version: 1,
        operationId,
        invoiceId: invoice.id,
        kind: 'undo',
        state: 'prepared',
        lastCompletedPhase: 'prepared',
        invoice,
        application,
        createdAt,
        updatedAt: createdAt,
    };
}

export function createInvoiceCancellationOperation({
    operationId,
    invoice,
    desiredInvoice,
    application,
    createdAt,
}: {
    operationId: string;
    invoice: Invoice;
    desiredInvoice: Invoice;
    application: InvoiceCancellationApplicationPlan;
    createdAt: number;
}): InvoiceCancellationOperation {
    return {
        version: 1,
        operationId,
        invoiceId: invoice.id,
        kind: 'cancel',
        state: 'prepared',
        lastCompletedPhase: 'prepared',
        invoice,
        desiredInvoice,
        application,
        createdAt,
        updatedAt: createdAt,
    };
}

export function isInvoiceBillingOperation(value: unknown): value is InvoiceBillingOperation {
    if (!value || typeof value !== 'object') return false;

    const operation = value as Partial<InvoiceBillingOperation>;

    const validBase = operation.version === 1
        && typeof operation.operationId === 'string'
        && typeof operation.invoiceId === 'string'
        && (operation.kind === 'finalize' || operation.kind === 'undo' || operation.kind === 'cancel')
        && (operation.state === 'prepared' || operation.state === 'complete')
        && typeof operation.createdAt === 'number'
        && Number.isFinite(operation.createdAt)
        && typeof operation.updatedAt === 'number'
        && Number.isFinite(operation.updatedAt)
        && Boolean(operation.application && typeof operation.application === 'object');

    if (!validBase) return false;

    const validPhases: InvoiceBillingOperationPhase[] = [
        'prepared',
        'entries-applied',
        'expenses-applied',
        'tasks-applied',
        'core-links-applied',
        'invoice-applied',
        'complete',
    ];
    if (!validPhases.includes(operation.lastCompletedPhase as InvoiceBillingOperationPhase)) return false;

    const application = operation.application as unknown as Record<string, unknown>;
    if (operation.kind === 'finalize') {
        const desiredInvoice = operation.desiredInvoice as Invoice | undefined;

        return desiredInvoice?.id === operation.invoiceId
            && Array.isArray(application.adjustmentEntryIdsToDelete)
            && Array.isArray(application.adjustmentEntriesToUpdate)
            && Array.isArray(application.adjustmentEntriesToCreate)
            && Array.isArray(application.timeEntryUpdates)
            && Array.isArray(application.expenseUpdates)
            && Array.isArray(application.taskCutoffUpdates)
            && Array.isArray(application.quotedTaskUpdates)
            && Array.isArray(application.projectLinkUpdates);
    }

    const invoice = operation.invoice as Invoice | undefined;

    if (operation.kind === 'cancel') {
        const desiredInvoice = operation.desiredInvoice as Invoice | undefined;

        return invoice?.id === operation.invoiceId
            && desiredInvoice?.id === operation.invoiceId
            && desiredInvoice.status === 'canceled'
            && isCancellationApplication(operation as Partial<InvoiceCancellationOperation>, application);
    }

    return invoice?.id === operation.invoiceId
        && Array.isArray(application.entriesToDelete)
        && Array.isArray(application.entriesToClear)
        && Array.isArray(application.expenseUpdatesToUnbill)
        && Array.isArray(application.quotedTaskUpdates)
        && Array.isArray(application.taskCutoffUpdates)
        && Array.isArray(application.projectUnlinkUpdates);
}
