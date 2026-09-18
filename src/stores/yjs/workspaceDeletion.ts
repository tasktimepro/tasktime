import type { YjsStore } from './YjsStore';
import type { Client, Expense, ExpenseRecurrence, Invoice, MultiTimerState, PlannerAttachment, Project, Task, TimeEntry } from './types';
import { collectEntities, readEntity, updateEntityFields } from './entityUtils';
import { collectValidatedEntities } from './validation';
import { buildTaskDeleteImpactPlan } from '@/domain/deletions/taskDeletion';
import { buildProjectDeleteImpactPlan } from '@/domain/deletions/projectDeletion';
import { buildClientDeleteImpactPlan } from '@/domain/deletions/clientDeletion';
import { buildConvertedPersonalProjectUpdates } from '@/domain/deletions/deleteApplication';
import { assertExpenseCanBeDeleted } from '@/domain/expenses/expenseOperations';
import { invoiceBelongsToProject } from '@/utils/invoiceUtils';

export type WorkspaceDeletionRequest = {
    kind: 'task' | 'project' | 'client';
    id: string;
    includeInvoiceDeletion?: boolean;
    alsoDeleteProjects?: boolean;
};

export type WorkspaceDeletionSources = {
    projects: Project[]; clients: Client[]; activeTasks: Task[]; archivedTasks: Task[];
    timeEntries: TimeEntry[]; invoices: Invoice[]; expenses: Expense[];
    timers: MultiTimerState[]; expenseRecurrences: ExpenseRecurrence[]; plannerAttachments: PlannerAttachment[];
};

const unique = <T extends { id: string }>(items: T[]): T[] => [...new Map(items.map(item => [item.id, item])).values()];

/** Read only after all local history has loaded; never plan a cascade from a view's filters. */
export async function loadWorkspaceDeletionSources(store: YjsStore): Promise<WorkspaceDeletionSources> {
    // Lazy provider manifest writes must stay ordered.
    await store.loadArchivedTasks();
    await store.loadAllTimeEntries();
    await store.loadArchivedInvoices();
    await store.loadArchivedExpenses();
    store.assertWorkspaceDeletionReady();
    return readWorkspaceDeletionSources(store);
}

export function readWorkspaceDeletionSources(store: YjsStore): WorkspaceDeletionSources {
    const collect = <T>(name: Parameters<typeof collectValidatedEntities>[0], map: any): T[] => {
        if (!map) return [];
        const items = collectValidatedEntities<T>(name, map, `workspace deletion ${name}`);
        if (items.length !== map.size) throw new Error('Some stored records could not be read. Resolve the data warning before deleting work.');
        return items;
    };
    const timeEntries = store.getLoadedDocuments().flatMap(doc => {
        return doc?.share.has('timeEntries') ? collect<TimeEntry>('timeEntries', doc.getMap('timeEntries')) : [];
    });
    return {
        projects: collect<Project>('projects', store.projects),
        clients: collect<Client>('clients', store.clients),
        activeTasks: collect<Task>('tasks', store.tasks),
        archivedTasks: collect<Task>('tasks', store.archivedTasks),
        timeEntries: unique(timeEntries),
        invoices: unique([...collect<Invoice>('invoices', store.invoices), ...collect<Invoice>('invoices', store.archivedInvoicesSync)]),
        expenses: unique([...collect<Expense>('expenses', store.expenses), ...collect<Expense>('expenses', store.archivedExpenses)]),
        timers: collect<MultiTimerState>('timers', store.timers),
        expenseRecurrences: collect<ExpenseRecurrence>('expenseRecurrences', store.expenseRecurrences),
        plannerAttachments: collect<PlannerAttachment>('plannerAttachments', store.plannerAttachments),
    };
}

export function planWorkspaceDeletion(sources: WorkspaceDeletionSources, request: WorkspaceDeletionRequest) {
    const plan = request.kind === 'task'
        ? buildTaskDeleteImpactPlan({ ...sources, taskId: request.id })
        : request.kind === 'project'
            ? buildProjectDeleteImpactPlan({ ...sources, projectId: request.id, includeInvoiceDeletion: request.includeInvoiceDeletion })
            : buildClientDeleteImpactPlan({ ...sources, clientId: request.id, alsoDeleteProjects: request.alsoDeleteProjects, includeInvoiceDeletion: request.includeInvoiceDeletion });
    if (!plan) throw new Error('This record no longer exists. Refresh the view and try again.');
    return plan;
}

export type WorkspaceDeletionPlan = ReturnType<typeof planWorkspaceDeletion>;

/** Delete named records from every loaded placement, including supported archive copies. */
export function deleteWorkspaceRecordIds(store: YjsStore, collection: string, ids: string[]): void {
    if (ids.length === 0) return;
    for (const doc of store.getLoadedDocuments()) {
        if (!doc?.share.has(collection)) continue;
        const map = doc.getMap(collection);
        doc.transact(() => ids.forEach(id => map.delete(id)));
    }
}

function targets(plan: WorkspaceDeletionPlan, request: WorkspaceDeletionRequest) {
    return {
        tasks: 'taskIdsToDelete' in plan ? plan.taskIdsToDelete : [...plan.activeTaskIdsToDelete, ...plan.archivedTaskIdsToDelete],
        projects: 'projectIdsToDelete' in plan ? plan.projectIdsToDelete : request.kind === 'project' ? [request.id] : [],
        clients: request.kind === 'client' ? [request.id] : [],
        entries: plan.timeEntryIdsToDelete,
        expenses: 'expenseIdsToDelete' in plan ? plan.expenseIdsToDelete : [],
        recurrences: 'recurrenceIdsToDelete' in plan ? plan.recurrenceIdsToDelete : [],
        invoices: request.includeInvoiceDeletion && 'invoiceIds' in plan ? plan.invoiceIds : [],
        conversions: 'projectIdsToConvertToPersonal' in plan ? plan.projectIdsToConvertToPersonal : [],
    };
}

function assertDeletionAllowed(store: YjsStore, sources: WorkspaceDeletionSources, plan: WorkspaceDeletionPlan, request: WorkspaceDeletionRequest) {
    if (collectEntities<any>(store.invoiceBillingOperations as any).some(operation => operation.state !== 'complete')) {
        throw new Error('An invoice operation is unfinished. Finish or recover it before deleting related work.');
    }
    if ('sharedInvoiceIds' in plan && plan.sharedInvoiceIds.length > 0) {
        throw new Error('Shared invoices reference this work. Archive it instead of deleting it.');
    }
    if ('invoiceIds' in plan && plan.invoiceIds.length > 0 && !request.includeInvoiceDeletion) {
        throw new Error('This record has invoices, including archived history. Archive it or explicitly include its invoices in the deletion.');
    }
    const selected = targets(plan, request);
    if (sources.timeEntries.some(entry => !selected.entries.includes(entry.id) && entry.billedInvoiceId && selected.invoices.includes(entry.billedInvoiceId))
        || [...sources.activeTasks, ...sources.archivedTasks].some(task => !selected.tasks.includes(task.id) && task.quotedAmountBilling?.invoiceId && selected.invoices.includes(task.quotedAmountBilling.invoiceId))) {
        throw new Error('An invoice still claims work outside this deletion. Archive instead, or resolve the invoice before deleting it.');
    }
    for (const expense of sources.expenses.filter(item => selected.expenses.includes(item.id))) {
        const invoiceWillBeDeleted = Boolean(expense.invoiceId && selected.invoices.includes(expense.invoiceId));
        assertExpenseCanBeDeleted(invoiceWillBeDeleted
            ? { ...expense, invoiceId: null, billedAt: undefined, billingStatus: 'unbilled' }
            : expense);
    }
}

/**
 * Explicit cascades remove dependents before parents and persist each boundary.
 * An interrupted attempt can leave a parent to retry; it cannot acknowledge a
 * parent deletion before the dependent deletions are durable. Existing dirty-doc
 * recovery owns cloud retries. No background orphan deletion or new journal.
 */
export async function deleteWorkspaceRecords(
    store: YjsStore,
    request: WorkspaceDeletionRequest,
    options: {
        validate?: (plan: WorkspaceDeletionPlan) => void;
        validateRemaining?: (plan: WorkspaceDeletionPlan) => void;
        onPhase?: (phase: string) => void;
    } = {},
): Promise<WorkspaceDeletionPlan> {
    await loadWorkspaceDeletionSources(store);
    await store.flushPersistence();
    store.assertWorkspaceDeletionReady();
    const sources = readWorkspaceDeletionSources(store);
    const plan = planWorkspaceDeletion(sources, request);
    options.validate?.(plan);
    assertDeletionAllowed(store, sources, plan, request);
    const selected = targets(plan, request);
    const taskIds = new Set(selected.tasks);
    const allTasks = [...sources.activeTasks, ...sources.archivedTasks];
    const taskBatches: string[][] = [];
    const remaining = new Set(selected.tasks);
    while (remaining.size > 0) {
        const parents = new Set(allTasks.filter(task => remaining.has(task.id)).map(task => task.parentTaskId));
        const leaves = [...remaining].filter(id => !parents.has(id));
        if (leaves.length === 0) throw new Error('Task relationships are inconsistent. Repair the hierarchy before deleting it.');
        taskBatches.push(leaves);
        leaves.forEach(id => remaining.delete(id));
    }
    const persistPhase = async (phase: string) => {
        await store.flushPersistence();
        options.onPhase?.(phase);
    };
    const checkRemaining = (current: WorkspaceDeletionSources) => {
        store.assertWorkspaceDeletionReady();
        const remainingPlan = planWorkspaceDeletion(current, request);
        options.validateRemaining?.(remainingPlan);
        assertDeletionAllowed(store, current, remainingPlan, request);
    };

    // All eligibility checks precede the first mutation, including tax/billing guards.
    deleteWorkspaceRecordIds(store, 'timeEntries', selected.entries);
    deleteWorkspaceRecordIds(store, 'timers', plan.timerKeysToClear);
    deleteWorkspaceRecordIds(store, 'plannerAttachments', plan.plannerAttachmentIdsToDelete);
    deleteWorkspaceRecordIds(store, 'expenses', selected.expenses);
    deleteWorkspaceRecordIds(store, 'expenseRecurrences', selected.recurrences);
    await persistPhase('dependents');

    checkRemaining(readWorkspaceDeletionSources(store));

    // Release only claims owned by invoices explicitly selected for deletion.
    for (const doc of store.getLoadedDocuments()) {
        for (const collection of ['expenses', 'tasks'] as const) {
            if (!doc.share.has(collection)) continue;
            const map = doc.getMap(collection);
            doc.transact(() => {
                for (const [id, value] of map) {
                    const item = readEntity<any>(value);
                    if (collection === 'expenses' && selected.invoices.includes(item?.invoiceId)) {
                        updateEntityFields(map as any, id, { invoiceId: null, billedAt: null, billingStatus: 'unbilled' });
                    }
                    if (collection === 'tasks' && selected.invoices.includes(item?.quotedAmountBilling?.invoiceId)) {
                        updateEntityFields(map as any, id, { quotedAmountBilling: null });
                    }
                }
            });
        }
    }
    deleteWorkspaceRecordIds(store, 'invoices', selected.invoices);
    await persistPhase('invoices');

    for (const batch of taskBatches) {
        const current = readWorkspaceDeletionSources(store);
        checkRemaining(current);
        if (current.timeEntries.some(entry => batch.includes(entry.taskId))
            || current.timers.some(timer => batch.includes(timer.taskId))
            || current.plannerAttachments.some(attachment => batch.includes(attachment.referenceId))
            || [...current.activeTasks, ...current.archivedTasks].some(task => task.parentTaskId && batch.includes(task.parentTaskId))) {
            throw new Error('Related work changed during deletion. The remaining tasks were kept; review them and retry.');
        }
        deleteWorkspaceRecordIds(store, 'tasks', batch);
        await persistPhase('tasks');
    }

    const current = readWorkspaceDeletionSources(store);
    if (request.kind !== 'task') checkRemaining(current);
    const parentIds = [...selected.projects, ...selected.clients];
    if (current.projects.some(project => project.preferredClientId && selected.clients.includes(project.preferredClientId) && !selected.projects.includes(project.id) && !selected.conversions.includes(project.id))
        || [...current.activeTasks, ...current.archivedTasks].some(task => task.projectId && selected.projects.includes(task.projectId))
        || current.timers.some(timer => selected.projects.includes(timer.projectId))
        || current.plannerAttachments.some(attachment => parentIds.includes(attachment.referenceId) || taskIds.has(attachment.referenceId))
        || current.expenses.some(expense => (expense.projectId && selected.projects.includes(expense.projectId)) || (expense.clientId && selected.clients.includes(expense.clientId)))
        || current.expenseRecurrences.some(recurrence => (recurrence.projectId && selected.projects.includes(recurrence.projectId)) || (recurrence.clientId && selected.clients.includes(recurrence.clientId)))
        || current.invoices.some(invoice => selected.clients.includes(invoice.clientId) || selected.projects.some(id => invoiceBelongsToProject(invoice, id)))
        || current.timeEntries.some(entry => taskIds.has(entry.taskId))) {
        throw new Error('Related work changed during deletion. The remaining project or client was kept; review it and retry.');
    }
    store.coreDoc.transact(() => {
        for (const id of selected.conversions) {
            const project = readEntity<Project>(store.projects.get(id));
            if (project?.preferredClientId === request.id) updateEntityFields(store.projects as any, id, buildConvertedPersonalProjectUpdates());
        }
        selected.projects.forEach(id => store.projects.delete(id));
        selected.clients.forEach(id => store.clients.delete(id));
    });
    await persistPhase('complete');
    return plan;
}
