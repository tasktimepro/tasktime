import type { YjsStore } from './YjsStore';
import type { Client, Expense, Invoice, InvoiceTemplate, Project, Task, TimeEntry } from './types';
import { collectEntities, objectToYMap, readEntity, updateEntityFields } from './entityUtils';
import { collectValidatedEntities, validateCollectionEntity } from './validation';
import { getInvoiceDraftEditorRecord, getInvoiceDraftItems, updateDraftSelectionPricing, synchronizeInvoiceDraftLayout } from '@/domain/invoices/invoiceDraftDocument';
import { buildInvoiceBillingSelectionSnapshotFromPlan } from '@/domain/invoices/invoiceBillingSelection';
import { planInvoiceFinalization } from '@/domain/invoices/invoiceFinalization';
import { buildInvoiceFinalizationApplication } from '@/domain/invoices/invoiceFinalizationApplication';
import { generateInvoiceNumber } from '@/components/invoice/utils/invoiceDateUtils';
import { getNextSequentialNumberForTemplate, resolveCurrentInvoiceTemplate } from '@/utils/invoiceUtils';
import { generateId } from '@/utils/idUtils';
import { getInvoiceExpensePreview, getProjectInvoicePreview } from '@/utils/invoicePreviewUtils';
import { buildDraftExpenseItems, buildDraftInvoiceItems } from '@/domain/invoices/invoiceDraft';
import { buildInvoiceBillingSelectionSnapshot } from '@/domain/invoices/invoiceBillingSelection';

type DraftRecord = Invoice & Record<string, any>;

// Yjs insertion order and schema validation order can differ without a data change.
const draftFingerprint = (invoice: Invoice) => JSON.stringify(invoice, (_key, value) => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
        : value
));

function assertCurrentDraft(store: YjsStore, invoiceId: string, expected: Invoice | null) {
    const current = readEntity<Invoice>(store.invoices.get(invoiceId));
    if (expected ? !current || draftFingerprint(current) !== draftFingerprint(expected) : current) {
        throw new Error('This invoice changed while it was open. Reopen it to review the latest version.');
    }
    if (current && current.status !== 'draft') throw new Error('Only draft invoices can be edited or deleted.');
    if (collectEntities<any>(store.invoiceBillingOperations as any)
        .some(operation => operation.invoiceId === invoiceId && operation.state !== 'complete')) {
        throw new Error('This invoice has a pending billing operation. Wait for it to finish before changing the draft.');
    }
}

/** A draft write has no billing, numbering, or project-link side effects. */
export function persistInvoiceDraft(store: YjsStore, invoice: DraftRecord, expected: Invoice | null, now = Date.now()): DraftRecord {
    assertCurrentDraft(store, invoice.id, expected);
    const record = validateCollectionEntity<DraftRecord>('invoices', {
        ...invoice, status: 'draft', createdAt: expected?.createdAt ?? invoice.createdAt ?? now, updatedAt: now,
    }, 'save invoice draft');
    store.coreDoc.transact(() => {
        if (expected) updateEntityFields(store.invoices as any, record.id, record);
        else (store.invoices as any).set(record.id, objectToYMap(record));
    });
    return readEntity<DraftRecord>(store.invoices.get(record.id))!;
}

export function deleteInvoiceDraft(store: YjsStore, expected: Invoice): void {
    assertCurrentDraft(store, expected.id, expected);
    store.coreDoc.transact(() => store.invoices.delete(expected.id));
}

/** Load before reading so every consumer sees the same complete, current history. */
export async function loadInvoiceDraftSources(store: YjsStore) {
    const [archivedTasks, archivedExpenses, archivedInvoices] = await Promise.all([
        store.loadArchivedTasks(), store.loadArchivedExpenses(), store.loadArchivedInvoices(), store.loadAllTimeEntries(),
    ]);
    const collect = <T>(name: 'tasks' | 'expenses' | 'invoices', maps: any[]): T[] => {
        const seen = new Set<string>();
        return maps.filter(Boolean).flatMap(map => collectValidatedEntities<T & { id: string }>(name, map, `invoice draft ${name}`))
            .filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
    };
    return {
        projects: collectValidatedEntities<Project>('projects', store.projects as any, 'invoice draft projects'),
        clients: collectValidatedEntities<Client>('clients', store.clients as any, 'invoice draft clients'),
        tasks: collect<Task>('tasks', [store.tasks, archivedTasks]),
        expenses: collect<Expense>('expenses', [store.expenses, archivedExpenses]),
        invoices: collect<Invoice>('invoices', [store.invoices, archivedInvoices]),
        entries: store.getAllTimeEntries() as TimeEntry[],
        templates: collectValidatedEntities<InvoiceTemplate>('invoiceTemplates', store.invoiceTemplates as any, 'invoice draft templates'),
    };
}

/** Capture new selections, retaining previously saved sources until explicit refresh. */
export async function saveInvoiceDraft(store: YjsStore, invoice: DraftRecord, expected: Invoice | null, now = Date.now()): Promise<DraftRecord> {
    assertCurrentDraft(store, invoice.id, expected);
    const sources = await loadInvoiceDraftSources(store);
    assertCurrentDraft(store, invoice.id, expected);
    const document = getInvoiceDraftEditorRecord(structuredClone(invoice));
    document.items = getInvoiceDraftItems(document);
    const snapshot = captureDraftSelection(document, expected?.billingSelectionSnapshot, sources, now);
    return persistInvoiceDraft(store, {
        ...document, billingSelectionSnapshot: snapshot,
        draftNumberMode: document.draftNumberMode ?? (expected ? 'manual' : 'automatic'),
    }, expected, now);
}

function captureDraftSelection(document: DraftRecord, existingSnapshot: Invoice['billingSelectionSnapshot'], sources: Awaited<ReturnType<typeof loadInvoiceDraftSources>>, now: number) {
    const previous = existingSnapshot;
    const plan = planInvoiceFinalization({ ...sources, invoice: { ...document, status: 'sent', billingSelectionSnapshot: null, ...(previous ? { agentDraft: undefined } : {}) }, finalizedAt: now, createAdjustmentId: generateId });
    let snapshot = buildInvoiceBillingSelectionSnapshotFromPlan({ invoice: document, plan, capturedAt: now });
    if (previous) {
        const retained = updateDraftSelectionPricing(document, previous);
        const oldTasks = new Set(previous.tasks.map(task => task.taskId));
        const oldExpenses = new Set(previous.expenses.map(expense => expense.expenseId));
        snapshot = {
            ...snapshot, capturedAt: previous.capturedAt,
            entries: [...retained.entries, ...snapshot.entries.filter(entry => !oldTasks.has(entry.taskId))],
            tasks: [...retained.tasks, ...snapshot.tasks.filter(task => !oldTasks.has(task.taskId))],
            expenses: [...retained.expenses, ...snapshot.expenses.filter(expense => !oldExpenses.has(expense.expenseId))],
        };
    }
    const sourceMs = new Map<string, number>();
    snapshot.entries.forEach(entry => sourceMs.set(entry.taskId, (sourceMs.get(entry.taskId) || 0) + entry.billableDurationMs));
    const fillNewSourceDuration = (tasks: any[]) => (tasks || []).forEach(task => {
        if (task.originalTimeMs === undefined && task.originalHours === undefined) {
            task.originalTimeMs = sourceMs.get(task.id) || 0;
            task.originalHours = task.originalTimeMs / 3600000;
        }
        if (Array.isArray(task.mergedSubtasks)) fillNewSourceDuration(task.mergedSubtasks);
    });
    fillNewSourceDuration(document.tasks);
    document.projectBreakdowns?.forEach((breakdown: any) => fillNewSourceDuration(breakdown.tasks));
    return snapshot;
}

/** Explicitly replace linked work with today's eligible selection for the chosen scope. */
export async function refreshInvoiceDraft(
    store: YjsStore, invoice: DraftRecord, expected: Invoice,
    exchangeRates: Record<string, number> | null = null, now = Date.now(),
): Promise<DraftRecord> {
    assertCurrentDraft(store, invoice.id, expected);
    const sources = await loadInvoiceDraftSources(store);
    assertCurrentDraft(store, invoice.id, expected);
    const projectIds = [...new Set([invoice.projectId, ...(invoice.projectIds || [])].filter(Boolean))];
    const manualItems = getInvoiceDraftItems(invoice).filter(item => !item.taskId && !item.expenseId);
    const items = [...manualItems];
    const selection = { version: 1 as const, capturedAt: now, invoiceCurrency: invoice.currency || 'EUR', entries: [], tasks: [], expenses: [] } as NonNullable<Invoice['billingSelectionSnapshot']>;
    const seenExpenses = new Set<string>();
    const includeClientLevelExpenses = invoice.agentDraft ? invoice.agentDraft.includeClientLevelExpenses === true : true;
    for (const projectId of projectIds) {
        const project = sources.projects.find(candidate => candidate.id === projectId);
        if (!project || project.isPersonal) throw new Error('A selected project is no longer available for billing. Review the draft scope.');
        const preview = getProjectInvoicePreview(project, {
            ...sources, timeEntries: sources.entries, exchangeRates,
            billingPeriodStart: invoice.billingPeriodStart || '', billingPeriodEnd: invoice.billingPeriodEnd || '',
            includeClientLevelExpenses,
            preferredCurrency: invoice.currency,
        });
        if (preview.currency !== selection.invoiceCurrency) throw new Error('Selected projects must use the invoice currency before refreshing work.');
        if (preview.excludedExpenseCount > 0) throw new Error('Refresh requires current exchange rates for the selected expenses.');
        preview.expenseSelections = preview.expenseSelections.filter(expense => {
            if (seenExpenses.has(expense.expenseId)) return false;
            seenExpenses.add(expense.expenseId); return true;
        });
        preview.taskAmount = preview.taskSelections.reduce((sum, task) => sum + task.amount, 0);
        preview.expenseAmount = preview.expenseSelections.reduce((sum, expense) => sum + expense.invoiceAmount, 0);
        items.push(...buildDraftInvoiceItems(project, preview).map(item => item.expenseId
            ? { ...item, projectId: sources.expenses.find(expense => expense.id === item.expenseId)?.projectId || undefined }
            : item));
        const snapshot = buildInvoiceBillingSelectionSnapshot({ preview, capturedAt: now });
        selection.entries.push(...snapshot.entries);
        selection.tasks.push(...snapshot.tasks);
        selection.expenses.push(...snapshot.expenses);
    }
    if (includeClientLevelExpenses && invoice.clientId) {
        const preview = getInvoiceExpensePreview({
            expenses: sources.expenses.filter(expense => !seenExpenses.has(expense.id)),
            currency: selection.invoiceCurrency, clientIds: [invoice.clientId], exchangeRates,
            billingPeriodStart: invoice.billingPeriodStart || '', billingPeriodEnd: invoice.billingPeriodEnd || '',
        });
        if (preview.excludedExpenseCount > 0) throw new Error('Refresh requires current exchange rates for the selected expenses.');
        items.push(...buildDraftExpenseItems(preview.expenseSelections));
        selection.expenses.push(...preview.expenseSelections);
    }
    const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const subtotal = round(items.reduce((sum, item) => sum + item.amount, 0));
    const discount = invoice.discountType === 'percentage' ? subtotal * (Number(invoice.discountValue) || 0) / 100 : Number(invoice.discountValue ?? invoice.discount ?? 0);
    const shipping = Number(invoice.shipping) || 0;
    const tax = (subtotal - discount + shipping) * (Number(invoice.taxRate) || 0) / 100;
    const refreshed = getInvoiceDraftEditorRecord({
        ...invoice, items, tasks: undefined, additionalTasks: undefined,
        billingSelectionSnapshot: selection, subtotal, discount: round(discount), tax: round(tax), total: round(subtotal - discount + shipping + tax),
        taskFlatRates: {}, taskHourlyRates: {}, taskQuantities: {}, useFlatRate: {}, mergedSubtasks: {}, htmlContent: null,
    });
    refreshed.projectBreakdowns = projectIds.map(projectId => {
        const projectItems = items.filter(item => item.projectId === projectId);
        return {
            projectId, projectTitle: sources.projects.find(project => project.id === projectId)?.title || '', clientId: invoice.clientId,
            pricingMode: 'mixed', tasks: refreshed.tasks.filter((task: any) => task.projectId === projectId),
            totalHours: projectItems.filter(item => item.pricingMode === 'hourly').reduce((sum, item) => sum + item.quantity, 0),
            subtotal: round(projectItems.reduce((sum, item) => sum + item.amount, 0)),
        };
    });
    return persistInvoiceDraft(store, synchronizeInvoiceDraftLayout(refreshed), expected, now);
}

/** Revalidate the reviewed snapshot and allocate its final number at the journal boundary. */
export async function finalizeSavedInvoice(
    store: YjsStore, invoice: DraftRecord, expected: Invoice | null,
    operationId = generateId(), now = Date.now(),
) {
    assertCurrentDraft(store, invoice.id, expected);
    const sources = await loadInvoiceDraftSources(store);
    assertCurrentDraft(store, invoice.id, expected);
    let document = getInvoiceDraftEditorRecord(structuredClone(invoice));
    document = { ...document, items: getInvoiceDraftItems(document), status: 'draft', htmlContent: null };
    document.billingSelectionSnapshot = captureDraftSelection(document, invoice.billingSelectionSnapshot, sources, now);
    const template = resolveCurrentInvoiceTemplate(document, sources.templates);
    const pending = collectEntities<any>(store.invoiceBillingOperations as any).filter(operation => operation.state !== 'complete');
    const usedNumbers = new Set([
        ...sources.invoices.filter(other => other.id !== document.id && other.status !== 'draft').map(other => other.invoiceNumber),
        ...pending.map(operation => operation.desiredInvoice?.invoiceNumber).filter(Boolean),
    ]);
    let allocatedSequence: number | null = null;
    if (document.draftNumberMode === 'automatic' && template) {
        allocatedSequence = getNextSequentialNumberForTemplate(template, sources.invoices);
        for (let attempt = 0; attempt <= usedNumbers.size; attempt++) {
            document.invoiceNumber = generateInvoiceNumber({ ...template, currentSequentialNumber: allocatedSequence },
                sources.projects.find(project => project.id === document.projectId), { issuedAt: document.date, timestamp: now });
            if (!usedNumbers.has(document.invoiceNumber) || !template.useSequentialNumbers || !template.invoiceNumberFormat.includes('{sequential}')) break;
            allocatedSequence++;
        }
    }
    if (document.draftNumberMode === 'automatic' && !template) document.invoiceNumber = `INV-${document.id.slice(-8)}-${now}`;
    if (usedNumbers.has(document.invoiceNumber)) {
        throw new Error('This invoice number is already in use. Choose an unused number before finalizing.');
    }
    const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
    const itemSubtotal = roundMoney(document.items.reduce((sum, item) => sum + item.amount, 0));
    const unroundedSubtotal = roundMoney(document.items.reduce((sum, item) => sum + item.quantity * item.rate, 0));
    // Both shipped line-rounding representations remain valid. Never accept
    // a subtotal that disagrees with both the lines and the composer.
    if (Math.abs(document.subtotal - itemSubtotal) > 0.005 && Math.abs(document.subtotal - unroundedSubtotal) > 0.005) {
        throw new Error('Invoice subtotal does not match its line items. Review the draft amounts before finalizing.');
    }
    const expectedTotal = roundMoney(document.subtotal - (Number(document.discount) || 0) + (Number(document.shipping) || 0) + (Number(document.tax) || 0));
    if (Math.abs(document.total - expectedTotal) > 0.015) throw new Error('Invoice total does not match its subtotal, discount, shipping and tax. Review the draft amounts before finalizing.');
    if (!(document.total > 0)) throw new Error('Invoice total must be greater than zero before finalizing.');
    const { application } = buildInvoiceFinalizationApplication({
        ...sources, invoice: document, invoiceTemplate: template,
        invoices: [...sources.invoices.filter(other => other.id !== document.id), { ...document, status: 'sent' }],
        finalizedAt: now, createAdjustmentId: generateId,
    });
    if (allocatedSequence !== null && application.invoiceTemplateSequenceUpdate) {
        application.invoiceTemplateSequenceUpdate.updates.currentSequentialNumber = Math.max(allocatedSequence + 1, Number(application.invoiceTemplateSequenceUpdate.updates.currentSequentialNumber) || 1);
    }
    for (const operation of pending) {
        if (operation.kind !== 'finalize') continue;
        if ((['timeEntryUpdates', 'expenseUpdates', 'quotedTaskUpdates'] as const).some(key => {
            const reserved = new Set((operation.application?.[key] || []).map((update: any) => update.id));
            return application[key].some(update => reserved.has(update.id));
        })) throw new Error('Selected work is being finalized by another invoice. Wait for that billing operation to finish, then refresh this draft.');
    }
    const finalizedInvoice = await store.commitInvoiceFinalization({
        operationId, desiredInvoice: { ...document, ...application.invoiceUpdates }, application, createdAt: now,
    });
    return { invoice: finalizedInvoice, application };
}
