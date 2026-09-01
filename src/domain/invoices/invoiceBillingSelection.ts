import type { Invoice, InvoiceBillingSelectionSnapshot } from '@/stores/yjs/types';
import type { ProjectInvoicePreview } from '@/utils/invoicePreviewUtils';
import { getBillableDurationMs } from '@/utils/timeEntryDurationUtils';
import type { InvoiceFinalizationPlan } from './invoiceFinalization';
import { getFiniteInvoiceNumber } from './invoiceNumbers';
import { collectInvoiceTaskRoots } from './invoiceTaskRecords';
import { usesInvoiceTaskFlatRate } from './invoiceTaskPricing';

export function buildInvoiceBillingSelectionSnapshot({
    preview,
    capturedAt,
}: {
    preview: ProjectInvoicePreview;
    capturedAt: number;
}): InvoiceBillingSelectionSnapshot {
    const taskRateById = new Map(preview.taskSelections.map((task) => [task.taskId, task]));

    return {
        version: 1,
        capturedAt,
        invoiceCurrency: preview.currency,
        entries: preview.entrySelections.map((entry) => ({
            ...entry,
            billedHourlyRate: taskRateById.get(entry.taskId)?.pricingMode === 'hourly'
                ? taskRateById.get(entry.taskId)?.rate ?? null
                : null,
        })),
        tasks: preview.taskSelections.map((task) => ({ ...task })),
        expenses: preview.expenseSelections.map((expense) => ({ ...expense })),
    };
}

export function buildInvoiceBillingSelectionSnapshotFromPlan({
    invoice,
    plan,
    capturedAt,
}: {
    invoice: Invoice;
    plan: InvoiceFinalizationPlan;
    capturedAt: number;
}): InvoiceBillingSelectionSnapshot {
    const invoiceRecord = invoice as Invoice & {
        tasks?: Array<Record<string, unknown>>;
        expenseItems?: Array<Record<string, unknown>>;
        projectBreakdowns?: Array<Record<string, unknown>>;
    };
    const taskRecords = collectTaskRecords(invoiceRecord);
    const itemRecords = Array.isArray(invoice.items) ? invoice.items : [];
    const expenseRecords = collectExpenseRecords(invoiceRecord);

    return {
        version: 1,
        capturedAt,
        invoiceCurrency: invoice.currency || 'EUR',
        entries: plan.entriesToBill.map(({ entry, billedHourlyRate }) => ({
            entryId: entry.id,
            taskId: entry.taskId,
            start: entry.start,
            end: entry.end,
            actualDurationMs: entry.end - entry.start,
            billableDurationMs: getBillableDurationMs(entry),
            billedHourlyRate,
        })),
        tasks: Array.from(plan.selectedTaskIds).map((taskId) => {
            const task = taskRecords.find((candidate) => candidate.id === taskId);
            const item = itemRecords.find((candidate) => candidate.taskId === taskId);
            const useFlatRate = task?.useFlatRate === false
                ? false
                : (task?.useFlatRate === true
                    || item?.pricingMode === 'flat'
                    || Boolean(task && usesInvoiceTaskFlatRate(task)));
            const quantity = getFiniteInvoiceNumber(item?.quantity)
                ?? (useFlatRate ? getFiniteInvoiceNumber(task?.quantity) : getFiniteInvoiceNumber(task?.hours))
                ?? 0;
            const rate = getFiniteInvoiceNumber(item?.rate)
                ?? (useFlatRate ? getFiniteInvoiceNumber(task?.flatRate) : (getFiniteInvoiceNumber(task?.hourlyRate) ?? getFiniteInvoiceNumber(task?.projectHourlyRate)))
                ?? 0;
            const amount = getFiniteInvoiceNumber(item?.amount) ?? quantity * rate;
            const quotedClaim = plan.quotedTaskClaims.find((claim) => claim.taskId === taskId);

            return {
                taskId,
                title: stringValue(item?.description) || stringValue(task?.title) || 'Task',
                pricingMode: useFlatRate ? 'flat' : 'hourly',
                quantity,
                rate,
                amount,
                quotedAmount: quotedClaim?.total ?? null,
            };
        }),
        expenses: plan.expensesToBill.map((expense) => {
            const item = itemRecords.find((candidate) => candidate.expenseId === expense.id);
            const legacyItem = expenseRecords.find((candidate) => candidate.id === expense.id);
            const sourceAmount = expense.amount;
            const sourceCurrency = expense.currency;
            const invoiceAmount = getFiniteInvoiceNumber(item?.amount) ?? getFiniteInvoiceNumber(legacyItem?.amount) ?? sourceAmount;
            const invoiceCurrency = invoice.currency || sourceCurrency;

            return {
                expenseId: expense.id,
                title: stringValue(item?.description) || stringValue(legacyItem?.title) || expense.title,
                sourceAmount,
                sourceCurrency,
                invoiceAmount,
                invoiceCurrency,
                exchangeRate: getFiniteInvoiceNumber(item?.exchangeRate)
                    ?? getFiniteInvoiceNumber(legacyItem?.exchangeRate)
                    ?? (sourceAmount === 0 ? 1 : invoiceAmount / sourceAmount),
            };
        }),
    };
}

function collectTaskRecords(invoice: {
    tasks?: Array<Record<string, unknown>>;
    projectBreakdowns?: Array<Record<string, unknown>>;
}) {
    const records: Array<Record<string, unknown>> = [];
    const collect = (
        tasks: unknown,
        inheritedUseFlatRate: boolean | null = null,
        inheritedHourlyRate: number | null = null
    ) => {
        if (!Array.isArray(tasks)) return;

        tasks.filter(isRecord).forEach((task) => {
            const effectiveUseFlatRate = inheritedUseFlatRate ?? usesInvoiceTaskFlatRate(task);
            const ownHourlyRate = getFiniteInvoiceNumber(task.hourlyRate)
                ?? getFiniteInvoiceNumber(task.projectHourlyRate);
            const effectiveHourlyRate = effectiveUseFlatRate
                ? null
                : (ownHourlyRate ?? inheritedHourlyRate);
            const normalizedTask = {
                ...task,
                useFlatRate: effectiveUseFlatRate,
                ...(effectiveHourlyRate !== null ? { hourlyRate: effectiveHourlyRate } : {}),
            };

            records.push(normalizedTask);
            collect(task.mergedSubtasks, effectiveUseFlatRate, effectiveHourlyRate);
        });
    };

    collect(collectInvoiceTaskRoots(invoice));
    return records;
}

function collectExpenseRecords(invoice: {
    expenseItems?: Array<Record<string, unknown>>;
    projectBreakdowns?: Array<Record<string, unknown>>;
}) {
    const records = [...(invoice.expenseItems || [])];
    invoice.projectBreakdowns?.forEach((breakdown) => {
        if (Array.isArray(breakdown.expenseItems)) records.push(...breakdown.expenseItems.filter(isRecord));
    });
    return records;
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
