import type { Client, Expense, Invoice, InvoiceBillingSelectionSnapshot, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { isStoredDateWithinBillingRange } from '@/utils/billingPeriodUtils';
import { formatDuration } from '@/utils/dateUtils';
import { getClientHourlyRate } from '@/utils/projectPlanningUtils';
import { getBillableDurationMs } from '@/utils/timeEntryDurationUtils';
import {
    getCanonicalInvoiceHours,
    getInvoiceWholeMinutesFromDuration,
    getInvoiceWholeMinutesFromHours,
} from './invoiceTimePrecision';

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
        tasks?: unknown;
        expenseItems?: unknown;
    };
    const agentDraft = normalizeAgentDraft(invoiceRecord.agentDraft);
    const billingSelection = getBillingSelectionSnapshot(invoice.billingSelectionSnapshot);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    if (billingSelection) {
        assertInvoiceMatchesBillingSelection(invoice, billingSelection, taskById);
    }
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const invoiceTasks = collectInvoiceTasks(invoiceRecord);
    const invoiceTaskIds = collectInvoiceTaskIds(invoiceTasks);
    const selectedTaskIds = billingSelection
        ? new Set([
            ...billingSelection.tasks.map((task) => task.taskId),
            ...billingSelection.entries.map((entry) => entry.taskId),
        ])
        : (invoiceTaskIds.size > 0
            ? invoiceTaskIds
            : collectFallbackAgentDraftTaskIds({ agentDraft, invoice, tasks }));
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
            assertSelectedEntryUnchanged(
                entry,
                selectedEntry,
                getSelectedTaskTitle(selectedEntry.taskId, taskById, billingSelection!)
            );
        } else if (entry.start > finalizedAt) {
            return;
        }

        const cutoff = previousBillingCutoffs.get(entry.taskId) || 0;
        if (!selectedEntry && entry.start <= cutoff) return;
        // Snapshot-less drafts retain the historical instant-to-midnight
        // boundary that determined their displayed and stored source totals.
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
            const taskTitle = getSelectedTaskTitle(missingEntry.taskId, taskById, billingSelection!);
            throw new Error(`${describeTaskTime(taskTitle)} is missing, changed, or already billed. Refresh the invoice before finalizing.`);
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
            throw new Error(`${describeNamedEntity('Selected expense', missingExpense.title, missingExpense.expenseId)} is missing, changed, or already billed. Refresh the invoice before finalizing.`);
        }
    }

    return {
        selectedTaskIds,
        entriesToBill,
        ...planInvoiceAdjustments({ invoice, invoiceTasks, taskById, entries, finalizedAt, createAdjustmentId }),
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

function assertInvoiceMatchesBillingSelection(
    invoice: Invoice,
    snapshot: InvoiceBillingSelectionSnapshot,
    taskById: Map<string, Task>
) {
    const itemRecords = Array.isArray(invoice.items) ? invoice.items : [];

    snapshot.tasks.forEach((selection) => {
        const item = itemRecords.find((candidate) => candidate.taskId === selection.taskId);
        if (
            !item
            || Math.abs(item.quantity - selection.quantity) >= 0.000001
            || Math.abs(item.rate - selection.rate) >= 0.005
            || Math.abs(item.amount - selection.amount) >= 0.005
        ) {
            const taskTitle = getDisplayTitle(selection.title, selection.taskId)
                || getDisplayTitle(taskById.get(selection.taskId)?.title, selection.taskId);

            throw new Error(`${describeNamedEntity('Invoice line for task', taskTitle)} changed after preview. Refresh the invoice before finalizing.`);
        }
    });

    snapshot.expenses.forEach((selection) => {
        const item = itemRecords.find((candidate) => candidate.expenseId === selection.expenseId);
        if (!item || Math.abs(item.amount - selection.invoiceAmount) >= 0.005) {
            throw new Error(`${describeNamedEntity('Invoice line for expense', selection.title, selection.expenseId)} changed after preview. Refresh the invoice before finalizing.`);
        }
    });
}

function assertSelectedEntryUnchanged(
    entry: TimeEntry,
    selection: InvoiceBillingSelectionSnapshot['entries'][number],
    taskTitle = ''
) {
    if (
        entry.taskId !== selection.taskId
        || entry.start !== selection.start
        || entry.end !== selection.end
        || getBillableDurationMs(entry) !== selection.billableDurationMs
    ) {
        throw new Error(`${describeTaskTime(taskTitle)} changed after preview. Refresh the invoice before finalizing.`);
    }
}

function assertSelectedExpenseUnchanged(
    expense: Expense,
    selection: InvoiceBillingSelectionSnapshot['expenses'][number]
) {
    const sourceCurrency = typeof expense.currency === 'string' ? expense.currency.trim().toUpperCase() : '';

    if (Math.abs(expense.amount - selection.sourceAmount) >= 0.005 || sourceCurrency !== selection.sourceCurrency) {
        const expenseTitle = getDisplayTitle(selection.title, selection.expenseId)
            || getDisplayTitle(expense.title, expense.id);

        throw new Error(`${describeNamedEntity('Selected expense', expenseTitle)} changed after preview. Refresh the invoice before finalizing.`);
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
            throw new Error(`${describeNamedEntity('Selected quoted task', selection.title, selection.taskId)} is missing or already billed. Refresh the invoice before finalizing.`);
        }

        if (typeof task.estimatedFlatAmount !== 'number' || Math.abs(task.estimatedFlatAmount - selection.quotedAmount) >= 0.005) {
            const taskTitle = getDisplayTitle(selection.title, selection.taskId)
                || getDisplayTitle(task.title, task.id);

            throw new Error(`${describeNamedEntity('Selected quoted amount for task', taskTitle)} changed after preview. Refresh the invoice before finalizing.`);
        }

        return [{ taskId: selection.taskId, total: selection.quotedAmount }];
    });
}

function collectInvoiceTasks(invoice: { tasks?: unknown; projectBreakdowns?: unknown }) {
    const tasks: Array<Record<string, unknown>> = [];

    if (Array.isArray(invoice.tasks)) {
        tasks.push(...invoice.tasks.filter(isRecord));
    }

    if (Array.isArray(invoice.projectBreakdowns)) {
        invoice.projectBreakdowns.filter(isRecord).forEach((breakdown) => {
            if (Array.isArray(breakdown.tasks)) {
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
    taskById,
    entries,
    finalizedAt,
    createAdjustmentId,
}: {
    invoice: Invoice;
    invoiceTasks: Array<Record<string, unknown>>;
    taskById: Map<string, Task>;
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
    const plannedTaskAdjustments: Array<{
        task: Record<string, unknown>;
        taskId: string;
        originalMs: number;
        desiredMs: number;
        deltaMs: number;
        existingEntry?: TimeEntry;
    }> = [];

    invoiceTasks.forEach((task) => {
        const taskId = getString(task.id);

        if (!taskId) return;
        taskIdsToAdjust.add(taskId);
        if (task.useFlatRate === true) return;

        const sourceDurationMs = getFiniteNumber(task.originalTimeMs)
            ?? ((getFiniteNumber(task.originalHours) ?? 0) * 3_600_000);
        const desiredHours = getFiniteNumber(task.hours) ?? 0;
        const canonicalDisplayHours = getCanonicalInvoiceHours(sourceDurationMs);
        const originalInvoiceMs = getInvoiceWholeMinutesFromDuration(sourceDurationMs) * 60_000;
        const desiredInvoiceMs = getInvoiceWholeMinutesFromHours(desiredHours) * 60_000;
        // The composer ignores source seconds and displays the remaining whole
        // minutes as two-decimal hours. Treat that canonical value as the exact
        // selected source duration so untouched time neither blocks nor creates
        // a fake adjustment.
        const deltaMs = Math.abs(desiredHours - canonicalDisplayHours) < 0.000000001
            ? 0
            : desiredInvoiceMs - originalInvoiceMs;
        const existingEntry = existingByTaskId.get(taskId);

        plannedTaskAdjustments.push({
            task,
            taskId,
            originalMs: originalInvoiceMs,
            desiredMs: desiredInvoiceMs,
            deltaMs,
            existingEntry,
        });
    });

    const reducedTasks = plannedTaskAdjustments.filter(({ deltaMs }) => deltaMs < -1);

    if (reducedTasks.length === 1) {
        const [{ task, originalMs, desiredMs }] = reducedTasks;
        const taskId = getString(task.id);
        const taskTitle = getDisplayTitle(task.title, taskId)
            || getDisplayTitle(taskById.get(taskId)?.title, taskId);

        throw new Error(
            `${describeNamedEntity('Invoice hours for', taskTitle)} are ${formatDuration(Math.max(0, Math.round(desiredMs)))}, `
            + `below the selected recorded time of ${formatDuration(Math.max(0, Math.round(originalMs)))}. `
            + 'To invoice only part of this time, split or edit the source time entries, then try again.'
        );
    }

    if (reducedTasks.length > 1) {
        const taskSummaries = reducedTasks.map(({ task, originalMs, desiredMs }) => {
            const taskId = getString(task.id);
            const taskTitle = getDisplayTitle(task.title, taskId)
                || getDisplayTitle(taskById.get(taskId)?.title, taskId)
                || 'Task';

            return `"${taskTitle}" (${formatDuration(Math.max(0, Math.round(desiredMs)))} instead of ${formatDuration(Math.max(0, Math.round(originalMs)))})`;
        });

        throw new Error(
            `Invoice hours are below the selected recorded time for ${reducedTasks.length} tasks: ${taskSummaries.join('; ')}. `
            + 'To invoice only part of this time, split or edit the source time entries, then try again.'
        );
    }

    plannedTaskAdjustments.forEach(({ task, taskId, deltaMs, existingEntry }) => {

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
    items?: unknown;
    expenseItems?: unknown;
    projectBreakdowns?: unknown;
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
    if (Array.isArray(invoice.projectBreakdowns)) {
        invoice.projectBreakdowns.filter(isRecord).forEach((breakdown) => collect(breakdown.expenseItems));
    }

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

function getSelectedTaskTitle(
    taskId: string,
    taskById: Map<string, Task>,
    snapshot: InvoiceBillingSelectionSnapshot
): string {
    return getDisplayTitle(snapshot.tasks.find((selection) => selection.taskId === taskId)?.title, taskId)
        || getDisplayTitle(taskById.get(taskId)?.title, taskId);
}

function getDisplayTitle(title: unknown, entityId = ''): string {
    const normalizedTitle = getString(title);

    return normalizedTitle && normalizedTitle !== getString(entityId) ? normalizedTitle : '';
}

function describeNamedEntity(prefix: string, title: string, entityId = ''): string {
    const displayTitle = getDisplayTitle(title, entityId);

    return displayTitle ? `${prefix} "${displayTitle}"` : prefix;
}

function describeTaskTime(taskTitle: string): string {
    return describeNamedEntity('Selected time for task', taskTitle);
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
