import { collectValidatedEntities } from '@/stores/yjs/validation';
import type { Client, Expense, Invoice, MultiTimerState, Project, Task, TimeEntry } from '@/stores/yjs/types';
import type { AgentCommandContext } from '@/agent/types';
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

function getTasks(context: AgentCommandContext): Task[] {
    return collectValidatedEntities<Task>('tasks', context.store.tasks as any, 'agent query tasks');
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

function getEntries(context: AgentCommandContext): TimeEntry[] {
    return context.store.getAllTimeEntries()
        .filter((entry): entry is TimeEntry => !!entry && typeof entry.id === 'string' && typeof entry.taskId === 'string');
}

function getTaskProjectId(task: Task | undefined): string | null {
    if (!task) {
        return null;
    }

    return task.projectId || task.id;
}

function isEntryBilled(entry: TimeEntry): boolean {
    return Boolean(entry.billedAt || entry.billedInvoiceId);
}

function summarizeEntry(entry: TimeEntry, taskById: Map<string, Task>): AgentEntrySummary {
    const projectId = getTaskProjectId(taskById.get(entry.taskId));

    return {
        id: entry.id,
        taskId: entry.taskId,
        projectId,
        start: entry.start,
        end: entry.end,
        durationMs: Math.max(0, entry.end - entry.start),
        billed: isEntryBilled(entry),
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

export function getDashboardSummaryCommand(context: AgentCommandContext): DashboardSummary {
    assertReady(context);
    assertPermission(context, 'read');

    const projects = getProjects(context).filter((project) => !project.archived);
    const tasks = getTasks(context).filter((task) => !task.archived);
    const entries = getEntries(context);
    const expenses = getExpenses(context);
    const invoices = getInvoices(context);
    const unbilledEntries = entries.filter((entry) => !isEntryBilled(entry));

    return {
        projectCount: projects.length,
        taskCount: tasks.length,
        openTaskCount: tasks.filter((task) => !task.completed).length,
        completedTaskCount: tasks.filter((task) => task.completed).length,
        activeTimerCount: getTimers(context).length,
        unbilledEntryCount: unbilledEntries.length,
        unbilledDurationMs: unbilledEntries.reduce((total, entry) => total + Math.max(0, entry.end - entry.start), 0),
        billableExpenseCount: expenses.filter((expense) => expense.billable).length,
        unbilledExpenseCount: expenses.filter((expense) => expense.billable && expense.billingStatus !== 'billed').length,
        draftInvoiceCount: invoices.filter((invoice) => invoice.status === 'draft').length,
    };
}

export function getProjectOverviewCommand(context: AgentCommandContext, input: { projectId: string }): ProjectOverview {
    assertReady(context);
    assertPermission(context, 'read');

    const project = readRequiredEntity<Project>(context.store.projects as any, input.projectId, 'Project');
    const tasks = getTasks(context).filter((task) => getTaskProjectId(task) === project.id && !task.archived);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const entries = filterEntries({ projectId: project.id }, getEntries(context), taskById);
    const unbilledEntries = entries.filter((entry) => !isEntryBilled(entry));
    const expenses = getExpenses(context).filter((expense) => expense.projectId === project.id);
    const invoices = getInvoices(context).filter((invoice) => invoice.projectId === project.id || invoice.projectIds?.includes(project.id));

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
        unbilledDurationMs: unbilledEntries.reduce((total, entry) => total + Math.max(0, entry.end - entry.start), 0),
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
        openInvoiceTotal: invoices.filter((invoice) => invoice.status !== 'paid').reduce((total, invoice) => total + (invoice.total || 0), 0),
    };
}

export function findUnbilledTimeCommand(context: AgentCommandContext, input: EntryListInput = {}): AgentEntrySummary[] {
    assertReady(context);
    assertPermission(context, 'read');

    const taskById = new Map(getTasks(context).map((task) => [task.id, task]));

    return filterEntries(input, getEntries(context), taskById)
        .filter((entry) => !isEntryBilled(entry))
        .sort((a, b) => b.end - a.end)
        .slice(0, getLimit(input.limit))
        .map((entry) => summarizeEntry(entry, taskById));
}

export function listRecentEntriesCommand(context: AgentCommandContext, input: EntryListInput = {}): AgentEntrySummary[] {
    assertReady(context);
    assertPermission(context, 'read');

    const taskById = new Map(getTasks(context).map((task) => [task.id, task]));

    return filterEntries(input, getEntries(context), taskById)
        .sort((a, b) => b.end - a.end)
        .slice(0, getLimit(input.limit))
        .map((entry) => summarizeEntry(entry, taskById));
}
