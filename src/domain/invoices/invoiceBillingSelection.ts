import type { Invoice, InvoiceBillingSelectionSnapshot } from '@/stores/yjs/types';
import type { ProjectInvoicePreview } from '@/utils/invoicePreviewUtils';
import { getBillableDurationMs } from '@/utils/timeEntryDurationUtils';
import type { InvoiceFinalizationPlan } from './invoiceFinalization';

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
            const useFlatRate = task?.useFlatRate === true || task?.projectFlatRate === true || item?.pricingMode === 'flat';
            const quantity = finiteNumber(item?.quantity)
                ?? (useFlatRate ? finiteNumber(task?.quantity) : finiteNumber(task?.hours))
                ?? 0;
            const rate = finiteNumber(item?.rate)
                ?? (useFlatRate ? finiteNumber(task?.flatRate) : (finiteNumber(task?.hourlyRate) ?? finiteNumber(task?.projectHourlyRate)))
                ?? 0;
            const amount = finiteNumber(item?.amount) ?? quantity * rate;
            const quotedClaim = plan.quotedTaskClaims.find((claim) => claim.taskId === taskId);

            return {
                taskId,
                title: stringValue(item?.description) || stringValue(task?.title) || taskId,
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
            const invoiceAmount = finiteNumber(item?.amount) ?? finiteNumber(legacyItem?.amount) ?? sourceAmount;
            const invoiceCurrency = invoice.currency || sourceCurrency;

            return {
                expenseId: expense.id,
                title: stringValue(item?.description) || stringValue(legacyItem?.title) || expense.title,
                sourceAmount,
                sourceCurrency,
                invoiceAmount,
                invoiceCurrency,
                exchangeRate: finiteNumber(item?.exchangeRate)
                    ?? finiteNumber(legacyItem?.exchangeRate)
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
    const collect = (tasks: unknown) => {
        if (!Array.isArray(tasks)) return;

        tasks.filter(isRecord).forEach((task) => {
            records.push(task);
            collect(task.mergedSubtasks);
        });
    };

    collect(invoice.tasks);
    invoice.projectBreakdowns?.forEach((breakdown) => {
        collect(breakdown.tasks);
    });
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

function finiteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
