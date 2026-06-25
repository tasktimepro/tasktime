import { collectValidatedEntities } from '@/stores/yjs/validation';
import { readEntity } from '@/stores/yjs/entityUtils';
import type { Client, Expense, Invoice, InvoiceItem, InvoiceTemplate, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { getProjectInvoicePreview, type ProjectInvoicePreview } from '@/utils/invoicePreviewUtils';
import { toStorageDate } from '@/utils/dateUtils';
import { createInvoicePaymentCurrencySnapshot, getInvoiceStatusAfterMarkingUnpaid, getNextSequentialNumberForTemplate, resolveCurrentInvoiceTemplate } from '@/utils/invoiceUtils';
import { normalizeCurrencyCode } from '@/utils/currencyUtils';
import { calculateDueDate, generateInvoiceNumber } from '@/components/invoice/utils/invoiceDateUtils';
import { planInvoiceFinalization } from '@/domain/invoices/invoiceFinalization';
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

export function previewInvoiceFromUnbilledWorkCommand(
    context: AgentCommandContext,
    input: PreviewInvoiceFromUnbilledWorkInput
): InvoiceUnbilledWorkPreview {
    assertReady(context);
    assertPermission(context, 'read');

    const project = readRequiredEntity<Project>(context.store.projects as any, input.projectId, 'Project');
    const clients = collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent invoice preview clients');
    const tasks = collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent invoice preview tasks');
    const expenses = collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent invoice preview expenses');
    const timeEntries = context.store.getAllTimeEntries()
        .filter((entry): entry is TimeEntry => !!entry && typeof entry.id === 'string' && typeof entry.taskId === 'string');
    const preview = getProjectInvoicePreview(project, {
        clients,
        tasks,
        expenses,
        timeEntries,
        exchangeRates: input.exchangeRates ?? null,
        billingPeriodStart: input.billingPeriodStart,
        billingPeriodEnd: input.billingPeriodEnd,
        includeClientLevelExpenses: input.includeClientLevelExpenses === true,
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

export function createInvoiceDraftFromUnbilledWorkCommand(
    context: AgentCommandContext,
    input: CreateInvoiceDraftFromUnbilledWorkInput
): InvoiceDraftFromUnbilledWork {
    assertReady(context);
    assertPermission(context, 'read');
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const projectId = requireString(input.projectId, 'projectId');
        const project = readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');
        const clientId = input.clientId || project.preferredClientId;

        if (!clientId) {
            throw new AgentCommandError('INVALID_INPUT', 'Project must have a client before an invoice draft can be created.');
        }

        readRequiredEntity<Client>(context.store.clients as any, clientId, 'Client');

        const previewResult = previewInvoiceFromUnbilledWorkCommand(context, {
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
        const taskMapById = mapEntitiesToSource(taskMaps);
        const entryMapById = mapEntitiesToSource(entryMaps);
        const expenseMapById = mapEntitiesToSource(expenseMaps);
        let finalizationPlan: ReturnType<typeof planInvoiceFinalization>;

        try {
            finalizationPlan = planInvoiceFinalization({
                invoice,
                projects,
                clients,
                tasks,
                entries,
                expenses,
                finalizedAt,
                createAdjustmentId: () => getId(context),
            });
        } catch (error) {
            throw new AgentCommandError('CONFLICT', 'Unable to prepare invoice finalization side effects.', {
                invoiceId,
                reason: error instanceof Error ? error.message : 'finalization planning failed',
            });
        }

        applyEntryMutations(entryMaps, () => {
            finalizationPlan.adjustmentEntryIdsToDelete.forEach((entryId) => {
                const entryMap = entryMapById.get(entryId);
                entryMap?.delete(entryId);
            });

            finalizationPlan.adjustmentEntriesToUpdate.forEach((adjustment) => {
                const entryMap = entryMapById.get(adjustment.id);
                if (!entryMap) return;

                updateValidatedEntity<TimeEntry>(entryMap as any, 'timeEntries', adjustment.id, adjustment.updates, `agent update invoice adjustment ${adjustment.id}`);
            });

            finalizationPlan.adjustmentEntriesToCreate.forEach((adjustment) => {
                createValidatedEntity<TimeEntry>(context.store.activeTimeEntries as any, 'timeEntries', {
                    id: adjustment.id,
                    ...adjustment.entry,
                }, `agent create invoice adjustment ${adjustment.id}`);
            });

            finalizationPlan.entriesToBill.forEach(({ entry, billedHourlyRate }) => {
                const entryMap = entryMapById.get(entry.id);
                if (!entryMap) return;

                updateValidatedEntity<TimeEntry>(entryMap as any, 'timeEntries', entry.id, {
                    billedAt: finalizedAt,
                    billedInvoiceId: invoice.id,
                    billedHourlyRate,
                    updatedAt: finalizedAt,
                }, `agent finalize invoice entry ${entry.id}`);
            });
        });

        let updatedProjectInvoiceReferences = false;
        let advancedInvoiceSequence = false;
        let finalizedInvoice: Invoice | undefined;

        context.store.coreDoc.transact(() => {
            finalizationPlan.expensesToBill.forEach((expense) => {
                const expenseMap = expenseMapById.get(expense.id);
                if (!expenseMap) return;

                updateValidatedEntity<Expense>(expenseMap as any, 'expenses', expense.id, {
                    billingStatus: 'billed',
                    invoiceId: invoice.id,
                    billedAt: finalizedAt,
                    updatedAt: finalizedAt,
                }, `agent finalize invoice expense ${expense.id}`);
            });

            finalizationPlan.updatedTaskIds.forEach((taskId) => {
                const taskMap = taskMapById.get(taskId);
                if (!taskMap) return;

                updateValidatedEntity<Task>(taskMap as any, 'tasks', taskId, {
                    lastBilledAt: finalizationPlan.nextTaskCutoffs.get(taskId) || null,
                    updatedAt: finalizedAt,
                }, `agent finalize invoice task ${taskId}`);
            });

            finalizationPlan.quotedTaskClaims.forEach((claim) => {
                const taskMap = taskMapById.get(claim.taskId);
                if (!taskMap) return;

                updateValidatedEntity<Task>(taskMap as any, 'tasks', claim.taskId, {
                    estimatedFlatAmount: null,
                    quotedAmountBilling: {
                        invoiceId: invoice.id,
                        billedAt: finalizedAt,
                        total: claim.total,
                    },
                    updatedAt: finalizedAt,
                }, `agent finalize invoice quoted task ${claim.taskId}`);
            });

            finalizationPlan.projectIdsToLink.forEach((projectId) => {
                const project = projects.find((candidate) => candidate.id === projectId);
                if (!project) return;

                const existingInvoiceIds = Array.isArray(project.invoiceIds) ? project.invoiceIds : [];
                if (existingInvoiceIds.includes(invoice.id)) return;

                const nextInvoiceIds = [...existingInvoiceIds, invoice.id];
                updateValidatedEntity<Project>(context.store.projects as any, 'projects', project.id, {
                    invoiceIds: nextInvoiceIds,
                    updatedAt: finalizedAt,
                }, `agent finalize invoice project ${project.id}`);
                updatedProjectInvoiceReferences = true;
            });

            const template = resolveCurrentInvoiceTemplate(invoice, collectValidatedEntities<InvoiceTemplate & Record<string, unknown>>(
                'invoiceTemplates',
                context.store.invoiceTemplates as any,
                'agent invoice finalize templates'
            ));

            if (template?.id && template.useSequentialNumbers) {
                const nextSequentialNumber = getNextSequentialNumberForTemplate(
                    template,
                    collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent invoice finalize sequence invoices')
                );

                updateValidatedEntity<InvoiceTemplate>(context.store.invoiceTemplates as any, 'invoiceTemplates', template.id, {
                    currentSequentialNumber: nextSequentialNumber,
                }, `agent finalize invoice template ${template.id}`);
                advancedInvoiceSequence = true;
            }

            finalizedInvoice = updateValidatedEntity<Invoice>(context.store.invoices as any, 'invoices', invoice.id, {
                status: 'sent',
                sentAt: finalizedAt,
                billingStateSnapshot: {
                    version: 1,
                    capturedAt: finalizedAt,
                    taskLastBilledAt: finalizationPlan.taskLastBilledAt,
                },
                agentDraft: finalizationPlan.agentDraft
                    ? {
                        ...finalizationPlan.agentDraft,
                        finalizationState: 'finalized',
                        finalizedAt,
                    }
                    : undefined,
                updatedAt: finalizedAt,
            }, `agent finalize invoice ${invoice.id}`);
        });

        return {
            invoice: finalizedInvoice!,
            billedEntryCount: finalizationPlan.entriesToBill.length,
            billedExpenseCount: finalizationPlan.expensesToBill.length,
            updatedTaskCount: finalizationPlan.updatedTaskIds.size,
            updatedProjectInvoiceReferences,
            advancedInvoiceSequence,
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
        const updatedInvoice = updateValidatedEntity<Invoice>(context.store.invoices as any, 'invoices', invoice.id, {
            status: 'paid',
            paidAt,
            paymentCurrencySnapshot,
            updatedAt: paidAt,
        }, `agent mark invoice paid ${invoice.id}`);

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
        const updatedInvoice = updateValidatedEntity<Invoice>(context.store.invoices as any, 'invoices', invoice.id, {
            status: getInvoiceStatusAfterMarkingUnpaid(invoice, new Date(referenceAt)),
            paidAt: null,
            paymentCurrencySnapshot: undefined,
            updatedAt,
        }, `agent mark invoice unpaid ${invoice.id}`);

        return {
            invoice: updatedInvoice,
            paymentCurrencySnapshotCleared: Boolean(invoice.paymentCurrencySnapshot),
        };
    });
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

function mapEntitiesToSource(maps: Array<any>): Map<string, any> {
    const sourceById = new Map<string, any>();

    maps.forEach((map) => {
        map?.forEach?.((value: unknown, id: string) => {
            if (sourceById.has(id)) {
                return;
            }

            if (readEntity(value)) {
                sourceById.set(id, map);
            }
        });
    });

    return sourceById;
}

function applyEntryMutations(entryMaps: Array<any>, mutate: () => void): void {
    const docs = Array.from(new Set(entryMaps.map((entryMap) => entryMap?.doc).filter(Boolean)));

    if (docs.length === 1 && typeof docs[0].transact === 'function') {
        docs[0].transact(mutate);
        return;
    }

    mutate();
}

function buildDraftInvoiceItems(project: Project, preview: ProjectInvoicePreview): InvoiceItem[] {
    const items: InvoiceItem[] = [];

    if (preview.taskAmount > 0) {
        const quantity = preview.unbilledHours > 0 ? preview.unbilledHours : 1;
        const rate = Math.round((preview.taskAmount / quantity) * 100) / 100;

        items.push({
            description: `${project.title} work`,
            quantity,
            rate,
            amount: preview.taskAmount,
            projectId: project.id,
            lineType: 'project-subtotal',
            pricingMode: project.flatRate ? 'flat' : 'hourly',
        });
    }

    if (preview.expenseAmount > 0) {
        items.push({
            description: `${project.title} billable expenses`,
            quantity: 1,
            rate: preview.expenseAmount,
            amount: preview.expenseAmount,
            projectId: project.id,
            lineType: 'expense',
        });
    }

    return items;
}
