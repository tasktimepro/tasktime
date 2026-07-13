import { collectValidatedEntities } from '@/stores/yjs/validation';
import { collectEntities, readEntity } from '@/stores/yjs/entityUtils';
import type { BusinessBrandAsset, BusinessInfo, Client, EmailTemplate, Expense, Invoice, InvoiceTemplate, PaymentMethod, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { getProjectInvoicePreview, type ProjectInvoicePreview } from '@/utils/invoicePreviewUtils';
import { toStorageDate } from '@/utils/dateUtils';
import type { EmailSendType } from '@/utils/emailTemplateUtils';
import {
    createInvoicePaymentCurrencySnapshot,
    getInvoiceSequenceRollback,
    getInvoiceUndoBlockReason,
    getNextSequentialNumberForTemplate,
    resolveCurrentInvoiceTemplate,
} from '@/utils/invoiceUtils';
import { normalizeCurrencyCode } from '@/utils/currencyUtils';
import { calculateDueDate, generateInvoiceNumber } from '@/components/invoice/utils/invoiceDateUtils';
import {
    buildQuoteDocumentData,
    getQuoteDownloadFilename,
    getQuoteNumberTimestamp,
} from '@/utils/quoteUtils';
import {
    buildInvoiceFinalizationApplication,
} from '@/domain/invoices/invoiceFinalizationApplication';
import { buildInvoiceBillingSelectionSnapshot } from '@/domain/invoices/invoiceBillingSelection';
import {
    isInvoiceBillingOperation,
    type InvoiceBillingOperation,
} from '@/domain/invoices/invoiceBillingOperation';
import {
    buildDraftInvoiceItems,
    buildDraftInvoiceUpdates,
    InvoiceDraftValidationError,
} from '@/domain/invoices/invoiceDraft';
import { resolveInvoiceEmailDraft, type InvoiceEmailDraft, type InvoiceEmailDraftOverrides } from '@/domain/invoices/invoiceEmail';
import { buildMarkInvoicePaidUpdates, buildMarkInvoiceUnpaidUpdates } from '@/domain/invoices/invoicePayment';
import {
    buildInvoiceUndoApplication,
} from '@/domain/invoices/invoiceUndoApplication';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import {
    assertPermission,
    assertReady,
    createValidatedEntity,
    getId,
    getNow,
    readRequiredEntity,
    requireString,
    updateValidatedEntity,
    withIdempotency,
} from './shared';

const DEFAULT_INVOICE_LIMIT = 25;
const MAX_INVOICE_LIMIT = 100;

export interface ListInvoicesCommandInput {
    clientId?: string | null;
    projectId?: string | null;
    status?: Invoice['status'] | null;
    limit?: number;
}

export interface InvoiceSummary {
    id: string;
    invoiceNumber: string;
    clientId: string;
    projectId: string | null;
    projectIds?: string[];
    date: string;
    dueDate?: string | null;
    status: Invoice['status'];
    subtotal: number;
    total: number;
    createdAt?: number;
    updatedAt?: number;
}

export interface PreviewInvoiceFromUnbilledWorkInput {
    projectId: string;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
    includeClientLevelExpenses?: boolean;
    exchangeRates?: Record<string, number> | null;
}

export interface CreateInvoiceDraftFromUnbilledWorkInput extends PreviewInvoiceFromUnbilledWorkInput {
    id?: string;
    clientId?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string | null;
    templateId?: string | null;
    businessInfoId?: string | null;
    paymentMethodId?: string | null;
    notes?: string;
    idempotencyKey?: string;
}

export interface UpdateInvoiceDraftInput {
    invoiceId: string;
    updates: Partial<Invoice> & Record<string, unknown>;
}

export interface FinalizeInvoiceInput {
    invoiceId: string;
    confirmFinalize: boolean;
    finalizedAt?: number;
    idempotencyKey?: string;
}

export interface MarkInvoicePaidInput {
    invoiceId: string;
    confirmPaid: boolean;
    paidAt?: number;
    exchangeRates?: Record<string, number> | null;
    idempotencyKey?: string;
}

export interface MarkInvoiceUnpaidInput {
    invoiceId: string;
    confirmUnpaid: boolean;
    referenceAt?: number;
    idempotencyKey?: string;
}

export interface UndoLatestInvoiceInput {
    invoiceId: string;
    confirmUndo: boolean;
    confirmationText: string;
    undoneAt?: number;
    idempotencyKey?: string;
}

export interface ExportInvoicePdfInput {
    invoiceId: string;
    filename?: string;
}

export interface PreviewInvoiceEmailInput extends InvoiceEmailDraftOverrides {
    invoiceId: string;
    sendType?: EmailSendType;
}

export interface SendInvoiceEmailInput extends PreviewInvoiceEmailInput {
    confirmSend: boolean;
    idempotencyKey?: string;
}

export interface ProjectQuoteTaskInput {
    id?: string;
    title: string;
    hours?: number;
    hourlyRate?: number;
    flatRate?: number;
    quantity?: number;
    useFlatRate?: boolean;
    parentTaskId?: string | null;
}

export interface ProjectQuoteInput {
    projectId: string;
    clientId?: string | null;
    businessInfoId?: string | null;
    paymentMethodId?: string | null;
    invoiceTemplateId?: string | null;
    note?: string;
    quoteDate?: string;
    quoteTimestamp?: string;
    quoteTasks?: ProjectQuoteTaskInput[];
    additionalTasks?: ProjectQuoteTaskInput[];
}

export interface ExportProjectQuotePdfInput extends ProjectQuoteInput {
    filename?: string;
}

export interface PreviewProjectQuoteEmailInput extends ProjectQuoteInput, Omit<InvoiceEmailDraftOverrides, 'templateId'> {
    emailTemplateId?: string | null;
}

export interface SendProjectQuoteEmailInput extends PreviewProjectQuoteEmailInput {
    confirmSend: boolean;
    idempotencyKey?: string;
}

export interface InvoiceUnbilledWorkPreview {
    projectId: string;
    projectTitle: string;
    clientId?: string | null;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
    includeClientLevelExpenses: boolean;
    preview: ProjectInvoicePreview;
    sideEffects: {
        createsInvoice: false;
        marksEntriesBilled: false;
        marksExpensesBilled: false;
        updatesTaskBillingCutoffs: false;
        advancesInvoiceSequence: false;
    };
}

export interface InvoiceDraftFromUnbilledWork {
    invoice: Invoice;
    preview: ProjectInvoicePreview;
    sideEffects: {
        createsInvoice: true;
        marksEntriesBilled: false;
        marksExpensesBilled: false;
        updatesTaskBillingCutoffs: false;
        updatesProjectInvoiceReferences: false;
        advancesInvoiceSequence: false;
    };
}

export interface UpdatedInvoiceDraftResult {
    invoice: Invoice;
    sideEffects: {
        createsInvoice: false;
        marksEntriesBilled: false;
        marksExpensesBilled: false;
        updatesTaskBillingCutoffs: false;
        updatesProjectInvoiceReferences: false;
        advancesInvoiceSequence: false;
    };
}

export interface FinalizedInvoiceResult {
    invoice: Invoice;
    billedEntryCount: number;
    billedExpenseCount: number;
    updatedTaskCount: number;
    updatedProjectInvoiceReferences: boolean;
    advancedInvoiceSequence: boolean;
}

export interface MarkInvoicePaidResult {
    invoice: Invoice;
    paymentCurrencySnapshotStored: boolean;
}

export interface MarkInvoiceUnpaidResult {
    invoice: Invoice;
    paymentCurrencySnapshotCleared: boolean;
}

export interface UndoLatestInvoiceResult {
    invoiceNumber: string;
    clearedTimeEntryCount: number;
    deletedAdjustmentCount: number;
    unbilledExpenseCount: number;
    rewoundSequence: boolean;
}

export interface ExportInvoicePdfResult {
    invoiceId: string;
    invoiceNumber: string;
    filename: string;
    downloadStarted: true;
}

export interface SendInvoiceEmailResult {
    invoiceId: string;
    invoiceNumber: string;
    sendType: EmailSendType;
    to: string;
    forwarded: boolean | null;
    remaining: number | null;
    updatedInvoice: boolean;
    status: Invoice['status'];
    sentAt: number | null;
}

export interface ProjectQuotePreviewResult {
    projectId: string;
    quote: Record<string, unknown>;
    sideEffects: {
        createsInvoice: false;
        marksEntriesBilled: false;
        marksExpensesBilled: false;
        updatesTaskBillingCutoffs: false;
        updatesProjectInvoiceReferences: false;
        advancesInvoiceSequence: false;
    };
}

export interface ExportProjectQuotePdfResult {
    projectId: string;
    quoteId: string;
    quoteNumber: string;
    filename: string;
    downloadStarted: true;
}

export interface SendProjectQuoteEmailResult {
    projectId: string;
    quoteId: string;
    quoteNumber: string;
    sendType: 'quote';
    to: string;
    forwarded: boolean | null;
    remaining: number | null;
    updatedInvoice: false;
    sentAt: null;
}

function getLimit(limit?: number): number {
    if (!Number.isFinite(limit)) {
        return DEFAULT_INVOICE_LIMIT;
    }

    return Math.max(1, Math.min(MAX_INVOICE_LIMIT, Math.floor(limit as number)));
}

function invoiceMatchesProject(invoice: Invoice, projectId: string): boolean {
    return invoice.projectId === projectId || Boolean(invoice.projectIds?.includes(projectId));
}

function summarizeInvoice(invoice: Invoice): InvoiceSummary {
    const summary: InvoiceSummary = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        date: invoice.date,
        status: invoice.status,
        subtotal: invoice.subtotal,
        total: invoice.total,
    };

    if (invoice.projectIds) summary.projectIds = invoice.projectIds;
    if (invoice.dueDate) summary.dueDate = invoice.dueDate;
    if (invoice.createdAt) summary.createdAt = invoice.createdAt;
    if (invoice.updatedAt) summary.updatedAt = invoice.updatedAt;

    return summary;
}

const BLOCKED_DRAFT_UPDATE_KEYS = new Set([
    'id',
    'status',
    'createdAt',
    'paidAt',
    'paymentCurrencySnapshot',
    'sentAt',
    'sentToEmail',
    'billingStateSnapshot',
    'billingSelectionSnapshot',
    'agentDraft',
]);

const ALLOWED_DRAFT_UPDATE_KEYS = new Set([
    'project',
    'projectId',
    'projectIds',
    'projectBreakdowns',
    'clientExpenseItems',
    'invoiceOnlyExpenseItems',
    'client',
    'clientId',
    'businessInfo',
    'businessInfoId',
    'paymentMethod',
    'paymentMethodId',
    'invoiceNumber',
    'date',
    'dateOverride',
    'dueDate',
    'items',
    'tasks',
    'additionalTasks',
    'expenseItems',
    'taskFlatRates',
    'useFlatRate',
    'taskHourlyRates',
    'taskQuantities',
    'mergedSubtasks',
    'note',
    'notes',
    'totalHours',
    'subtotal',
    'discount',
    'discountType',
    'discountValue',
    'shipping',
    'tax',
    'taxRate',
    'taxLabel',
    'taxOverride',
    'billingPeriodPreset',
    'billingPeriodStart',
    'billingPeriodEnd',
    'currency',
    'template',
    'templateId',
    'brandingSnapshot',
    'htmlContent',
]);

function assertDraftInvoiceUpdateKeys(updates: Record<string, unknown>) {
    const keys = Object.keys(updates);
    const blockedKeys = keys.filter((key) => BLOCKED_DRAFT_UPDATE_KEYS.has(key));

    if (blockedKeys.length > 0) {
        throw new AgentCommandError('INVALID_INPUT', 'Draft invoice updates cannot change invoice lifecycle, billing, payment, or identity fields.', {
            keys: blockedKeys,
        });
    }

    const unsupportedKeys = keys.filter((key) => !ALLOWED_DRAFT_UPDATE_KEYS.has(key));

    if (unsupportedKeys.length > 0) {
        throw new AgentCommandError('INVALID_INPUT', 'Unsupported draft invoice update fields.', {
            keys: unsupportedKeys,
        });
    }
}

function assertOptionalReference<T>(
    map: unknown,
    id: unknown,
    label: string
) {
    if (id === undefined || id === null || id === '') {
        return;
    }

    readRequiredEntity<T>(map as any, requireString(id, label), label);
}

export function listInvoicesCommand(context: AgentCommandContext, input: ListInvoicesCommandInput = {}): InvoiceSummary[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent list invoices')
        .filter((invoice) => !input.clientId || invoice.clientId === input.clientId)
        .filter((invoice) => !input.projectId || invoiceMatchesProject(invoice, input.projectId))
        .filter((invoice) => !input.status || invoice.status === input.status)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || (b.date || '').localeCompare(a.date || ''))
        .slice(0, getLimit(input.limit))
        .map(summarizeInvoice);
}

export async function previewInvoiceFromUnbilledWorkCommand(
    context: AgentCommandContext,
    input: PreviewInvoiceFromUnbilledWorkInput
): Promise<InvoiceUnbilledWorkPreview> {
    assertReady(context);
    assertPermission(context, 'read');

    const project = readRequiredEntity<Project>(context.store.projects as any, input.projectId, 'Project');
    const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent invoice preview clients');
    const [tasks, expenses, timeEntries, invoices] = await Promise.all([
        typeof context.store.getAllTasks === 'function'
            ? context.store.getAllTasks()
            : Promise.resolve(collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent invoice preview tasks')),
        typeof context.store.getAllExpenses === 'function'
            ? context.store.getAllExpenses()
            : Promise.resolve(collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent invoice preview expenses')),
        typeof context.store.loadAllTimeEntries === 'function'
            ? context.store.loadAllTimeEntries()
            : Promise.resolve(context.store.getAllTimeEntries()),
        typeof context.store.getAllInvoices === 'function'
            ? context.store.getAllInvoices()
            : Promise.resolve(collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent invoice preview invoices')),
    ]);
    const preview = getProjectInvoicePreview(project, {
        clients,
        tasks,
        expenses,
        timeEntries,
        invoices,
        exchangeRates: input.exchangeRates ?? null,
        billingPeriodStart: input.billingPeriodStart,
        billingPeriodEnd: input.billingPeriodEnd,
        includeClientLevelExpenses: input.includeClientLevelExpenses === true,
        preferredCurrency: context.store.preferences.get('currency') as string | undefined,
    });

    return {
        projectId: project.id,
        projectTitle: project.title,
        clientId: project.preferredClientId,
        billingPeriodStart: input.billingPeriodStart,
        billingPeriodEnd: input.billingPeriodEnd,
        includeClientLevelExpenses: input.includeClientLevelExpenses === true,
        preview,
        sideEffects: {
            createsInvoice: false,
            marksEntriesBilled: false,
            marksExpensesBilled: false,
            updatesTaskBillingCutoffs: false,
            advancesInvoiceSequence: false,
        },
    };
}

export async function createInvoiceDraftFromUnbilledWorkCommand(
    context: AgentCommandContext,
    input: CreateInvoiceDraftFromUnbilledWorkInput
): Promise<InvoiceDraftFromUnbilledWork> {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, async () => {
        const projectId = requireString(input.projectId, 'projectId');
        const project = readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');
        const clientId = input.clientId || project.preferredClientId;

        if (!clientId) {
            throw new AgentCommandError('INVALID_INPUT', 'Project must have a client before an invoice draft can be created.');
        }

        readRequiredEntity<Client>(context.store.clients as any, clientId, 'Client');

        const previewResult = await previewInvoiceFromUnbilledWorkCommand(context, {
            projectId,
            billingPeriodStart: input.billingPeriodStart,
            billingPeriodEnd: input.billingPeriodEnd,
            includeClientLevelExpenses: input.includeClientLevelExpenses,
            exchangeRates: input.exchangeRates,
        });
        const preview = previewResult.preview;

        if (preview.total <= 0) {
            throw new AgentCommandError('INVALID_INPUT', 'No billable unbilled work is available for this invoice draft.');
        }

        const now = getNow(context);
        const invoiceDate = input.invoiceDate || toStorageDate(new Date(now));
        const invoiceTemplates = collectValidatedEntities<InvoiceTemplate & Record<string, unknown>>(
            'invoiceTemplates',
            context.store.invoiceTemplates as any,
            'agent invoice draft templates'
        );
        const selectedTemplate = input.templateId
            ? invoiceTemplates.find((template) => template.id === input.templateId) || null
            : invoiceTemplates.find((template) => template.isDefault) || null;
        const resolvedTemplate = selectedTemplate
            ? resolveCurrentInvoiceTemplate(selectedTemplate, invoiceTemplates)
            : null;
        const existingInvoices = collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent invoice draft existing invoices');
        const nextSequentialNumber = resolvedTemplate
            ? getNextSequentialNumberForTemplate(resolvedTemplate, existingInvoices)
            : null;
        const templateForInvoiceNumber = resolvedTemplate && nextSequentialNumber !== null
            ? {
                ...resolvedTemplate,
                currentSequentialNumber: nextSequentialNumber,
            }
            : resolvedTemplate;
        const invoiceNumber = input.invoiceNumber
            || (templateForInvoiceNumber
                ? generateInvoiceNumber(templateForInvoiceNumber as any, project, { issuedAt: invoiceDate, timestamp: now })
                : `DRAFT-${project.id.slice(-8)}-${now}`);
        const dueDate = Object.prototype.hasOwnProperty.call(input, 'dueDate')
            ? input.dueDate ?? null
            : calculateDueDate(resolvedTemplate as any, new Date(invoiceDate));
        const invoice = createValidatedEntity<Invoice>(context.store.invoices as any, 'invoices', {
            id: input.id || getId(context),
            projectId: project.id,
            projectIds: [project.id],
            projectBreakdowns: [{
                projectId: project.id,
                projectTitle: project.title,
                clientId,
                pricingMode: project.flatRate ? 'flat' : 'hourly',
                totalHours: preview.unbilledHours,
                subtotal: preview.total,
                allocatedTotal: preview.total,
            }],
            clientId,
            businessInfoId: input.businessInfoId ?? null,
            paymentMethodId: input.paymentMethodId ?? null,
            invoiceNumber,
            date: invoiceDate,
            dueDate,
            status: 'draft',
            items: buildDraftInvoiceItems(project, preview),
            subtotal: preview.total,
            tax: 0,
            taxRate: 0,
            total: preview.total,
            notes: input.notes,
            billingPeriodPreset: input.billingPeriodStart || input.billingPeriodEnd ? 'custom' : undefined,
            billingPeriodStart: input.billingPeriodStart ?? null,
            billingPeriodEnd: input.billingPeriodEnd ?? null,
            currency: preview.currency,
            billingSelectionSnapshot: buildInvoiceBillingSelectionSnapshot({
                preview,
                capturedAt: now,
            }),
            template: resolvedTemplate ? { ...resolvedTemplate } : null,
            templateId: resolvedTemplate?.id || null,
            agentDraft: {
                version: 1,
                source: 'tasktime-agent',
                projectId: project.id,
                clientId,
                billingPeriodStart: input.billingPeriodStart ?? null,
                billingPeriodEnd: input.billingPeriodEnd ?? null,
                includeClientLevelExpenses: input.includeClientLevelExpenses === true,
                preview,
                finalizationState: 'draft',
            },
            createdAt: now,
            updatedAt: now,
        }, `agent create invoice draft ${invoiceNumber}`);

        return {
            invoice,
            preview,
            sideEffects: {
                createsInvoice: true,
                marksEntriesBilled: false,
                marksExpensesBilled: false,
                updatesTaskBillingCutoffs: false,
                updatesProjectInvoiceReferences: false,
                advancesInvoiceSequence: false,
            },
        };
    });
}

export function updateInvoiceDraftCommand(
    context: AgentCommandContext,
    input: UpdateInvoiceDraftInput
): UpdatedInvoiceDraftResult {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');

    const invoiceId = requireString(input.invoiceId, 'invoiceId');
    const updates = input.updates || {};
    assertDraftInvoiceUpdateKeys(updates);

    const existing = readRequiredEntity<Invoice & Record<string, unknown>>(context.store.invoices as any, invoiceId, 'Invoice');

    if (existing.status !== 'draft') {
        throw new AgentCommandError('CONFLICT', 'Only draft invoices can be edited by an agent.', {
            invoiceId,
            status: existing.status,
        });
    }

    assertOptionalReference<Client>(context.store.clients, Object.prototype.hasOwnProperty.call(updates, 'clientId') ? updates.clientId : existing.clientId, 'Client');
    assertOptionalReference<Project>(context.store.projects, Object.prototype.hasOwnProperty.call(updates, 'projectId') ? updates.projectId : existing.projectId, 'Project');
    assertOptionalReference<BusinessInfo>(context.store.businessInfos, Object.prototype.hasOwnProperty.call(updates, 'businessInfoId') ? updates.businessInfoId : existing.businessInfoId, 'Business info');
    assertOptionalReference<InvoiceTemplate>(context.store.invoiceTemplates, Object.prototype.hasOwnProperty.call(updates, 'templateId') ? updates.templateId : existing.templateId, 'Invoice template');
    assertOptionalReference(context.store.paymentMethods, Object.prototype.hasOwnProperty.call(updates, 'paymentMethodId') ? updates.paymentMethodId : existing.paymentMethodId, 'Payment method');

    if (Array.isArray(updates.projectIds)) {
        updates.projectIds.forEach((projectId) => {
            assertOptionalReference<Project>(context.store.projects, projectId, 'Project');
        });
    }

    let invoiceUpdates: Partial<Invoice> & Record<string, unknown>;

    try {
        invoiceUpdates = buildDraftInvoiceUpdates(existing, updates, getNow(context));
    } catch (error) {
        if (error instanceof InvoiceDraftValidationError) {
            throw new AgentCommandError('INVALID_INPUT', error.message, error.details);
        }

        throw error;
    }

    const invoice = updateValidatedEntity<Invoice>(
        context.store.invoices as any,
        'invoices',
        invoiceId,
        invoiceUpdates,
        `agent update invoice draft ${invoiceId}`
    );

    return {
        invoice,
        sideEffects: {
            createsInvoice: false,
            marksEntriesBilled: false,
            marksExpensesBilled: false,
            updatesTaskBillingCutoffs: false,
            updatesProjectInvoiceReferences: false,
            advancesInvoiceSequence: false,
        },
    };
}

export function finalizeInvoiceCommand(
    context: AgentCommandContext,
    input: FinalizeInvoiceInput
): Promise<FinalizedInvoiceResult> {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'billing');

    return withIdempotency(context, input.idempotencyKey, async () => {
        if (input.confirmFinalize !== true) {
            throw new AgentCommandError('INVALID_INPUT', 'Invoice finalization requires confirmFinalize: true.');
        }

        const invoiceId = requireString(input.invoiceId, 'invoiceId');
        const persistedOperation = input.idempotencyKey
            ? readEntity<InvoiceBillingOperation>(context.store.invoiceBillingOperations.get(input.idempotencyKey))
            : null;
        const replayedOperation = isInvoiceBillingOperation(persistedOperation) ? persistedOperation : null;

        if (persistedOperation && !replayedOperation) {
            throw new AgentCommandError('CONFLICT', 'The persisted billing operation is invalid and cannot be replayed safely.', {
                idempotencyKey: input.idempotencyKey,
            });
        }

        if (replayedOperation) {
            if (replayedOperation.kind !== 'finalize' || replayedOperation.invoiceId !== invoiceId) {
                throw new AgentCommandError('CONFLICT', 'The idempotency key belongs to a different billing operation.', {
                    idempotencyKey: input.idempotencyKey,
                });
            }

            await context.store.reconcileInvoiceBillingOperations({ includeCompleted: true });
            const replayedInvoice = readRequiredEntity<Invoice>(context.store.invoices as any, invoiceId, 'Invoice');

            return {
                invoice: replayedInvoice,
                billedEntryCount: replayedOperation.application.billedEntryCount,
                billedExpenseCount: replayedOperation.application.billedExpenseCount,
                updatedTaskCount: replayedOperation.application.updatedTaskCount,
                updatedProjectInvoiceReferences: replayedOperation.application.updatedProjectInvoiceReferences,
                advancedInvoiceSequence: replayedOperation.application.advancedInvoiceSequence,
            };
        }

        const invoice = readRequiredEntity<Invoice>(context.store.invoices as any, invoiceId, 'Invoice');

        if (invoice.status !== 'draft') {
            throw new AgentCommandError('CONFLICT', 'Only draft invoices can be finalized by an agent.', {
                invoiceId,
                status: invoice.status,
            });
        }

        const finalizedAt = input.finalizedAt ?? getNow(context);
        const projects = collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent invoice finalize projects');
        const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent invoice finalize clients');
        const taskMaps = await collectTaskMapsForInvoiceFinalization(context);
        const tasks = taskMaps.flatMap((taskMap) => collectValidatedEntities<Task>('tasks', taskMap as any, 'agent invoice finalize tasks'));
        const entryMaps = await collectEntryMapsForInvoiceFinalization(context);
        const entries = entryMaps.flatMap((entryMap) => collectValidatedEntities<TimeEntry>(
            'timeEntries',
            entryMap as any,
            'agent invoice finalize time entries'
        ));
        const expenseMaps = await collectExpenseMapsForInvoiceFinalization(context);
        const expenses = expenseMaps.flatMap((expenseMap) => collectValidatedEntities<Expense>('expenses', expenseMap as any, 'agent invoice finalize expenses'));
        const invoiceTemplates = collectValidatedEntities<InvoiceTemplate & Record<string, unknown>>(
            'invoiceTemplates',
            context.store.invoiceTemplates as any,
            'agent invoice finalize templates'
        );
        const invoicesForSequence = collectValidatedEntities<Invoice>(
            'invoices',
            context.store.invoices as any,
            'agent invoice finalize sequence invoices'
        );
        let finalizationApplication: ReturnType<typeof buildInvoiceFinalizationApplication>['application'];

        try {
            finalizationApplication = buildInvoiceFinalizationApplication({
                invoice,
                projects,
                clients,
                tasks,
                entries,
                expenses,
                invoiceTemplate: resolveCurrentInvoiceTemplate(invoice, invoiceTemplates),
                invoices: invoicesForSequence,
                finalizedAt,
                createAdjustmentId: () => getId(context),
            }).application;
        } catch (error) {
            throw new AgentCommandError('CONFLICT', 'Unable to prepare invoice finalization side effects.', {
                invoiceId,
                reason: error instanceof Error ? error.message : 'finalization planning failed',
            });
        }

        const desiredInvoice: Invoice = {
            ...invoice,
            ...finalizationApplication.invoiceUpdates,
        };
        const finalizedInvoice = await context.store.commitInvoiceFinalization({
            operationId: input.idempotencyKey || getId(context),
            desiredInvoice,
            application: finalizationApplication,
            createdAt: finalizedAt,
        });

        return {
            invoice: finalizedInvoice,
            billedEntryCount: finalizationApplication.billedEntryCount,
            billedExpenseCount: finalizationApplication.billedExpenseCount,
            updatedTaskCount: finalizationApplication.updatedTaskCount,
            updatedProjectInvoiceReferences: finalizationApplication.updatedProjectInvoiceReferences,
            advancedInvoiceSequence: finalizationApplication.advancedInvoiceSequence,
        };
    });
}

export function markInvoicePaidCommand(
    context: AgentCommandContext,
    input: MarkInvoicePaidInput
): MarkInvoicePaidResult {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'billing');

    return withIdempotency(context, input.idempotencyKey, () => {
        if (input.confirmPaid !== true) {
            throw new AgentCommandError('INVALID_INPUT', 'Marking an invoice paid requires confirmPaid: true.');
        }

        const invoiceId = requireString(input.invoiceId, 'invoiceId');
        const invoice = readRequiredEntity<Invoice>(context.store.invoices as any, invoiceId, 'Invoice');
        if (invoice.status === 'draft') {
            throw new AgentCommandError('CONFLICT', 'Draft invoices must be finalized before they can be marked paid.', {
                invoiceId,
            });
        }
        const paidAt = input.paidAt ?? getNow(context);
        const preferredCurrency = normalizeCurrencyCode(
            typeof context.store.preferences?.get('currency') === 'string'
                ? context.store.preferences.get('currency') as string
                : undefined
        );
        const invoiceCurrency = normalizeCurrencyCode(invoice.currency || preferredCurrency);

        if (invoiceCurrency !== preferredCurrency && !input.exchangeRates) {
            throw new AgentCommandError('INVALID_INPUT', 'exchangeRates are required to mark a cross-currency invoice paid.', {
                invoiceCurrency,
                preferredCurrency,
            });
        }

        const paymentCurrencySnapshot = createInvoicePaymentCurrencySnapshot({
            invoice,
            preferredCurrency,
            exchangeRates: input.exchangeRates ?? null,
            capturedAt: paidAt,
        }) ?? undefined;
        const updatedInvoice = updateValidatedEntity<Invoice>(context.store.invoices as any, 'invoices', invoice.id, buildMarkInvoicePaidUpdates({
            paidAt,
            paymentCurrencySnapshot,
            updatedAt: paidAt,
        }), `agent mark invoice paid ${invoice.id}`);

        return {
            invoice: updatedInvoice,
            paymentCurrencySnapshotStored: Boolean(paymentCurrencySnapshot),
        };
    });
}

export function markInvoiceUnpaidCommand(
    context: AgentCommandContext,
    input: MarkInvoiceUnpaidInput
): MarkInvoiceUnpaidResult {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'billing');

    return withIdempotency(context, input.idempotencyKey, () => {
        if (input.confirmUnpaid !== true) {
            throw new AgentCommandError('INVALID_INPUT', 'Marking an invoice unpaid requires confirmUnpaid: true.');
        }

        const invoiceId = requireString(input.invoiceId, 'invoiceId');
        const invoice = readRequiredEntity<Invoice>(context.store.invoices as any, invoiceId, 'Invoice');
        const updatedAt = getNow(context);
        const referenceAt = typeof input.referenceAt === 'number' && Number.isFinite(input.referenceAt)
            ? input.referenceAt
            : updatedAt;
        const updatedInvoice = updateValidatedEntity<Invoice>(context.store.invoices as any, 'invoices', invoice.id, buildMarkInvoiceUnpaidUpdates({
            invoice,
            referenceAt,
            updatedAt,
        }), `agent mark invoice unpaid ${invoice.id}`);

        return {
            invoice: updatedInvoice,
            paymentCurrencySnapshotCleared: Boolean(invoice.paymentCurrencySnapshot),
        };
    });
}

export function undoLatestInvoiceCommand(
    context: AgentCommandContext,
    input: UndoLatestInvoiceInput
): Promise<UndoLatestInvoiceResult> {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'billing');

    return withIdempotency(context, input.idempotencyKey, async () => {
        if (input.confirmUndo !== true) {
            throw new AgentCommandError('INVALID_INPUT', 'Undoing an invoice requires confirmUndo: true.');
        }

        const invoiceId = requireString(input.invoiceId, 'invoiceId');
        const persistedOperation = input.idempotencyKey
            ? readEntity<InvoiceBillingOperation>(context.store.invoiceBillingOperations.get(input.idempotencyKey))
            : null;
        const replayedOperation = isInvoiceBillingOperation(persistedOperation) ? persistedOperation : null;

        if (persistedOperation && !replayedOperation) {
            throw new AgentCommandError('CONFLICT', 'The persisted billing operation is invalid and cannot be replayed safely.', {
                idempotencyKey: input.idempotencyKey,
            });
        }

        if (replayedOperation) {
            if (replayedOperation.kind !== 'undo' || replayedOperation.invoiceId !== invoiceId) {
                throw new AgentCommandError('CONFLICT', 'The idempotency key belongs to a different billing operation.', {
                    idempotencyKey: input.idempotencyKey,
                });
            }

            const expectedReplayConfirmation = replayedOperation.invoice.invoiceNumber || '';
            if (input.confirmationText?.trim() !== expectedReplayConfirmation) {
                throw new AgentCommandError(
                    'INVALID_INPUT',
                    `confirmationText must match invoice number ${expectedReplayConfirmation}.`,
                    { invoiceId }
                );
            }

            await context.store.reconcileInvoiceBillingOperations({ includeCompleted: true });

            return {
                invoiceNumber: replayedOperation.invoice.invoiceNumber || invoiceId,
                clearedTimeEntryCount: replayedOperation.application.clearedTimeEntryCount,
                deletedAdjustmentCount: replayedOperation.application.deletedAdjustmentCount,
                unbilledExpenseCount: replayedOperation.application.unbilledExpenseCount,
                rewoundSequence: replayedOperation.application.rewoundSequence,
            };
        }

        const invoice = readRequiredEntity<Invoice>(context.store.invoices as any, invoiceId, 'Invoice');
        const expectedConfirmation = invoice.invoiceNumber || '';

        if (input.confirmationText?.trim() !== expectedConfirmation) {
            throw new AgentCommandError('INVALID_INPUT', `confirmationText must match invoice number ${expectedConfirmation}.`, {
                invoiceId,
            });
        }

        const activeInvoices = collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent invoice undo invoices');
        const blockReason = getInvoiceUndoBlockReason(invoice, activeInvoices);

        if (blockReason) {
            throw new AgentCommandError('CONFLICT', blockReason, { invoiceId });
        }

        const undoneAt = input.undoneAt ?? getNow(context);
        const taskMaps = await collectTaskMapsForInvoiceFinalization(context);
        const expenseMaps = await collectExpenseMapsForInvoiceFinalization(context);
        const entryMaps = await collectEntryMapsForInvoiceFinalization(context);
        const entries = entryMaps
            .flatMap((entryMap) => collectValidatedEntities<TimeEntry>('timeEntries', entryMap as any, 'agent invoice undo time entries'));
        const tasks = taskMaps.flatMap((taskMap) => collectEntities<Task>(taskMap as any));
        const expenses = expenseMaps.flatMap((expenseMap) => collectEntities<Expense>(expenseMap as any));
        const template = resolveCurrentInvoiceTemplate(invoice, collectEntities(context.store.invoiceTemplates as any));
        const sequenceRollback = getInvoiceSequenceRollback(invoice, template, activeInvoices);
        const undoApplication = buildInvoiceUndoApplication({
            invoice,
            invoiceId,
            entries,
            expenses,
            tasks,
            projects: collectEntities(context.store.projects as any),
            sequenceRollback,
            templateId: template?.id,
            undoneAt,
        }).application;

        await context.store.commitInvoiceUndo({
            operationId: input.idempotencyKey || getId(context),
            invoice,
            application: undoApplication,
            createdAt: undoneAt,
        });

        return {
            invoiceNumber: invoice.invoiceNumber || invoiceId,
            clearedTimeEntryCount: undoApplication.clearedTimeEntryCount,
            deletedAdjustmentCount: undoApplication.deletedAdjustmentCount,
            unbilledExpenseCount: undoApplication.unbilledExpenseCount,
            rewoundSequence: undoApplication.rewoundSequence,
        };
    });
}

export async function exportInvoicePdfCommand(
    context: AgentCommandContext,
    input: ExportInvoicePdfInput
): Promise<ExportInvoicePdfResult> {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    const invoiceId = requireString(input.invoiceId, 'invoiceId');
    const invoice = readRequiredEntity<Invoice>(context.store.invoices as any, invoiceId, 'Invoice');
    const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent invoice pdf clients');
    const businessBrandAssets = context.store.businessBrandAssets
        ? collectValidatedEntities<BusinessBrandAsset>(
            'businessBrandAssets',
            context.store.businessBrandAssets as any,
            'agent invoice pdf business brand assets'
        )
        : [];
    const { generatePDF, getCurrentInvoiceHtmlContent } = await import('@/utils/pdfUtils');
    const htmlContent = getCurrentInvoiceHtmlContent(invoice as any, clients as any, businessBrandAssets as any);
    const filename = getInvoicePdfFilename(invoice, input.filename);

    await generatePDF(htmlContent, filename);

    return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        filename,
        downloadStarted: true,
    };
}

function getInvoicePdfFilename(invoice: Invoice, filename?: string): string {
    const trimmed = typeof filename === 'string' ? filename.trim() : '';

    if (trimmed) {
        return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
    }

    return `invoice-${invoice.invoiceNumber}.pdf`;
}

function buildProjectQuoteDocument(
    context: AgentCommandContext,
    input: ProjectQuoteInput
): Invoice & Record<string, unknown> {
    const projectId = requireString(input.projectId, 'projectId');
    const project = readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');
    const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent project quote clients');
    const tasks = collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent project quote tasks');
    const businessInfos = collectValidatedEntities<BusinessInfo>('businessInfos', context.store.businessInfos as any, 'agent project quote business infos');
    const paymentMethods = collectValidatedEntities<PaymentMethod>('paymentMethods', context.store.paymentMethods as any, 'agent project quote payment methods');
    const invoiceTemplates = collectValidatedEntities<InvoiceTemplate>('invoiceTemplates', context.store.invoiceTemplates as any, 'agent project quote templates');
    const client = input.clientId
        ? readRequiredEntity<Client>(context.store.clients as any, input.clientId, 'Client')
        : null;
    const businessInfo = input.businessInfoId
        ? readRequiredEntity<BusinessInfo>(context.store.businessInfos as any, input.businessInfoId, 'Business info')
        : null;
    const paymentMethod = input.paymentMethodId
        ? readRequiredEntity<PaymentMethod>(context.store.paymentMethods as any, input.paymentMethodId, 'Payment method')
        : null;
    const template = input.invoiceTemplateId
        ? readRequiredEntity<InvoiceTemplate>(context.store.invoiceTemplates as any, input.invoiceTemplateId, 'Invoice template')
        : null;
    const now = getNow(context);
    const quoteDate = input.quoteDate || toStorageDate(new Date(now));
    const quoteTimestamp = input.quoteTimestamp || getQuoteNumberTimestamp(new Date(now));

    try {
        const quote = buildQuoteDocumentData({
            project,
            tasks,
            clients,
            businessInfos,
            paymentMethods,
            invoiceTemplates,
            client,
            businessInfo,
            paymentMethod,
            template,
            note: input.note,
            quoteTasks: input.quoteTasks ? normalizeProjectQuoteTasks(input.quoteTasks, 'quoteTasks') : undefined,
            additionalTasks: input.additionalTasks ? normalizeProjectQuoteTasks(input.additionalTasks, 'additionalTasks') : undefined,
            quoteDate,
            quoteTimestamp,
            preferredCurrency: context.store.preferences.get('currency') as string | undefined,
        }) as Record<string, unknown>;
        const clientId = requireString(quote.clientId, 'quote.clientId');
        const invoiceNumber = requireString(quote.invoiceNumber, 'quote.invoiceNumber');

        return {
            ...quote,
            id: `QUOTE-${project.id}-${invoiceNumber}`,
            projectId: project.id,
            projectIds: [project.id],
            clientId,
            invoiceNumber,
            date: requireString(quote.date, 'quote.date'),
            dueDate: null,
            status: 'sent',
            items: [],
            subtotal: typeof quote.subtotal === 'number' ? quote.subtotal : 0,
            total: typeof quote.total === 'number' ? quote.total : 0,
            notes: typeof quote.note === 'string' ? quote.note : undefined,
            createdAt: now,
            updatedAt: now,
        } as Invoice & Record<string, unknown>;
    } catch (error) {
        if (error instanceof AgentCommandError) {
            throw error;
        }

        throw new AgentCommandError('INVALID_INPUT', error instanceof Error ? error.message : 'Unable to prepare project quote.', {
            projectId,
        });
    }
}

function normalizeProjectQuoteTasks(tasks: ProjectQuoteTaskInput[], field: string): ProjectQuoteTaskInput[] {
    if (!Array.isArray(tasks)) {
        throw new AgentCommandError('INVALID_INPUT', `${field} must be an array.`, { field });
    }

    return tasks.map((task, index) => {
        if (!task || typeof task !== 'object') {
            throw new AgentCommandError('INVALID_INPUT', `${field}[${index}] must be an object.`, { field: `${field}[${index}]` });
        }

        return {
            id: typeof task.id === 'string' && task.id.trim() ? task.id : undefined,
            title: requireString(task.title, `${field}[${index}].title`),
            hours: finiteOptionalNumber(task.hours, `${field}[${index}].hours`),
            hourlyRate: finiteOptionalNumber(task.hourlyRate, `${field}[${index}].hourlyRate`),
            flatRate: finiteOptionalNumber(task.flatRate, `${field}[${index}].flatRate`),
            quantity: finiteOptionalNumber(task.quantity, `${field}[${index}].quantity`),
            useFlatRate: task.useFlatRate === true,
            parentTaskId: typeof task.parentTaskId === 'string' ? task.parentTaskId : null,
        };
    });
}

function finiteOptionalNumber(value: unknown, field: string): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
        throw new AgentCommandError('INVALID_INPUT', `${field} must be a number.`, { field });
    }

    return numberValue;
}

function getProjectQuotePdfFilename(quote: Record<string, unknown>, filename?: string): string {
    const trimmed = typeof filename === 'string' ? filename.trim() : '';

    if (trimmed) {
        return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
    }

    const project = quote.project && typeof quote.project === 'object' ? quote.project as { title?: unknown } : null;
    const title = typeof project?.title === 'string' ? project.title : 'quote';
    const date = typeof quote.date === 'string' ? quote.date : toStorageDate(new Date());

    return getQuoteDownloadFilename(title, date);
}

export function previewProjectQuoteCommand(
    context: AgentCommandContext,
    input: ProjectQuoteInput
): ProjectQuotePreviewResult {
    assertReady(context);
    assertPermission(context, 'read');

    const quote = buildProjectQuoteDocument(context, input);

    return {
        projectId: quote.projectId,
        quote,
        sideEffects: {
            createsInvoice: false,
            marksEntriesBilled: false,
            marksExpensesBilled: false,
            updatesTaskBillingCutoffs: false,
            updatesProjectInvoiceReferences: false,
            advancesInvoiceSequence: false,
        },
    };
}

export async function exportProjectQuotePdfCommand(
    context: AgentCommandContext,
    input: ExportProjectQuotePdfInput
): Promise<ExportProjectQuotePdfResult> {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'export');

    const quote = buildProjectQuoteDocument(context, input);
    const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent project quote pdf clients');
    const businessBrandAssets = context.store.businessBrandAssets
        ? collectValidatedEntities<BusinessBrandAsset>(
            'businessBrandAssets',
            context.store.businessBrandAssets as any,
            'agent project quote pdf business brand assets'
        )
        : [];
    const { generatePDF, getCurrentInvoiceHtmlContent } = await import('@/utils/pdfUtils');
    const htmlContent = getCurrentInvoiceHtmlContent(quote as any, clients as any, businessBrandAssets as any);
    const filename = getProjectQuotePdfFilename(quote, input.filename);

    await generatePDF(htmlContent, filename);

    return {
        projectId: quote.projectId,
        quoteId: quote.id,
        quoteNumber: quote.invoiceNumber,
        filename,
        downloadStarted: true,
    };
}

export function previewProjectQuoteEmailCommand(
    context: AgentCommandContext,
    input: PreviewProjectQuoteEmailInput
): InvoiceEmailDraft {
    assertReady(context);
    assertPermission(context, 'read');

    const quote = buildProjectQuoteDocument(context, input);

    return buildProjectQuoteEmailDraft(context, quote, input);
}

export function sendProjectQuoteEmailCommand(
    context: AgentCommandContext,
    input: SendProjectQuoteEmailInput
): Promise<SendProjectQuoteEmailResult> {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'email');

    return withIdempotency<Promise<SendProjectQuoteEmailResult>>(context, input.idempotencyKey, async () => {
        if (input.confirmSend !== true) {
            throw new AgentCommandError('INVALID_INPUT', 'Sending a project quote email requires confirmSend: true.');
        }

        const sessionId = typeof context.driveSessionId === 'string' ? context.driveSessionId.trim() : '';

        if (!sessionId) {
            throw new AgentCommandError('UNAVAILABLE', 'Cloud sync must be connected before sending quote email.');
        }

        const quote = buildProjectQuoteDocument(context, input);
        const draft = buildProjectQuoteEmailDraft(context, quote, input);

        if (!draft.to.trim()) {
            throw new AgentCommandError('INVALID_INPUT', 'Recipient email is required.');
        }

        if (!draft.subject.trim()) {
            throw new AgentCommandError('INVALID_INPUT', 'Subject is required.');
        }

        if (draft.forwardToSelf && !draft.forwardTo) {
            throw new AgentCommandError('INVALID_INPUT', 'Reply-To or business email is required when forwarding a copy.');
        }

        const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent project quote email clients');
        const businessBrandAssets = context.store.businessBrandAssets
            ? collectValidatedEntities<BusinessBrandAsset>(
                'businessBrandAssets',
                context.store.businessBrandAssets as any,
                'agent project quote email business brand assets'
            )
            : [];
        const { getCurrentInvoiceHtmlContent, generatePDFBase64 } = await import('@/utils/pdfUtils');
        const { sendInvoiceEmail } = await import('@/utils/emailService');
        const htmlContent = getCurrentInvoiceHtmlContent(quote as any, clients as any, businessBrandAssets as any);
        const pdfBase64 = await generatePDFBase64(htmlContent);
        const result = await sendInvoiceEmail({
            sessionId,
            invoiceId: quote.id,
            invoiceNumber: quote.invoiceNumber,
            to: draft.to,
            forwardTo: draft.forwardTo || undefined,
            fromName: draft.fromName || undefined,
            subject: draft.subject,
            bodyText: draft.body,
            replyTo: draft.replyTo || undefined,
            pdfBase64,
            sendType: 'quote',
            attachmentTitle: draft.attachmentTitle,
        });

        return {
            projectId: quote.projectId,
            quoteId: quote.id,
            quoteNumber: quote.invoiceNumber,
            sendType: 'quote',
            to: draft.to,
            forwarded: typeof result.forwarded === 'boolean' ? result.forwarded : null,
            remaining: typeof result.remaining === 'number' ? result.remaining : null,
            updatedInvoice: false,
            sentAt: null,
        };
    });
}

export function previewInvoiceEmailCommand(
    context: AgentCommandContext,
    input: PreviewInvoiceEmailInput
): InvoiceEmailDraft {
    assertReady(context);
    assertPermission(context, 'read');

    const invoiceId = requireString(input.invoiceId, 'invoiceId');
    const invoice = readRequiredEntity<Invoice>(context.store.invoices as any, invoiceId, 'Invoice');

    return buildInvoiceEmailDraft(context, invoice, input);
}

export function sendInvoiceEmailCommand(
    context: AgentCommandContext,
    input: SendInvoiceEmailInput
): Promise<SendInvoiceEmailResult> {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');
    assertPermission(context, 'email');

    return withIdempotency(context, input.idempotencyKey, async () => {
        if (input.confirmSend !== true) {
            throw new AgentCommandError('INVALID_INPUT', 'Sending an invoice email requires confirmSend: true.');
        }

        const sessionId = typeof context.driveSessionId === 'string' ? context.driveSessionId.trim() : '';

        if (!sessionId) {
            throw new AgentCommandError('UNAVAILABLE', 'Cloud sync must be connected before sending invoice email.');
        }

        const invoiceId = requireString(input.invoiceId, 'invoiceId');
        const invoice = readRequiredEntity<Invoice>(context.store.invoices as any, invoiceId, 'Invoice');
        const draft = buildInvoiceEmailDraft(context, invoice, input);

        if (draft.sendType !== 'quote' && invoice.status === 'draft') {
            throw new AgentCommandError('CONFLICT', 'Draft invoices must be finalized before they can be emailed.', {
                invoiceId,
            });
        }

        if (!draft.to.trim()) {
            throw new AgentCommandError('INVALID_INPUT', 'Recipient email is required.');
        }

        if (!draft.subject.trim()) {
            throw new AgentCommandError('INVALID_INPUT', 'Subject is required.');
        }

        if (draft.forwardToSelf && !draft.forwardTo) {
            throw new AgentCommandError('INVALID_INPUT', 'Reply-To or business email is required when forwarding a copy.');
        }

        const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent invoice email clients');
        const businessBrandAssets = context.store.businessBrandAssets
            ? collectValidatedEntities<BusinessBrandAsset>(
                'businessBrandAssets',
                context.store.businessBrandAssets as any,
                'agent invoice email business brand assets'
            )
            : [];
        const { getCurrentInvoiceHtmlContent, generatePDFBase64 } = await import('@/utils/pdfUtils');
        const { sendInvoiceEmail } = await import('@/utils/emailService');
        const htmlContent = getCurrentInvoiceHtmlContent(invoice as any, clients as any, businessBrandAssets as any);
        const pdfBase64 = await generatePDFBase64(htmlContent);
        const result = await sendInvoiceEmail({
            sessionId,
            invoiceId: invoice.id || invoice.projectId || invoice.invoiceNumber,
            invoiceNumber: invoice.invoiceNumber,
            to: draft.to,
            forwardTo: draft.forwardTo || undefined,
            fromName: draft.fromName || undefined,
            subject: draft.subject,
            bodyText: draft.body,
            replyTo: draft.replyTo || undefined,
            pdfBase64,
            sendType: draft.sendType,
            attachmentTitle: draft.attachmentTitle,
        });
        const sentAt = getNow(context);
        let updatedInvoice = false;
        let status = invoice.status;

        if (draft.sendType !== 'quote') {
            const updates: Partial<Invoice> = {
                sentAt,
                sentToEmail: draft.to,
            };

            updateValidatedEntity<Invoice>(
                context.store.invoices as any,
                'invoices',
                invoice.id,
                updates,
                'agent send invoice email'
            );
            updatedInvoice = true;
        }

        const latestInvoice = readEntity<Invoice>(context.store.invoices.get(invoice.id));

        return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            sendType: draft.sendType,
            to: draft.to,
            forwarded: typeof result.forwarded === 'boolean' ? result.forwarded : null,
            remaining: typeof result.remaining === 'number' ? result.remaining : null,
            updatedInvoice,
            status: latestInvoice?.status || status,
            sentAt: latestInvoice?.sentAt ?? (updatedInvoice ? sentAt : null),
        };
    });
}

function buildInvoiceEmailDraft(
    context: AgentCommandContext,
    invoice: Invoice,
    input: PreviewInvoiceEmailInput
): InvoiceEmailDraft {
    return resolveInvoiceEmailDraft({
        invoice,
        client: resolveInvoiceClient(context, invoice),
        businessInfo: resolveInvoiceBusinessInfo(context, invoice),
        emailTemplates: collectValidatedEntities<EmailTemplate>('emailTemplates', context.store.emailTemplates as any, 'agent invoice email templates'),
        sendType: normalizeEmailSendType(input.sendType),
        overrides: input,
        preferredCurrency: getAgentPreferredCurrency(context),
    });
}

function buildProjectQuoteEmailDraft(
    context: AgentCommandContext,
    quote: Invoice & Record<string, unknown>,
    input: PreviewProjectQuoteEmailInput
): InvoiceEmailDraft {
    return resolveInvoiceEmailDraft({
        invoice: quote,
        client: resolveInvoiceClient(context, quote),
        businessInfo: resolveInvoiceBusinessInfo(context, quote),
        emailTemplates: collectValidatedEntities<EmailTemplate>('emailTemplates', context.store.emailTemplates as any, 'agent project quote email templates'),
        sendType: 'quote',
        preferredCurrency: getAgentPreferredCurrency(context),
        overrides: {
            ...input,
            templateId: input.emailTemplateId ?? null,
        },
    });
}

function getAgentPreferredCurrency(context: AgentCommandContext): string {
    const value = context.store.preferences.get('currency');
    return normalizeCurrencyCode(typeof value === 'string' ? value : undefined);
}

function normalizeEmailSendType(sendType: EmailSendType | undefined): EmailSendType {
    if (!sendType) {
        return 'invoice';
    }

    if (sendType === 'invoice' || sendType === 'reminder' || sendType === 'quote') {
        return sendType;
    }

    throw new AgentCommandError('INVALID_INPUT', 'sendType must be invoice, reminder, or quote.');
}

function resolveInvoiceClient(context: AgentCommandContext, invoice: Invoice): Client | null {
    return readEntity<Client>(context.store.clients.get(invoice.clientId)) || null;
}

function resolveInvoiceBusinessInfo(context: AgentCommandContext, invoice: Invoice): BusinessInfo | null {
    const embeddedBusinessInfoId = (invoice as any).businessInfo?.id;
    const businessInfoId = invoice.businessInfoId || (typeof embeddedBusinessInfoId === 'string' ? embeddedBusinessInfoId : null);

    if (businessInfoId) {
        const businessInfo = readEntity<BusinessInfo>(context.store.businessInfos.get(businessInfoId));

        if (businessInfo) {
            return businessInfo;
        }
    }

    const businessInfos = collectValidatedEntities<BusinessInfo>('businessInfos', context.store.businessInfos as any, 'agent invoice email business infos');

    return businessInfos.find((businessInfo) => businessInfo.isDefault) || businessInfos[0] || null;
}

async function collectTaskMapsForInvoiceFinalization(context: AgentCommandContext): Promise<Array<any>> {
    const maps = [context.store.tasks].filter(Boolean) as Array<any>;

    if (typeof context.store.loadArchivedTasks === 'function') {
        const archivedMap = await context.store.loadArchivedTasks();
        if (archivedMap && !maps.includes(archivedMap)) {
            maps.push(archivedMap);
        }
    } else if (context.store.archivedTasks && !maps.includes(context.store.archivedTasks)) {
        maps.push(context.store.archivedTasks);
    }

    return maps;
}

async function collectExpenseMapsForInvoiceFinalization(context: AgentCommandContext): Promise<Array<any>> {
    const maps = [context.store.expenses].filter(Boolean) as Array<any>;

    if (typeof context.store.loadArchivedExpenses === 'function') {
        const archivedMap = await context.store.loadArchivedExpenses();
        if (archivedMap && !maps.includes(archivedMap)) {
            maps.push(archivedMap);
        }
    } else if (context.store.archivedExpenses && !maps.includes(context.store.archivedExpenses)) {
        maps.push(context.store.archivedExpenses);
    }

    return maps;
}

async function collectEntryMapsForInvoiceFinalization(context: AgentCommandContext): Promise<Array<any>> {
    const maps = [context.store.activeTimeEntries].filter(Boolean) as Array<any>;
    const getAvailableYears = context.store.getAvailableYears;
    const loadEntriesForYear = context.store.loadEntriesForYear;

    if (typeof getAvailableYears !== 'function' || typeof loadEntriesForYear !== 'function') {
        return maps;
    }

    const years = await getAvailableYears.call(context.store);

    await Promise.all(years.map(async (year: number) => {
        const yearMap = await loadEntriesForYear.call(context.store, year);

        if (yearMap && !maps.includes(yearMap)) {
            maps.push(yearMap);
        }
    }));

    return maps;
}
