import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { toStorageDate } from '@/utils/dateUtils';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import { cleanupAttachmentsForEntity } from '@/stores/yjs/collections/plannerAttachments';
import { collectEntities } from '@/stores/yjs/entityUtils';
import { buildClientDeleteImpactPlan } from '@/domain/deletions/clientDeletion';
import type { Client, Expense, ExpenseRecurrence, Invoice, MultiTimerState, PlannerAttachment, Project, Task, TimeEntry } from '@/stores/yjs/types';
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

export interface ListClientsCommandInput {
    includeArchived?: boolean;
}

export interface CreateClientCommandInput extends Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    title: string;
    createdAt?: number;
    updatedAt?: number;
    idempotencyKey?: string;
}

export interface UpdateClientCommandInput {
    clientId: string;
    updates: Partial<Client>;
}

export interface ArchiveClientCommandInput {
    clientId: string;
}

export interface DeleteClientCommandInput {
    clientId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface PreviewDeleteClientCommandInput {
    clientId: string;
    alsoDeleteProjects?: boolean;
    includeInvoiceDeletion?: boolean;
}

export interface PreviewDeleteClientResult {
    clientId: string;
    title: string;
    alsoDeleteProjects: boolean;
    includeInvoiceDeletion: boolean;
    projectIdsToDelete: string[];
    projectIdsToConvertToPersonal: string[];
    activeTaskIdsToDelete: string[];
    archivedTaskIdsToDelete: string[];
    timeEntryIdsToDelete: string[];
    billedTimeEntryIds: string[];
    timerKeysToClear: string[];
    invoiceIds: string[];
    sharedInvoiceIds: string[];
    expenseIdsToDelete: string[];
    billedExpenseIds: string[];
    taxClaimedExpenseIds: string[];
    recurrenceIdsToDelete: string[];
    plannerAttachmentIdsToDelete: string[];
    canCascadeDeleteSafely: boolean;
    blockingReasons: string[];
}

export interface CascadeDeleteClientCommandInput {
    clientId: string;
    alsoDeleteProjects?: boolean;
    confirmDelete?: boolean;
    confirmationText?: string;
    expectedProjectIdsToDelete?: string[];
    expectedProjectIdsToConvertToPersonal?: string[];
    expectedTaskIds?: string[];
    expectedTimeEntryIds?: string[];
    expectedTimerKeys?: string[];
    expectedExpenseIds?: string[];
    expectedRecurrenceIds?: string[];
    expectedPlannerAttachmentIds?: string[];
}

export interface CascadeDeleteClientResult {
    clientId: string;
    title: string;
    deleted: true;
    alsoDeleteProjects: boolean;
    deletedProjectIds: string[];
    convertedProjectIds: string[];
    deletedTaskIds: string[];
    deletedTimeEntryIds: string[];
    clearedTimerKeys: string[];
    deletedExpenseIds: string[];
    deletedRecurrenceIds: string[];
    removedPlannerAttachmentCount: number;
}

export interface DeleteClientResult {
    clientId: string;
    title: string;
    deleted: true;
    removedPlannerAttachmentCount: number;
}

function assertConfirmedClientDelete(input: DeleteClientCommandInput, clientId: string): void {
    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete a client.', { clientId });
    }

    if (input.confirmationText !== clientId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match clientId to delete a client.', { clientId });
    }
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort();
}

function assertArrayMatches(label: string, expected: string[] | undefined, actual: string[]): void {
    const normalizedExpected = uniqueSorted(Array.isArray(expected) ? expected : []);
    const normalizedActual = uniqueSorted(actual);
    const matches = normalizedExpected.length === normalizedActual.length
        && normalizedExpected.every((value, index) => value === normalizedActual[index]);

    if (!matches) {
        throw new AgentCommandError('CONFLICT', `${label} no longer matches the current delete preview. Refresh the preview before deleting.`, {
            expected: normalizedExpected,
            actual: normalizedActual,
        });
    }
}

export function listClientsCommand(context: AgentCommandContext, input: ListClientsCommandInput = {}): Client[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent list clients')
        .filter((client) => input.includeArchived || !client.archived)
        .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
}

export function createClientCommand(context: AgentCommandContext, input: CreateClientCommandInput): Client {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const title = requireString(input.title, 'title');
        const now = getNow(context);
        const id = input.id || getId(context);
        const client = createValidatedEntity<Client>(context.store.clients as any, 'clients', {
            ...input,
            id,
            title,
            archived: input.archived ?? false,
            archivedOnDate: input.archivedOnDate ?? null,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        }, `agent create client ${id}`);

        markMeaningfulActivity('client_create');
        return client;
    });
}

export function updateClientCommand(context: AgentCommandContext, input: UpdateClientCommandInput): Client {
    assertReady(context);
    assertPermission(context, 'write');

    const clientId = requireString(input.clientId, 'clientId');
    readRequiredEntity<Client>(context.store.clients as any, clientId, 'Client');
    const updated = updateValidatedEntity<Client>(context.store.clients as any, 'clients', clientId, {
        ...(input.updates || {}),
        updatedAt: getNow(context),
    }, `agent update client ${clientId}`);

    markMeaningfulActivity('client_update');
    return updated;
}

export function archiveClientCommand(context: AgentCommandContext, input: ArchiveClientCommandInput): Client {
    assertReady(context);
    assertPermission(context, 'write');

    const clientId = requireString(input.clientId, 'clientId');
    readRequiredEntity<Client>(context.store.clients as any, clientId, 'Client');
    const updated = updateValidatedEntity<Client>(context.store.clients as any, 'clients', clientId, {
        archived: true,
        archivedOnDate: toStorageDate(new Date(getNow(context))),
        updatedAt: getNow(context),
    }, `agent archive client ${clientId}`);

    markMeaningfulActivity('client_archive');
    return updated;
}

export function unarchiveClientCommand(context: AgentCommandContext, input: ArchiveClientCommandInput): Client {
    assertReady(context);
    assertPermission(context, 'write');

    const clientId = requireString(input.clientId, 'clientId');
    readRequiredEntity<Client>(context.store.clients as any, clientId, 'Client');
    const updated = updateValidatedEntity<Client>(context.store.clients as any, 'clients', clientId, {
        archived: false,
        archivedOnDate: null,
        updatedAt: getNow(context),
    }, `agent unarchive client ${clientId}`);

    markMeaningfulActivity('client_unarchive');
    return updated;
}

export async function previewDeleteClientCommand(context: AgentCommandContext, input: PreviewDeleteClientCommandInput): Promise<PreviewDeleteClientResult> {
    assertReady(context);
    assertPermission(context, 'read');

    const clientId = requireString(input.clientId, 'clientId');
    const archivedMap = await context.store.loadArchivedTasks();
    const plan = buildClientDeleteImpactPlan({
        clientId,
        alsoDeleteProjects: input.alsoDeleteProjects === true,
        includeInvoiceDeletion: input.includeInvoiceDeletion === true,
        clients: collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent preview delete client lookup'),
        projects: collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent preview delete client projects'),
        activeTasks: collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent preview delete client active tasks'),
        archivedTasks: collectValidatedEntities<Task>('tasks', archivedMap as any, 'agent preview delete client archived tasks'),
        timeEntries: context.store.getAllTimeEntries() as TimeEntry[],
        timers: collectValidatedEntities<MultiTimerState>('timers', context.store.timers as any, 'agent preview delete client timers'),
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent preview delete client invoices'),
        expenses: collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent preview delete client expenses'),
        expenseRecurrences: collectValidatedEntities<ExpenseRecurrence>('expenseRecurrences', context.store.expenseRecurrences as any, 'agent preview delete client recurrences'),
        plannerAttachments: collectEntities<PlannerAttachment>(context.store.plannerAttachments as any),
    });

    if (!plan) {
        throw new AgentCommandError('NOT_FOUND', 'Client not found.', { clientId });
    }

    return {
        ...plan,
    };
}

export async function cascadeDeleteClientCommand(context: AgentCommandContext, input: CascadeDeleteClientCommandInput): Promise<CascadeDeleteClientResult> {
    assertReady(context);
    assertPermission(context, 'write');

    const clientId = requireString(input.clientId, 'clientId');
    assertConfirmedClientDelete(input, clientId);
    const alsoDeleteProjects = input.alsoDeleteProjects === true;
    const preview = await previewDeleteClientCommand(context, {
        clientId,
        alsoDeleteProjects,
        includeInvoiceDeletion: false,
    });

    assertArrayMatches('expectedProjectIdsToDelete', input.expectedProjectIdsToDelete, preview.projectIdsToDelete);
    assertArrayMatches('expectedProjectIdsToConvertToPersonal', input.expectedProjectIdsToConvertToPersonal, preview.projectIdsToConvertToPersonal);
    assertArrayMatches('expectedTaskIds', input.expectedTaskIds, [...preview.activeTaskIdsToDelete, ...preview.archivedTaskIdsToDelete]);
    assertArrayMatches('expectedTimeEntryIds', input.expectedTimeEntryIds, preview.timeEntryIdsToDelete);
    assertArrayMatches('expectedTimerKeys', input.expectedTimerKeys, preview.timerKeysToClear);
    assertArrayMatches('expectedExpenseIds', input.expectedExpenseIds, preview.expenseIdsToDelete);
    assertArrayMatches('expectedRecurrenceIds', input.expectedRecurrenceIds, preview.recurrenceIdsToDelete);
    assertArrayMatches('expectedPlannerAttachmentIds', input.expectedPlannerAttachmentIds, preview.plannerAttachmentIdsToDelete);

    if (!preview.canCascadeDeleteSafely || preview.invoiceIds.length > 0) {
        throw new AgentCommandError('CONFLICT', 'Client cascade delete is blocked by invoice, billed-time, billed-expense, or tax-claimed references.', {
            clientId,
            blockingReasons: preview.blockingReasons,
            invoiceIds: preview.invoiceIds,
            billedTimeEntryIds: preview.billedTimeEntryIds,
            billedExpenseIds: preview.billedExpenseIds,
            taxClaimedExpenseIds: preview.taxClaimedExpenseIds,
        });
    }

    const archivedMap = await context.store.loadArchivedTasks();
    let removedPlannerAttachmentCount = 0;
    const deletedTaskIds = [...preview.activeTaskIdsToDelete, ...preview.archivedTaskIdsToDelete].sort();

    context.store.activeEntriesDoc.transact(() => {
        preview.timeEntryIdsToDelete.forEach((entryId) => {
            context.store.activeTimeEntries.delete(entryId);
        });
    });

    context.store.coreDoc.transact(() => {
        preview.timerKeysToClear.forEach((timerKey) => {
            context.store.timers.delete(timerKey);
        });

        preview.expenseIdsToDelete.forEach((expenseId) => {
            context.store.expenses.delete(expenseId);
        });

        preview.recurrenceIdsToDelete.forEach((recurrenceId) => {
            context.store.expenseRecurrences.delete(recurrenceId);
        });

        if (alsoDeleteProjects) {
            deletedTaskIds.forEach((taskId) => {
                context.store.tasks.delete(taskId);
                removedPlannerAttachmentCount += cleanupAttachmentsForEntity(context.store.plannerAttachments as any, taskId);
            });

            preview.projectIdsToDelete.forEach((projectId) => {
                context.store.projects.delete(projectId);
                removedPlannerAttachmentCount += cleanupAttachmentsForEntity(context.store.plannerAttachments as any, projectId);
            });
        } else {
            preview.projectIdsToConvertToPersonal.forEach((projectId) => {
                updateValidatedEntity<Project>(context.store.projects as any, 'projects', projectId, {
                    preferredClientId: null,
                    hourlyRate: null,
                    flatRate: false,
                    isPersonal: true,
                    updatedAt: getNow(context),
                }, `agent cascade delete client convert project ${projectId}`);
            });
        }

        context.store.clients.delete(clientId);
        removedPlannerAttachmentCount += cleanupAttachmentsForEntity(context.store.plannerAttachments as any, clientId);
    });

    if (alsoDeleteProjects) {
        preview.archivedTaskIdsToDelete.forEach((taskId) => {
            archivedMap.delete(taskId);
        });
    }

    markMeaningfulActivity('client_delete');

    return {
        clientId,
        title: preview.title,
        deleted: true,
        alsoDeleteProjects,
        deletedProjectIds: preview.projectIdsToDelete,
        convertedProjectIds: preview.projectIdsToConvertToPersonal,
        deletedTaskIds,
        deletedTimeEntryIds: preview.timeEntryIdsToDelete,
        clearedTimerKeys: preview.timerKeysToClear,
        deletedExpenseIds: preview.expenseIdsToDelete,
        deletedRecurrenceIds: preview.recurrenceIdsToDelete,
        removedPlannerAttachmentCount,
    };
}

export function deleteClientCommand(context: AgentCommandContext, input: DeleteClientCommandInput): DeleteClientResult {
    assertReady(context);
    assertPermission(context, 'write');

    const clientId = requireString(input.clientId, 'clientId');
    assertConfirmedClientDelete(input, clientId);
    const plan = buildClientDeleteImpactPlan({
        clientId,
        alsoDeleteProjects: false,
        includeInvoiceDeletion: false,
        clients: collectValidatedEntities<Client>('clients', context.store.clients as any, 'agent delete client lookup'),
        projects: collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent delete client project refs'),
        activeTasks: [],
        archivedTasks: [],
        timeEntries: [],
        timers: [],
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent delete client invoice refs'),
        expenses: collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent delete client expense refs'),
        expenseRecurrences: collectValidatedEntities<ExpenseRecurrence>('expenseRecurrences', context.store.expenseRecurrences as any, 'agent delete client recurrence refs'),
        plannerAttachments: collectEntities<PlannerAttachment>(context.store.plannerAttachments as any),
    });

    if (!plan) {
        throw new AgentCommandError('NOT_FOUND', 'Client not found.', { clientId });
    }

    if (plan.projectIdsToConvertToPersonal.length > 0 || plan.invoiceIds.length > 0 || plan.expenseIdsToDelete.length > 0 || plan.recurrenceIdsToDelete.length > 0) {
        throw new AgentCommandError('CONFLICT', 'Client is still referenced and cannot be hard-deleted through the agent path. Archive it or remove related records explicitly first.', {
            clientId,
            projectReferences: plan.projectIdsToConvertToPersonal,
            invoiceReferences: plan.invoiceIds,
            expenseReferences: plan.expenseIdsToDelete,
            recurrenceReferences: plan.recurrenceIdsToDelete,
        });
    }

    let removedPlannerAttachmentCount = 0;
    context.store.coreDoc.transact(() => {
        context.store.clients.delete(clientId);
        removedPlannerAttachmentCount = cleanupAttachmentsForEntity(context.store.plannerAttachments as any, clientId);
    });

    markMeaningfulActivity('client_delete');

    return {
        clientId,
        title: plan.title,
        deleted: true,
        removedPlannerAttachmentCount,
    };
}
