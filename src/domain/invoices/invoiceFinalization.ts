import type { Client, Expense, Invoice, InvoiceBillingSelectionSnapshot, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { isStoredDateWithinBillingRange } from '@/utils/billingPeriodUtils';
import { getClientHourlyRate } from '@/utils/projectPlanningUtils';
import { getBillableDurationMs } from '@/utils/timeEntryDurationUtils';

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
    selectedTaskIds: Set<string>;
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
    const billingSelection = getBillingSelectionSnapshot(invoice.billingSelectionSnapshot);
    if (billingSelection) {
        assertInvoiceMatchesBillingSelection(invoice, billingSelection);
    }
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const invoiceTasks = collectInvoiceTasks(invoiceRecord);
    const invoiceTaskIds = collectInvoiceTaskIds(invoiceTasks);
    const selectedTaskIds = billingSelection
        ? new Set([
            ...billingSelection.tasks.map((task) => task.taskId),
            ...billingSelection.entries.map((entry) => entry.taskId),
        ])
        : (invoiceTaskIds.size > 0
            ? invoiceTaskIds
            : collectFallbackAgentDraftTaskIds({ agentDraft, invoice, projects, tasks }));
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
    const selectedEntryById = billingSelection
        ? new Map(billingSelection.entries.map((selection) => [selection.entryId, selection]))
        : null;

    selectedTaskIds.forEach((taskId) => {
        const task = taskById.get(taskId);
        const previousCutoff = task?.lastBilledAt || 0;

        taskLastBilledAt[taskId] = task?.lastBilledAt ?? null;
        previousBillingCutoffs.set(taskId, previousCutoff);
        nextTaskCutoffs.set(taskId, previousCutoff);
    });

    const entriesToBill: InvoiceFinalizationEntryMutation[] = [];

    entries.forEach((entry) => {
        const selectedEntry = selectedEntryById?.get(entry.id);
        if (selectedEntryById && !selectedEntry) return;
        if (!selectedTaskIds.has(entry.taskId)) return;
        if (entry.source === 'invoice-adjustment') return;
        if (entry.billedInvoiceId || entry.billedAt) return;
        if (!entry.end || entry.end <= entry.start) return;

        if (selectedEntry) {
            assertSelectedEntryUnchanged(entry, selectedEntry);
        } else if (entry.start > finalizedAt) {
            return;
        }

        const cutoff = previousBillingCutoffs.get(entry.taskId) || 0;
        if (!selectedEntry && entry.start <= cutoff) return;
        if (!selectedEntry && !isStoredDateWithinBillingRange(entry.start, invoice.billingPeriodStart || undefined, invoice.billingPeriodEnd || undefined)) return;

        entriesToBill.push({
            entry,
            billedHourlyRate: selectedEntry?.billedHourlyRate ?? billedRateByTaskId.get(entry.taskId) ?? null,
        });
        nextTaskCutoffs.set(entry.taskId, Math.max(nextTaskCutoffs.get(entry.taskId) || 0, entry.end));
    });

    if (selectedEntryById) {
        const foundEntryIds = new Set(entriesToBill.map(({ entry }) => entry.id));
        const missingEntry = billingSelection!.entries.find((selection) => !foundEntryIds.has(selection.entryId));

        if (missingEntry) {
            throw new Error(`Selected time entry "${missingEntry.entryId}" is missing, changed, or already billed. Refresh the draft before finalizing.`);
        }
    }

    const updatedTaskIds = new Set<string>();
    selectedTaskIds.forEach((taskId) => {
        const nextCutoff = nextTaskCutoffs.get(taskId) || 0;
        const previousCutoff = previousBillingCutoffs.get(taskId) || 0;

        if (nextCutoff > previousCutoff) {
            updatedTaskIds.add(taskId);
        }
    });

    const selectedExpenseIds = billingSelection
        ? new Set(billingSelection.expenses.map((expense) => expense.expenseId))
        : collectInvoiceExpenseIds(invoiceRecord);
    const projectIdsToLink = collectInvoiceProjectIds(invoiceRecord, agentDraft);
    const expensesToBill = expenses.filter((expense) => {
        if (!expense || expense.billingStatus === 'billed') return false;
        if (selectedExpenseIds.has(expense.id)) {
            const selection = billingSelection?.expenses.find((candidate) => candidate.expenseId === expense.id);
            if (selection) {
                assertSelectedExpenseUnchanged(expense, selection);
            }
            return true;
        }

        return selectedExpenseIds.size === 0
            && Boolean(agentDraft)
            && isExpenseSelectedForAgentDraft(expense, projectIdsToLink, agentDraft);
    });

    if (billingSelection) {
        const foundExpenseIds = new Set(expensesToBill.map((expense) => expense.id));
        const missingExpense = billingSelection.expenses.find((selection) => !foundExpenseIds.has(selection.expenseId));

        if (missingExpense) {
            throw new Error(`Selected expense "${missingExpense.expenseId}" is missing, changed, or already billed. Refresh the draft before finalizing.`);
        }
    }

    return {
        selectedTaskIds,
        entriesToBill,
        ...planInvoiceAdjustments({ invoice, invoiceTasks, entries, finalizedAt, createAdjustmentId }),
        expensesToBill,
        taskLastBilledAt,
        nextTaskCutoffs,
        updatedTaskIds,
        quotedTaskClaims: billingSelection
            ? collectSnapshotQuotedTaskClaims(billingSelection, taskById)
            : collectQuotedTaskClaims(invoiceTasks, taskById),
        projectIdsToLink,
        agentDraft,
    };
}

function getBillingSelectionSnapshot(value: unknown): InvoiceBillingSelectionSnapshot | null {
    if (!isRecord(value) || value.version !== 1) {
        return null;
    }

    if (!Array.isArray(value.entries) || !Array.isArray(value.tasks) || !Array.isArray(value.expenses)) {
        return null;
    }

    return value as unknown as InvoiceBillingSelectionSnapshot;
}

function assertInvoiceMatchesBillingSelection(invoice: Invoice, snapshot: InvoiceBillingSelectionSnapshot) {
    const itemRecords = Array.isArray(invoice.items) ? invoice.items : [];

    snapshot.tasks.forEach((selection) => {
        const item = itemRecords.find((candidate) => candidate.taskId === selection.taskId);
        if (
            !item
            || Math.abs(item.quantity - selection.quantity) >= 0.000001
            || Math.abs(item.rate - selection.rate) >= 0.005
            || Math.abs(item.amount - selection.amount) >= 0.005
        ) {
            throw new Error(`Invoice line for selected task "${selection.taskId}" changed after preview. Refresh the draft before finalizing.`);
        }
    });

    snapshot.expenses.forEach((selection) => {
        const item = itemRecords.find((candidate) => candidate.expenseId === selection.expenseId);
        if (!item || Math.abs(item.amount - selection.invoiceAmount) >= 0.005) {
            throw new Error(`Invoice line for selected expense "${selection.expenseId}" changed after preview. Refresh the draft before finalizing.`);
        }
    });
}

function assertSelectedEntryUnchanged(
    entry: TimeEntry,
    selection: InvoiceBillingSelectionSnapshot['entries'][number]
) {
    if (
        entry.taskId !== selection.taskId
        || entry.start !== selection.start
        || entry.end !== selection.end
        || getBillableDurationMs(entry) !== selection.billableDurationMs
    ) {
        throw new Error(`Selected time entry "${selection.entryId}" changed after preview. Refresh the draft before finalizing.`);
    }
}

function assertSelectedExpenseUnchanged(
    expense: Expense,
    selection: InvoiceBillingSelectionSnapshot['expenses'][number]
) {
    const sourceCurrency = typeof expense.currency === 'string' ? expense.currency.trim().toUpperCase() : '';

    if (Math.abs(expense.amount - selection.sourceAmount) >= 0.005 || sourceCurrency !== selection.sourceCurrency) {
        throw new Error(`Selected expense "${selection.expenseId}" changed after preview. Refresh the draft before finalizing.`);
    }
}

function collectSnapshotQuotedTaskClaims(
    snapshot: InvoiceBillingSelectionSnapshot,
    taskById: Map<string, Task>
): InvoiceQuotedTaskClaim[] {
    return snapshot.tasks.flatMap((selection) => {
        if (selection.pricingMode !== 'flat' || !selection.quotedAmount) {
            return [];
        }

        const task = taskById.get(selection.taskId);
        if (!task || task.quotedAmountBilling?.invoiceId) {
            throw new Error(`Selected quoted task "${selection.taskId}" is missing or already billed. Refresh the draft before finalizing.`);
        }

        if (typeof task.estimatedFlatAmount !== 'number' || Math.abs(task.estimatedFlatAmount - selection.quotedAmount) >= 0.005) {
            throw new Error(`Selected quoted amount for task "${selection.taskId}" changed after preview. Refresh the draft before finalizing.`);
        }

        return [{ taskId: selection.taskId, total: selection.quotedAmount }];
    });
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

        if (deltaMs < -1) {
            throw new Error(
                `Invoice hours for task "${taskId}" are lower than the selected recorded time. `
                + 'Split or edit the source time entries before finalizing so unbilled time is not consumed.'
            );
        }

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
