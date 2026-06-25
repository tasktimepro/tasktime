import type { Client, Expense, Invoice, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { isStoredDateWithinBillingRange } from '@/utils/billingPeriodUtils';
import { getClientHourlyRate } from '@/utils/projectPlanningUtils';

export interface InvoiceFinalizationEntryMutation {
    entry: TimeEntry;
    billedHourlyRate: number | null;
}

export interface InvoiceAdjustmentCreate {
    id: string;
    entry: Omit<TimeEntry, 'id'>;
}

export interface InvoiceAdjustmentUpdate {
    id: string;
    updates: Partial<TimeEntry>;
}

export interface InvoiceQuotedTaskClaim {
    taskId: string;
    total: number;
}

export interface InvoiceFinalizationPlan {
    entriesToBill: InvoiceFinalizationEntryMutation[];
    adjustmentEntriesToCreate: InvoiceAdjustmentCreate[];
    adjustmentEntriesToUpdate: InvoiceAdjustmentUpdate[];
    adjustmentEntryIdsToDelete: string[];
    expensesToBill: Expense[];
    taskLastBilledAt: Record<string, number | null>;
    nextTaskCutoffs: Map<string, number>;
    updatedTaskIds: Set<string>;
    quotedTaskClaims: InvoiceQuotedTaskClaim[];
    projectIdsToLink: string[];
    agentDraft?: Record<string, unknown>;
}

export function planInvoiceFinalization({
    invoice,
    projects,
    clients,
    tasks,
    entries,
    expenses,
    finalizedAt,
    createAdjustmentId,
}: {
    invoice: Invoice;
    projects: Project[];
    clients: Client[];
    tasks: Task[];
    entries: TimeEntry[];
    expenses: Expense[];
    finalizedAt: number;
    createAdjustmentId: () => string;
}): InvoiceFinalizationPlan {
    const invoiceRecord = invoice as Invoice & {
        agentDraft?: Record<string, unknown>;
        tasks?: Array<Record<string, unknown>>;
        projectBreakdowns?: Array<Record<string, unknown>>;
        expenseItems?: Array<Record<string, unknown>>;
    };
    const agentDraft = normalizeAgentDraft(invoiceRecord.agentDraft);
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const invoiceTasks = collectInvoiceTasks(invoiceRecord);
    const invoiceTaskIds = collectInvoiceTaskIds(invoiceTasks);
    const selectedTaskIds = invoiceTaskIds.size > 0
        ? invoiceTaskIds
        : collectFallbackAgentDraftTaskIds({ agentDraft, invoice, projects, tasks });
    const taskLastBilledAt: Record<string, number | null> = {};
    const previousBillingCutoffs = new Map<string, number>();
    const nextTaskCutoffs = new Map<string, number>();
    const billedRateByTaskId = buildBilledRateByTaskId({
        invoiceTasks,
        selectedTaskIds,
        taskById,
        projectById,
        clientById,
        invoice,
    });

    selectedTaskIds.forEach((taskId) => {
        const task = taskById.get(taskId);
        const previousCutoff = task?.lastBilledAt || 0;

        taskLastBilledAt[taskId] = task?.lastBilledAt ?? null;
        previousBillingCutoffs.set(taskId, previousCutoff);
        nextTaskCutoffs.set(taskId, previousCutoff);
    });

    const entriesToBill: InvoiceFinalizationEntryMutation[] = [];

    entries.forEach((entry) => {
        if (!selectedTaskIds.has(entry.taskId)) return;
        if (entry.source === 'invoice-adjustment') return;
        if (entry.billedInvoiceId || entry.billedAt) return;
        if (!entry.end || entry.end <= entry.start) return;
        if (entry.start > finalizedAt) return;

        const cutoff = previousBillingCutoffs.get(entry.taskId) || 0;
        if (entry.start <= cutoff) return;
        if (!isStoredDateWithinBillingRange(entry.start, invoice.billingPeriodStart || undefined, invoice.billingPeriodEnd || undefined)) return;

        entriesToBill.push({
            entry,
            billedHourlyRate: billedRateByTaskId.get(entry.taskId) ?? null,
        });
        nextTaskCutoffs.set(entry.taskId, Math.max(nextTaskCutoffs.get(entry.taskId) || 0, entry.end));
    });

    const updatedTaskIds = new Set<string>();
    selectedTaskIds.forEach((taskId) => {
        const nextCutoff = nextTaskCutoffs.get(taskId) || 0;
        const previousCutoff = previousBillingCutoffs.get(taskId) || 0;

        if (nextCutoff > previousCutoff) {
            updatedTaskIds.add(taskId);
        }
    });

    const selectedExpenseIds = collectInvoiceExpenseIds(invoiceRecord);
    const projectIdsToLink = collectInvoiceProjectIds(invoiceRecord, agentDraft);
    const expensesToBill = expenses.filter((expense) => {
        if (!expense || expense.billingStatus === 'billed') return false;
        if (selectedExpenseIds.has(expense.id)) return true;

        return selectedExpenseIds.size === 0
            && Boolean(agentDraft)
            && isExpenseSelectedForAgentDraft(expense, projectIdsToLink, agentDraft);
    });

    return {
        entriesToBill,
        ...planInvoiceAdjustments({ invoice, invoiceTasks, entries, finalizedAt, createAdjustmentId }),
        expensesToBill,
        taskLastBilledAt,
        nextTaskCutoffs,
        updatedTaskIds,
        quotedTaskClaims: collectQuotedTaskClaims(invoiceTasks, taskById),
        projectIdsToLink,
        agentDraft,
    };
}

function collectInvoiceTasks(invoice: { tasks?: Array<Record<string, unknown>>; projectBreakdowns?: Array<Record<string, unknown>> }) {
    const tasks: Array<Record<string, unknown>> = [];

    if (Array.isArray(invoice.tasks)) {
        tasks.push(...invoice.tasks.filter(isRecord));
    }

    if (Array.isArray(invoice.projectBreakdowns)) {
        invoice.projectBreakdowns.forEach((breakdown) => {
            if (Array.isArray(breakdown?.tasks)) {
                tasks.push(...breakdown.tasks.filter(isRecord));
            }
        });
    }

    const seen = new Set<string>();

    return tasks.filter((task) => {
        const id = getString(task.id);

        if (!id || seen.has(id)) {
            return false;
        }

        seen.add(id);
        return true;
    });
}

function collectInvoiceTaskIds(invoiceTasks: Array<Record<string, unknown>>) {
    const ids = new Set<string>();

    invoiceTasks.forEach((task) => {
        const taskId = getString(task.id);

        if (taskId) {
            ids.add(taskId);
        }

        if (Array.isArray(task.mergedSubtasks)) {
            task.mergedSubtasks.filter(isRecord).forEach((subtask) => {
                const subtaskId = getString(subtask.id);
                if (subtaskId) ids.add(subtaskId);
            });
        }
    });

    return ids;
}

function collectFallbackAgentDraftTaskIds({
    agentDraft,
    invoice,
    tasks,
}: {
    agentDraft?: Record<string, unknown>;
    invoice: Invoice;
    tasks: Task[];
}) {
    if (!agentDraft) {
        return new Set<string>();
    }

    const projectIds = collectInvoiceProjectIds(invoice, agentDraft);

    return new Set(tasks
        .filter((task) => projectIds.includes(task.projectId || ''))
        .filter((task) => task.billable === true && task.archived !== true)
        .map((task) => task.id));
}

function buildBilledRateByTaskId({
    invoiceTasks,
    selectedTaskIds,
    taskById,
    projectById,
    clientById,
    invoice,
}: {
    invoiceTasks: Array<Record<string, unknown>>;
    selectedTaskIds: Set<string>;
    taskById: Map<string, Task>;
    projectById: Map<string, Project>;
    clientById: Map<string, Client>;
    invoice: Invoice;
}) {
    const rates = new Map<string, number | null>();

    invoiceTasks.forEach((task) => {
        const taskId = getString(task.id);
        const rate = getInvoiceTaskHourlyRate(task);

        if (taskId) {
            rates.set(taskId, rate);
        }

        if (Array.isArray(task.mergedSubtasks)) {
            task.mergedSubtasks.filter(isRecord).forEach((subtask) => {
                const subtaskId = getString(subtask.id);
                const subtaskRate = getInvoiceTaskHourlyRate(subtask) ?? rate;
                if (subtaskId) rates.set(subtaskId, subtaskRate);
            });
        }
    });

    selectedTaskIds.forEach((taskId) => {
        if (rates.has(taskId)) {
            return;
        }

        const task = taskById.get(taskId);
        const project = task?.projectId ? projectById.get(task.projectId) : null;
        const client = project?.preferredClientId ? clientById.get(project.preferredClientId) : clientById.get(invoice.clientId);

        rates.set(taskId, project?.flatRate ? null : (project?.hourlyRate ?? (client ? getClientHourlyRate(client) : null)));
    });

    return rates;
}

function planInvoiceAdjustments({
    invoice,
    invoiceTasks,
    entries,
    finalizedAt,
    createAdjustmentId,
}: {
    invoice: Invoice;
    invoiceTasks: Array<Record<string, unknown>>;
    entries: TimeEntry[];
    finalizedAt: number;
    createAdjustmentId: () => string;
}): Pick<InvoiceFinalizationPlan, 'adjustmentEntriesToCreate' | 'adjustmentEntriesToUpdate' | 'adjustmentEntryIdsToDelete'> {
    const existingAdjustments = entries.filter((entry) => (
        entry.source === 'invoice-adjustment' && entry.billedInvoiceId === invoice.id
    ));
    const existingByTaskId = new Map(existingAdjustments.map((entry) => [entry.taskId, entry]));
    const taskIdsToAdjust = new Set<string>();
    const adjustmentEntriesToCreate: InvoiceAdjustmentCreate[] = [];
    const adjustmentEntriesToUpdate: InvoiceAdjustmentUpdate[] = [];
    const adjustmentEntryIdsToDelete: string[] = [];

    invoiceTasks.forEach((task) => {
        const taskId = getString(task.id);

        if (!taskId) return;
        taskIdsToAdjust.add(taskId);
        if (task.useFlatRate === true) return;

        const originalMs = getFiniteNumber(task.originalTimeMs)
            ?? ((getFiniteNumber(task.originalHours) ?? 0) * 3_600_000);
        const desiredMs = (getFiniteNumber(task.hours) ?? 0) * 3_600_000;
        const deltaMs = desiredMs - originalMs;
        const existingEntry = existingByTaskId.get(taskId);

        if (deltaMs <= 0) {
            if (existingEntry) {
                adjustmentEntryIdsToDelete.push(existingEntry.id);
            }
            return;
        }

        const start = existingEntry?.start || (finalizedAt - deltaMs);
        const end = start + deltaMs;
        const billedHourlyRate = getInvoiceTaskHourlyRate(task);
        const updates = {
            taskId,
            start,
            end,
            note: 'Invoice adjustment',
            source: 'invoice-adjustment',
            billedAt: finalizedAt,
            billedInvoiceId: invoice.id,
            billedHourlyRate,
            updatedAt: finalizedAt,
        };

        if (existingEntry) {
            adjustmentEntriesToUpdate.push({ id: existingEntry.id, updates });
            return;
        }

        adjustmentEntriesToCreate.push({
            id: createAdjustmentId(),
            entry: {
                ...updates,
                createdAt: finalizedAt,
            },
        });
    });

    existingAdjustments.forEach((entry) => {
        if (!taskIdsToAdjust.has(entry.taskId)) {
            adjustmentEntryIdsToDelete.push(entry.id);
        }
    });

    return {
        adjustmentEntriesToCreate,
        adjustmentEntriesToUpdate,
        adjustmentEntryIdsToDelete,
    };
}

function collectInvoiceExpenseIds(invoice: {
    items?: Array<Record<string, unknown>>;
    expenseItems?: Array<Record<string, unknown>>;
    projectBreakdowns?: Array<Record<string, unknown>>;
}) {
    const ids = new Set<string>();
    const collect = (items: unknown) => {
        if (!Array.isArray(items)) return;

        items.filter(isRecord).forEach((item) => {
            const id = getString(item.id) || getString(item.expenseId);
            if (id) ids.add(id);
        });
    };

    collect(invoice.items);
    collect(invoice.expenseItems);
    invoice.projectBreakdowns?.forEach((breakdown) => collect(breakdown.expenseItems));

    return ids;
}

function collectQuotedTaskClaims(invoiceTasks: Array<Record<string, unknown>>, taskById: Map<string, Task>) {
    const claims: InvoiceQuotedTaskClaim[] = [];

    invoiceTasks.forEach((invoiceTask) => {
        const taskId = getString(invoiceTask.id);
        const task = taskId ? taskById.get(taskId) : null;

        if (!taskId || !task) return;
        if (invoiceTask.useFlatRate !== true && invoiceTask.projectFlatRate !== true) return;
        if (task.quotedAmountBilling?.invoiceId) return;

        const quotedAmount = getPositiveFiniteNumber(task.estimatedFlatAmount);

        if (quotedAmount !== null) {
            claims.push({ taskId, total: quotedAmount });
        }
    });

    return claims;
}

function collectInvoiceProjectIds(invoice: Invoice, agentDraft?: Record<string, unknown>) {
    const ids: string[] = [];
    const push = (value: unknown) => {
        const id = getString(value);

        if (id && !ids.includes(id)) {
            ids.push(id);
        }
    };

    if (Array.isArray(invoice.projectIds)) {
        invoice.projectIds.forEach(push);
    }

    if (Array.isArray((invoice as any).projectBreakdowns)) {
        (invoice as any).projectBreakdowns.forEach((breakdown: any) => push(breakdown?.projectId));
    }

    push(invoice.projectId);
    push(agentDraft?.projectId);

    return ids;
}

function isExpenseSelectedForAgentDraft(expense: Expense, projectIds: string[], agentDraft: Record<string, unknown>): boolean {
    if (!expense || expense.billable !== true || expense.billingStatus !== 'unbilled') {
        return false;
    }

    if (!isStoredDateWithinBillingRange(expense.date, getString(agentDraft.billingPeriodStart) || undefined, getString(agentDraft.billingPeriodEnd) || undefined)) {
        return false;
    }

    if (expense.projectId) {
        return projectIds.includes(expense.projectId);
    }

    return Boolean(agentDraft.includeClientLevelExpenses && getString(agentDraft.clientId) && expense.clientId === agentDraft.clientId);
}

function normalizeAgentDraft(value: unknown): Record<string, unknown> | undefined {
    if (!isRecord(value) || value.source !== 'tasktime-agent') {
        return undefined;
    }

    return value;
}

function getInvoiceTaskHourlyRate(task: Record<string, unknown>): number | null {
    return getFiniteNumber(task.hourlyRate) ?? getFiniteNumber(task.projectHourlyRate) ?? null;
}

function getString(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getPositiveFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
