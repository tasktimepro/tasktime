import { collectValidatedEntities } from '@/stores/yjs/validation';
import type { Client, Expense, Invoice, MultiTimerState, Project, Task, TimeEntry } from '@/stores/yjs/types';
import type { AgentCommandContext } from '@/agent/types';
import {
    collectLegacyBilledTimeEntryIds,
    getInvoiceEligibleTimeEntries,
    hasExplicitBillingMarker,
} from '@/domain/invoices/invoiceEligibility';
import { getBillableDurationMs } from '@/utils/timeEntryDurationUtils';
import { isInvoiceOutstanding } from '@/utils/invoiceUtils';
import { assertPermission, assertReady, readRequiredEntity } from './shared';

const DEFAULT_RESULT_LIMIT = 25;
const MAX_RESULT_LIMIT = 100;

export interface AgentEntrySummary {
    id: string;
    taskId: string;
    projectId: string | null;
    start: number;
    end: number;
    durationMs: number;
    billableDurationMs: number;
    billed: boolean;
    billedInvoiceId?: string | null;
    note?: string;
}

export interface DashboardSummary {
    projectCount: number;
    taskCount: number;
    openTaskCount: number;
    completedTaskCount: number;
    activeTimerCount: number;
    unbilledEntryCount: number;
    unbilledDurationMs: number;
    billableExpenseCount: number;
    unbilledExpenseCount: number;
    draftInvoiceCount: number;
}

export interface ProjectOverview {
    project: Pick<Project, 'id' | 'title' | 'preferredClientId' | 'hourlyRate' | 'flatRate' | 'statusMode'>;
    taskCount: number;
    openTaskCount: number;
    completedTaskCount: number;
    activeTimerCount: number;
    unbilledEntryCount: number;
    unbilledDurationMs: number;
    billableExpenseCount: number;
    draftInvoiceCount: number;
}

export interface ClientOverview {
    client: Pick<Client, 'id' | 'title' | 'clientName' | 'email' | 'defaultCurrency'>;
    projectCount: number;
    activeProjectCount: number;
    billableExpenseCount: number;
    unbilledExpenseCount: number;
    draftInvoiceCount: number;
    openInvoiceTotal: number;
}

export interface EntryListInput {
    projectId?: string | null;
    taskId?: string | null;
    limit?: number;
}

function getLimit(limit?: number): number {
    if (!Number.isFinite(limit)) {
        return DEFAULT_RESULT_LIMIT;
    }

    return Math.max(1, Math.min(MAX_RESULT_LIMIT, Math.floor(limit as number)));
}

function getProjects(context: AgentCommandContext): Project[] {
    return collectValidatedEntities<Project>('projects', context.store.projects as any, 'agent query projects');
}

function getExpenses(context: AgentCommandContext): Expense[] {
    return collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent query expenses');
}

function getInvoices(context: AgentCommandContext): Invoice[] {
    return collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent query invoices');
}

function getTimers(context: AgentCommandContext): MultiTimerState[] {
    return collectValidatedEntities<MultiTimerState>('timers', context.store.timers as any, 'agent query timers');
}

async function getCompleteBillingData(context: AgentCommandContext): Promise<{
    tasks: Task[];
    entries: TimeEntry[];
    invoices: Invoice[];
}> {
    const [tasks, entries, invoices] = await Promise.all([
        context.store.getAllTasks(),
        context.store.loadAllTimeEntries(),
        context.store.getAllInvoices(),
    ]);

    return {
        tasks: tasks.filter((task): task is Task => Boolean(task?.id)),
        entries: entries.filter((entry): entry is TimeEntry => (
            Boolean(entry?.id)
            && typeof entry.taskId === 'string'
        )),
        invoices: invoices.filter((invoice): invoice is Invoice => Boolean(invoice?.id)),
    };
}

function getTaskProjectId(task: Task | undefined): string | null {
    if (!task) {
        return null;
    }

    return task.projectId || task.id;
}

function isEntryBilled(entry: TimeEntry, legacyBilledEntryIds: Set<string>): boolean {
    return hasExplicitBillingMarker(entry) || legacyBilledEntryIds.has(entry.id);
}

function summarizeEntry(
    entry: TimeEntry,
    taskById: Map<string, Task>,
    legacyBilledEntryIds: Set<string>
): AgentEntrySummary {
    const projectId = getTaskProjectId(taskById.get(entry.taskId));

    return {
        id: entry.id,
        taskId: entry.taskId,
        projectId,
        start: entry.start,
        end: entry.end,
        durationMs: Math.max(0, entry.end - entry.start),
        billableDurationMs: getBillableDurationMs(entry),
        billed: isEntryBilled(entry, legacyBilledEntryIds),
        billedInvoiceId: entry.billedInvoiceId,
        note: entry.note,
    };
}

function filterEntries(input: EntryListInput, entries: TimeEntry[], taskById: Map<string, Task>): TimeEntry[] {
    return entries
        .filter((entry) => !input.taskId || entry.taskId === input.taskId)
        .filter((entry) => {
            if (!input.projectId) {
                return true;
            }

            return getTaskProjectId(taskById.get(entry.taskId)) === input.projectId;
        });
}

export async function getDashboardSummaryCommand(context: AgentCommandContext): Promise<DashboardSummary> {
    assertReady(context);
    assertPermission(context, 'read');

    const projects = getProjects(context).filter((project) => !project.archived);
    const billingData = await getCompleteBillingData(context);
    const tasks = billingData.tasks.filter((task) => !task.archived);
    const expenses = getExpenses(context);
    const invoices = billingData.invoices;
    const unbilledEntries = getInvoiceEligibleTimeEntries({
        tasks: billingData.tasks,
        timeEntries: billingData.entries,
        invoices,
    });

    return {
        projectCount: projects.length,
        taskCount: tasks.length,
        openTaskCount: tasks.filter((task) => !task.completed).length,
        completedTaskCount: tasks.filter((task) => task.completed).length,
        activeTimerCount: getTimers(context).length,
        unbilledEntryCount: unbilledEntries.length,
        unbilledDurationMs: unbilledEntries.reduce((total, entry) => total + getBillableDurationMs(entry), 0),
        billableExpenseCount: expenses.filter((expense) => expense.billable).length,
        unbilledExpenseCount: expenses.filter((expense) => expense.billable && expense.billingStatus !== 'billed').length,
        draftInvoiceCount: invoices.filter((invoice) => invoice.status === 'draft').length,
    };
}

export async function getProjectOverviewCommand(
    context: AgentCommandContext,
    input: { projectId: string }
): Promise<ProjectOverview> {
    assertReady(context);
    assertPermission(context, 'read');

    const project = readRequiredEntity<Project>(context.store.projects as any, input.projectId, 'Project');
    const billingData = await getCompleteBillingData(context);
    const tasks = billingData.tasks.filter((task) => getTaskProjectId(task) === project.id && !task.archived);
    const taskById = new Map(billingData.tasks.map((task) => [task.id, task]));
    const unbilledEntries = filterEntries(
        { projectId: project.id },
        getInvoiceEligibleTimeEntries({
            tasks: billingData.tasks,
            timeEntries: billingData.entries,
            invoices: billingData.invoices,
        }),
        taskById
    );
    const expenses = getExpenses(context).filter((expense) => expense.projectId === project.id);
    const invoices = billingData.invoices.filter((invoice) => invoice.projectId === project.id || invoice.projectIds?.includes(project.id));

    return {
        project: {
            id: project.id,
            title: project.title,
            preferredClientId: project.preferredClientId,
            hourlyRate: project.hourlyRate,
            flatRate: project.flatRate,
            statusMode: project.statusMode,
        },
        taskCount: tasks.length,
        openTaskCount: tasks.filter((task) => !task.completed).length,
        completedTaskCount: tasks.filter((task) => task.completed).length,
        activeTimerCount: getTimers(context).filter((timer) => timer.projectId === project.id).length,
        unbilledEntryCount: unbilledEntries.length,
        unbilledDurationMs: unbilledEntries.reduce((total, entry) => total + getBillableDurationMs(entry), 0),
        billableExpenseCount: expenses.filter((expense) => expense.billable).length,
        draftInvoiceCount: invoices.filter((invoice) => invoice.status === 'draft').length,
    };
}

export function getClientOverviewCommand(context: AgentCommandContext, input: { clientId: string }): ClientOverview {
    assertReady(context);
    assertPermission(context, 'read');

    const client = readRequiredEntity<Client>(context.store.clients as any, input.clientId, 'Client');
    const projects = getProjects(context).filter((project) => project.preferredClientId === client.id);
    const expenses = getExpenses(context).filter((expense) => expense.clientId === client.id);
    const invoices = getInvoices(context).filter((invoice) => invoice.clientId === client.id);

    return {
        client: {
            id: client.id,
            title: client.title,
            clientName: client.clientName,
            email: client.email,
            defaultCurrency: client.defaultCurrency,
        },
        projectCount: projects.length,
        activeProjectCount: projects.filter((project) => !project.archived).length,
        billableExpenseCount: expenses.filter((expense) => expense.billable).length,
        unbilledExpenseCount: expenses.filter((expense) => expense.billable && expense.billingStatus !== 'billed').length,
        draftInvoiceCount: invoices.filter((invoice) => invoice.status === 'draft').length,
        openInvoiceTotal: invoices.filter((invoice) => isInvoiceOutstanding(invoice)).reduce((total, invoice) => total + (invoice.total || 0), 0),
    };
}

export async function findUnbilledTimeCommand(
    context: AgentCommandContext,
    input: EntryListInput = {}
): Promise<AgentEntrySummary[]> {
    assertReady(context);
    assertPermission(context, 'read');

    const billingData = await getCompleteBillingData(context);
    const taskById = new Map(billingData.tasks.map((task) => [task.id, task]));
    const legacyBilledEntryIds = collectLegacyBilledTimeEntryIds({
        tasks: billingData.tasks,
        timeEntries: billingData.entries,
        invoices: billingData.invoices,
    });

    return filterEntries(input, getInvoiceEligibleTimeEntries({
        tasks: billingData.tasks,
        timeEntries: billingData.entries,
        invoices: billingData.invoices,
    }), taskById)
        .sort((a, b) => b.end - a.end)
        .slice(0, getLimit(input.limit))
        .map((entry) => summarizeEntry(entry, taskById, legacyBilledEntryIds));
}

export async function listRecentEntriesCommand(
    context: AgentCommandContext,
    input: EntryListInput = {}
): Promise<AgentEntrySummary[]> {
    assertReady(context);
    assertPermission(context, 'read');

    const billingData = await getCompleteBillingData(context);
    const taskById = new Map(billingData.tasks.map((task) => [task.id, task]));
    const legacyBilledEntryIds = collectLegacyBilledTimeEntryIds({
        tasks: billingData.tasks,
        timeEntries: billingData.entries,
        invoices: billingData.invoices,
    });

    return filterEntries(input, billingData.entries, taskById)
        .sort((a, b) => b.end - a.end)
        .slice(0, getLimit(input.limit))
        .map((entry) => summarizeEntry(entry, taskById, legacyBilledEntryIds));
}
