import type { Invoice, InvoiceItem, InvoiceBillingSelectionSnapshot } from '@/stores/yjs/types';
import { allocateInvoiceProjectBreakdowns } from '@/utils/invoiceUtils';

type TaskRecord = Record<string, any>;
type DraftRecord = Invoice & Record<string, any>;

/** Read both shipped invoice representations without rewriting historical records. */
export function getInvoiceDraftEditorRecord(invoice: DraftRecord): DraftRecord {
    const items = invoice.items || [];
    const captured = invoice.billingSelectionSnapshot;
    const taskFromItem = (item: InvoiceItem, index: number): TaskRecord => {
        const pricingMode = item.pricingMode ?? captured?.tasks.find(task => task.taskId === item.taskId)?.pricingMode ?? (item.taskId ? 'hourly' : 'flat');
        const isNewSelection = captured && !captured.tasks.some(task => task.taskId === item.taskId);
        const originalTimeMs = isNewSelection ? undefined : captured?.entries.filter(entry => entry.taskId === item.taskId)
            .reduce((sum, entry) => sum + entry.billableDurationMs, 0) ?? item.quantity * 3600000;
        return {
            id: item.taskId || `manual-${invoice.id}-${index}`,
            title: item.description,
            projectId: item.projectId || invoice.projectId || null,
            hours: pricingMode === 'hourly' ? item.quantity : 0,
            originalHours: originalTimeMs === undefined ? undefined : originalTimeMs / 3600000,
            originalTimeMs,
            hourlyRate: item.rate,
            flatRate: item.rate,
            quantity: item.quantity,
            useFlatRate: pricingMode !== 'hourly',
            billable: true,
        };
    };
    return {
        ...invoice,
        note: invoice.note ?? invoice.notes ?? '',
        tasks: invoice.tasks || items.filter(item => item.taskId).map(taskFromItem),
        additionalTasks: invoice.additionalTasks || items
            .filter(item => !item.taskId && !item.expenseId && item.lineType !== 'expense')
            // Legacy UI invoice-only expenses have no lineType.
            .filter(item => item.lineType || item.pricingMode)
            .map(taskFromItem),
        discountType: invoice.discountType ?? 'fixed',
        discountValue: invoice.discountValue ?? invoice.discount ?? 0,
        taxOverride: invoice.taxOverride ?? (invoice.taxRate !== undefined
            ? { enabled: true, rate: invoice.taxRate, label: invoice.taxLabel || 'Tax' }
            : null),
    };
}

/** Canonical linked/manual lines coexist with the existing UI layout snapshots. */
export function getInvoiceDraftItems(invoice: DraftRecord): InvoiceItem[] {
    if (!Array.isArray(invoice.tasks) && !Array.isArray(invoice.additionalTasks)) return invoice.items || [];
    const items: InvoiceItem[] = [];
    const seen = new Set<string>();
    const addTask = (task: TaskRecord, linked: boolean, included = false) => {
        if (linked && seen.has(task.id)) return;
        if (linked) seen.add(task.id);
        const flat = included || (task.useFlatRate === undefined ? task.projectFlatRate === true : task.useFlatRate === true);
        const quantity = Number(flat ? task.quantity ?? 1 : task.hours ?? 0);
        const rate = included ? 0 : Number(flat ? task.flatRate ?? 0 : task.hourlyRate ?? task.projectHourlyRate ?? 0);
        items.push({
            description: task.title || 'Work', quantity, rate,
            amount: Math.round((quantity * rate + Number.EPSILON) * 100) / 100,
            ...(linked ? { taskId: task.id } : {}),
            ...(task.projectId || (linked && invoice.projectId) ? { projectId: task.projectId || invoice.projectId } : {}),
            lineType: linked ? 'task' : 'custom', pricingMode: flat ? 'flat' : 'hourly',
        });
        if (Array.isArray(task.mergedSubtasks)) task.mergedSubtasks.forEach((child: TaskRecord) => addTask(child, linked, flat));
    };
    (invoice.tasks || []).forEach((task: TaskRecord) => addTask(task, true));
    (invoice.additionalTasks || []).forEach((task: TaskRecord) => addTask(task, false));
    return [...items, ...(invoice.items || [])
        .filter(item => !item.taskId && (item.expenseId || item.lineType === 'expense' || !item.lineType))
        .map(item => ({ ...item, lineType: 'expense' as const }))];
}

/** Keep the UI/PDF expense groups and project attribution aligned with edited canonical lines. */
export function synchronizeInvoiceDraftLayout(invoice: DraftRecord, projects: Array<{ id: string; title: string }> = []): DraftRecord {
    const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const expenses = invoice.items.filter(item => !item.taskId && (item.expenseId || item.lineType === 'expense' || !item.lineType));
    const expenseItems = expenses.map((item, index) => ({
        ...(invoice.expenseItems || []).find((expense: any) => item.expenseId && expense.id === item.expenseId),
        id: item.expenseId || `invoice-expense-${invoice.id}-${index}`, title: item.description,
        amount: item.amount, projectId: item.projectId || null, currency: invoice.currency,
        originalAmount: item.originalAmount ?? item.amount, originalCurrency: item.originalCurrency || invoice.currency,
        exchangeRate: item.exchangeRate ?? 1,
    }));
    const projectIds = [...new Set([invoice.projectId, ...(invoice.projectIds || [])].filter(Boolean))];
    const breakdowns = projectIds.map(projectId => {
        const prior = invoice.projectBreakdowns?.find((breakdown: any) => breakdown.projectId === projectId);
        const projectItems = invoice.items.filter(item => item.projectId === projectId);
        return {
            ...prior, projectId, projectTitle: prior?.projectTitle || projects.find(project => project.id === projectId)?.title || invoice.project?.title || 'Project', clientId: invoice.clientId,
            pricingMode: 'mixed' as const, tasks: (invoice.tasks || []).filter((task: any) => (task.projectId || invoice.projectId) === projectId),
            expenseItems: expenseItems.filter((expense, index) => expenses[index].expenseId && expense.projectId === projectId),
            totalHours: projectItems.filter(item => item.pricingMode === 'hourly').reduce((sum, item) => sum + item.quantity, 0),
            subtotal: round(projectItems.reduce((sum, item) => sum + item.amount, 0)),
        };
    });
    return {
        ...invoice, expenseItems,
        clientExpenseItems: expenseItems.filter((expense, index) => expenses[index].expenseId && !expense.projectId),
        invoiceOnlyExpenseItems: expenseItems.filter((_expense, index) => !expenses[index].expenseId),
        totalHours: invoice.items.filter(item => item.pricingMode === 'hourly').reduce((sum, item) => sum + item.quantity, 0),
        projectBreakdowns: allocateInvoiceProjectBreakdowns(breakdowns, invoice),
    };
}

/** Reprice only the selected sources; later tracked work never enters this snapshot. */
export function updateDraftSelectionPricing(
    invoice: DraftRecord,
    snapshot: InvoiceBillingSelectionSnapshot,
): InvoiceBillingSelectionSnapshot {
    const items = invoice.items || [];
    const taskItems = new Map(items.filter(item => item.taskId).map(item => [item.taskId!, item]));
    const expenseItems = new Map(items.filter(item => item.expenseId).map(item => [item.expenseId!, item]));
    return {
        ...snapshot,
        tasks: snapshot.tasks.filter(task => taskItems.has(task.taskId)).map(task => {
            const item = taskItems.get(task.taskId)!;
            return { ...task, title: item.description, quantity: item.quantity, rate: item.rate, amount: item.amount, pricingMode: item.pricingMode === 'flat' ? 'flat' : 'hourly' };
        }),
        entries: snapshot.entries.filter(entry => taskItems.has(entry.taskId)).map(entry => {
            const item = taskItems.get(entry.taskId)!;
            return { ...entry, billedHourlyRate: item.pricingMode === 'flat' ? null : item.rate };
        }),
        expenses: snapshot.expenses.filter(expense => expenseItems.has(expense.expenseId)).map(expense => ({
            ...expense, invoiceAmount: expenseItems.get(expense.expenseId)!.amount,
        })),
    };
}
