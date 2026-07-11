import type { InvoiceFinalizationApplicationPlan } from './invoiceFinalizationApplication';
import type { InvoiceUndoApplicationPlan } from './invoiceUndoApplication';
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

export type InvoiceBillingOperation = InvoiceFinalizationOperation | InvoiceUndoOperation;

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

export function isInvoiceBillingOperation(value: unknown): value is InvoiceBillingOperation {
    if (!value || typeof value !== 'object') return false;

    const operation = value as Partial<InvoiceBillingOperation>;

    const validBase = operation.version === 1
        && typeof operation.operationId === 'string'
        && typeof operation.invoiceId === 'string'
        && (operation.kind === 'finalize' || operation.kind === 'undo')
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

    return invoice?.id === operation.invoiceId
        && Array.isArray(application.entriesToDelete)
        && Array.isArray(application.entriesToClear)
        && Array.isArray(application.expenseUpdatesToUnbill)
        && Array.isArray(application.quotedTaskUpdates)
        && Array.isArray(application.taskCutoffUpdates)
        && Array.isArray(application.projectUnlinkUpdates);
}
