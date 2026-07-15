/**
 * useInvoices - React hook for invoices collection
 * 
 * Handles active invoices and on-demand loading of archived invoices
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useYjsCollection } from './useYjsCollection';
import type { Expense, Invoice, Task } from '@/stores/yjs/types';
import { collectEntities, readEntity, updateEntityFields } from '@/stores/yjs/entityUtils';
import { fetchExchangeRates, normalizeCurrencyCode } from '@/utils/currencyUtils';
import {
    canUndoInvoice as canUndoInvoiceRecord,
    createInvoicePaymentCurrencySnapshot,
    getInvoiceSequenceRollback,
    invoiceBelongsToProject,
    getInvoiceUndoBlockReason as getInvoiceUndoBlockReasonForCollection,
    getInvoiceStatus,
    getInvoiceTotal,
    isInvoiceCanceled,
    isInvoicePaid,
    resolveCurrentInvoiceTemplate,
} from '@/utils/invoiceUtils';
import { buildMarkInvoicePaidUpdates, buildMarkInvoiceUnpaidUpdates } from '@/domain/invoices/invoicePayment';
import {
    buildInvoiceUndoApplication,
    buildReleasedQuotedTaskUpdates,
} from '@/domain/invoices/invoiceUndoApplication';
import { generateId } from '@/utils/idUtils';
import type { InvoiceFinalizationApplicationPlan } from '@/domain/invoices/invoiceFinalizationApplication';
import {
    buildInvoiceCancellationApplication,
    buildInvoiceCancellationResult,
    getInvoiceCancellationBlockReason as getInvoiceCancellationBlockReasonForRecord,
} from '@/domain/invoices/invoiceCancellation';
import { isInvoiceBillingOperation, type InvoiceBillingOperation } from '@/domain/invoices/invoiceBillingOperation';

const shouldStoreInvoicePaymentSnapshot = (invoice: Partial<Invoice>, preferredCurrency: string) => {
    return normalizeCurrencyCode(invoice.currency || preferredCurrency) !== preferredCurrency;
};

export interface UseInvoicesOptions {
    /** Filter to a specific project */
    projectId?: string;
    /** Filter to a specific client */
    clientId?: string;
    /** Include archived invoices (triggers lazy loading) */
    includeArchived?: boolean;
}

export interface UpdateInvoicePaymentDetailsOptions {
    paidAt?: number;
    paymentCurrencySnapshot?: Invoice['paymentCurrencySnapshot'];
}

export interface MarkInvoicePaidOptions extends UpdateInvoicePaymentDetailsOptions {}

export interface CancelInvoiceOptions {
    reason: string;
    canceledAt?: number;
    operationId?: string;
}

export function useInvoices(options: UseInvoicesOptions = {}) {
    const {
        store,
        isReady,
        loadArchivedInvoices: loadArchived,
        loadArchivedTasks,
        loadArchivedExpenses,
        loadEntriesForYear,
        getAvailableYears,
    } = useYjs();
    
    // Active invoices from core doc
    const { items: activeInvoices, isLoading: activeLoading, get, create, update, remove } = 
        useYjsCollection<Invoice>((store) => store.invoices, { collectionName: 'invoices' });

    // Archived invoices state
    const [archivedInvoices, setArchivedInvoices] = useState<Invoice[]>([]);
    const [archivedLoading, setArchivedLoading] = useState(false);
    const [archivedLoaded, setArchivedLoaded] = useState(false);
    const archivedLoadTriggered = useRef(false);

    useEffect(() => {
        if (!options.includeArchived || archivedLoaded || !store.archivedInvoicesSync) return;

        setArchivedInvoices(collectEntities<Invoice>(store.archivedInvoicesSync as any));
        setArchivedLoaded(true);
    }, [options.includeArchived, archivedLoaded, store]);

    // Load archived invoices when requested
    useEffect(() => {
        if (!options.includeArchived || !isReady || archivedLoaded || archivedLoadTriggered.current) return;

        archivedLoadTriggered.current = true;
        setArchivedLoading(true);

        loadArchived()
            .then(() => {
                const archivedMap = store.archivedInvoicesSync;
                if (archivedMap) {
                    setArchivedInvoices(collectEntities<Invoice>(archivedMap as any));
                }
                setArchivedLoaded(true);
            })
            .finally(() => {
                setArchivedLoading(false);
            });
    }, [options.includeArchived, isReady, archivedLoaded, loadArchived, store]);

    // Subscribe to archived invoices changes
    useEffect(() => {
        if (!archivedLoaded || !store.archivedInvoicesSync) return;

        const handler = () => {
            const archivedMap = store.archivedInvoicesSync;
            if (archivedMap) {
                setArchivedInvoices(collectEntities<Invoice>(archivedMap as any));
            }
        };

        store.archivedInvoicesSync.observeDeep(handler);
        return () => store.archivedInvoicesSync?.unobserveDeep(handler);
    }, [archivedLoaded, store]);

    // Combined invoices
    const allInvoices = useMemo(() => {
        if (!options.includeArchived) return activeInvoices;
        return [...activeInvoices, ...archivedInvoices];
    }, [activeInvoices, archivedInvoices, options.includeArchived]);

    // Apply filters
    const filteredInvoices = useMemo(() => {
        let result = allInvoices;
        
        if (options.projectId) {
            result = result.filter((invoice) => invoiceBelongsToProject(invoice, options.projectId));
        }
        
        if (options.clientId) {
            result = result.filter(i => i.clientId === options.clientId);
        }
        
        // Sort by date descending
        return [...result].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [allInvoices, options.projectId, options.clientId]);

    // Status filters
    const draftInvoices = useMemo(
        () => filteredInvoices.filter((invoice) => getInvoiceStatus(invoice) === 'draft'),
        [filteredInvoices]
    );

    const sentInvoices = useMemo(
        () => filteredInvoices.filter((invoice) => getInvoiceStatus(invoice) === 'sent'),
        [filteredInvoices]
    );

    const paidInvoices = useMemo(
        () => filteredInvoices.filter((invoice) => isInvoicePaid(invoice)),
        [filteredInvoices]
    );

    const overdueInvoices = useMemo(
        () => filteredInvoices.filter((invoice) => getInvoiceStatus(invoice) === 'overdue'),
        [filteredInvoices]
    );

    const canceledInvoices = useMemo(
        () => filteredInvoices.filter((invoice) => getInvoiceStatus(invoice) === 'canceled'),
        [filteredInvoices]
    );

    const getPreferredCurrency = useCallback(() => {
        const storedPreference = store.preferences?.get('currency');
        return normalizeCurrencyCode(typeof storedPreference === 'string' ? storedPreference : undefined);
    }, [store]);

    const updateInvoice = useCallback((id: string, updates: Partial<Invoice>) => {
        const invoice = get(id);

        if (isInvoiceCanceled(invoice)) {
            throw new Error('Canceled invoices are read-only historical records.');
        }

        return update(id, updates);
    }, [get, update]);

    const resolveInvoicePaymentSnapshot = useCallback(async (
        invoice: Invoice,
        preferredCurrency: string,
        paidAt: number,
        options: UpdateInvoicePaymentDetailsOptions = {}
    ) => {
        if (Object.prototype.hasOwnProperty.call(options, 'paymentCurrencySnapshot')) {
            return options.paymentCurrencySnapshot ?? undefined;
        }

        const requiresSnapshot = shouldStoreInvoicePaymentSnapshot(invoice, preferredCurrency);
        if (!requiresSnapshot) {
            return undefined;
        }

        const { rates, error } = await fetchExchangeRates();
        if (!rates) {
            throw new Error(error || 'Unable to load exchange rates for payment snapshot.');
        }

        return createInvoicePaymentCurrencySnapshot({
            invoice,
            preferredCurrency,
            exchangeRates: rates,
            capturedAt: paidAt,
        }) ?? undefined;
    }, []);

    // Status update helpers
    const markAsSent = useCallback((id: string) => {
        const invoice = get(id);
        if (!invoice) {
            return undefined;
        }
        if (isInvoiceCanceled(invoice)) {
            throw new Error('Canceled invoices are read-only historical records.');
        }
        if (invoice.status === 'draft') {
            throw new Error('Finalize this draft before marking it sent.');
        }

        return update(id, {
            status: 'sent',
            paidAt: null,
            paymentCurrencySnapshot: undefined,
        });
    }, [get, update]);

    const markAsPaid = useCallback(async (id: string, options: MarkInvoicePaidOptions = {}) => {
        const invoice = get(id);
        if (!invoice) {
            return undefined;
        }
        if (isInvoiceCanceled(invoice)) {
            throw new Error('Canceled invoices are read-only historical records.');
        }
        if (invoice.status === 'draft') {
            throw new Error('Finalize this draft before marking it paid.');
        }

        const paidAt = typeof options.paidAt === 'number' && Number.isFinite(options.paidAt)
            ? options.paidAt
            : Date.now();
        const preferredCurrency = getPreferredCurrency();
        const paymentCurrencySnapshot = await resolveInvoicePaymentSnapshot(invoice, preferredCurrency, paidAt, options);

        return update(id, buildMarkInvoicePaidUpdates({
            paidAt,
            paymentCurrencySnapshot,
        }));
    }, [get, getPreferredCurrency, resolveInvoicePaymentSnapshot, update]);

    const updatePaymentDetails = useCallback(async (id: string, options: UpdateInvoicePaymentDetailsOptions = {}) => {
        const invoice = get(id);
        if (!invoice) {
            return undefined;
        }
        if (isInvoiceCanceled(invoice)) {
            throw new Error('Canceled invoices are read-only historical records.');
        }
        if (invoice.status === 'draft') {
            throw new Error('Finalize this draft before updating payment details.');
        }

        const paidAt = typeof options.paidAt === 'number' && Number.isFinite(options.paidAt)
            ? options.paidAt
            : (typeof invoice.paidAt === 'number' && Number.isFinite(invoice.paidAt)
                ? invoice.paidAt
                : Date.now());
        const preferredCurrency = getPreferredCurrency();
        const paymentCurrencySnapshot = await resolveInvoicePaymentSnapshot(invoice, preferredCurrency, paidAt, options);

        return update(id, buildMarkInvoicePaidUpdates({
            paidAt,
            paymentCurrencySnapshot,
        }));
    }, [get, getPreferredCurrency, resolveInvoicePaymentSnapshot, update]);

    const markAsUnpaid = useCallback((id: string) => {
        const invoice = get(id);
        if (!invoice) {
            return undefined;
        }
        if (isInvoiceCanceled(invoice)) {
            throw new Error('Canceled invoices are read-only historical records.');
        }
        if (!isInvoicePaid(invoice)) {
            throw new Error('Only paid invoices can be marked as unpaid.');
        }

        return update(id, buildMarkInvoiceUnpaidUpdates({ invoice }));
    }, [get, update]);

    const releaseQuotedAmountsForInvoice = useCallback((invoiceId: string) => {
        const releaseFromTaskMap = (taskMap: unknown) => {
            if (!taskMap || typeof (taskMap as { forEach?: unknown }).forEach !== 'function') {
                return;
            }

            (taskMap as { forEach: (fn: (value: unknown, key: string) => void) => void }).forEach((value, taskId) => {
                const task = readEntity<Task>(value);

                if (!task || task.quotedAmountBilling?.invoiceId !== invoiceId) {
                    return;
                }

                const updates = buildReleasedQuotedTaskUpdates({
                    task,
                    updatedAt: Date.now(),
                });

                if (updates) {
                    updateEntityFields(taskMap as any, taskId, updates);
                }
            });
        };

        releaseFromTaskMap(store.tasks);
        releaseFromTaskMap(store.archivedTasks);

        if (!store.archivedTasks) {
            void loadArchivedTasks()
                .then(() => {
                    releaseFromTaskMap(store.archivedTasks);
                })
                .catch(() => {});
        }
    }, [loadArchivedTasks, store]);

    const deleteInvoice = useCallback((id: string) => {
        const removed = remove(id);

        if (removed) {
            releaseQuotedAmountsForInvoice(id);
        }

        return removed;
    }, [releaseQuotedAmountsForInvoice, remove]);

    const getInvoiceUndoBlockReason = useCallback((invoice: Invoice | string | null | undefined) => {
        const record = typeof invoice === 'string'
            ? allInvoices.find((candidate) => candidate.id === invoice)
            : invoice;

        return getInvoiceUndoBlockReasonForCollection(record, allInvoices);
    }, [allInvoices]);

    const canUndoInvoice = useCallback((invoice: Invoice | string | null | undefined) => {
        const record = typeof invoice === 'string'
            ? allInvoices.find((candidate) => candidate.id === invoice)
            : invoice;

        return canUndoInvoiceRecord(record, allInvoices);
    }, [allInvoices]);

    const undoLatestInvoice = useCallback(async (id: string) => {
        const invoice = get(id);
        const blockReason = getInvoiceUndoBlockReasonForCollection(invoice, allInvoices);

        if (blockReason) {
            throw new Error(blockReason);
        }

        await Promise.all([
            loadArchivedTasks(),
            loadArchivedExpenses(),
        ]);

        const availableYears = await getAvailableYears();
        await Promise.all(availableYears.map((year) => loadEntriesForYear(year)));

        const undoTimestamp = Date.now();
        const loadedEntries = store.getAllTimeEntries();
        const taskMaps = [store.tasks, store.archivedTasks].filter(Boolean);
        const allExpenseMaps = [store.expenses, store.archivedExpenses].filter(Boolean);
        const allTasks = taskMaps.flatMap((taskMap) => collectEntities<Task>(taskMap as any));
        const allExpenses = allExpenseMaps.flatMap((expenseMap) => collectEntities<Expense>(expenseMap as any));
        const template = resolveCurrentInvoiceTemplate(invoice, collectEntities(store.invoiceTemplates as any));
        const sequenceRollback = getInvoiceSequenceRollback(invoice, template, allInvoices);
        const undoApplication = buildInvoiceUndoApplication({
            invoice: invoice as Invoice,
            invoiceId: id,
            entries: loadedEntries,
            expenses: allExpenses,
            tasks: allTasks,
            projects: collectEntities(store.projects as any),
            sequenceRollback,
            templateId: template?.id,
            undoneAt: undoTimestamp,
        }).application;
        await store.commitInvoiceUndo({
            operationId: generateId(),
            invoice: invoice as Invoice,
            application: undoApplication,
            createdAt: undoTimestamp,
        });

        return {
            invoiceNumber: invoice?.invoiceNumber || id,
            clearedTimeEntryCount: undoApplication.clearedTimeEntryCount,
            deletedAdjustmentCount: undoApplication.deletedAdjustmentCount,
            unbilledExpenseCount: undoApplication.unbilledExpenseCount,
            rewoundSequence: undoApplication.rewoundSequence,
        };
    }, [
        allInvoices,
        get,
        getAvailableYears,
        loadArchivedExpenses,
        loadArchivedTasks,
        loadEntriesForYear,
        store,
    ]);

    const getInvoiceCancellationBlockReason = useCallback((invoice: Invoice | string | null | undefined) => {
        const record = typeof invoice === 'string'
            ? allInvoices.find((candidate) => candidate.id === invoice)
            : invoice;

        return getInvoiceCancellationBlockReasonForRecord(record);
    }, [allInvoices]);

    const cancelInvoice = useCallback(async (id: string, options: CancelInvoiceOptions) => {
        const operationId = options.operationId || generateId();
        const persistedOperation = readEntity<InvoiceBillingOperation>(
            store.invoiceBillingOperations?.get(operationId)
        );

        if (persistedOperation) {
            if (!isInvoiceBillingOperation(persistedOperation)
                || persistedOperation.kind !== 'cancel'
                || persistedOperation.invoiceId !== id) {
                throw new Error(`Invoice cancellation operation ${operationId} has conflicting persisted input.`);
            }

            const commit = await store.commitInvoiceCancellation({
                operationId,
                invoice: persistedOperation.invoice,
                desiredInvoice: persistedOperation.desiredInvoice,
                application: persistedOperation.application,
                createdAt: persistedOperation.createdAt,
            });

            return buildInvoiceCancellationResult({
                desiredInvoice: commit.invoice,
                application: commit.operation.application,
                alreadyApplied: commit.alreadyApplied,
            });
        }

        const invoice = get(id);
        const blockReason = getInvoiceCancellationBlockReasonForRecord(invoice);

        if (blockReason) {
            throw new Error(blockReason);
        }

        await Promise.all([
            loadArchivedTasks(),
            loadArchivedExpenses(),
        ]);

        const availableYears = await getAvailableYears();
        await Promise.all(availableYears.map((year) => loadEntriesForYear(year)));

        const canceledAt = typeof options.canceledAt === 'number'
            ? options.canceledAt
            : Date.now();
        const taskMaps = [store.tasks, store.archivedTasks].filter(Boolean);
        const expenseMaps = [store.expenses, store.archivedExpenses].filter(Boolean);
        const cancellation = buildInvoiceCancellationApplication({
            invoice: invoice as Invoice,
            entries: store.getAllTimeEntries(),
            expenses: expenseMaps.flatMap((expenseMap) => collectEntities<Expense>(expenseMap as any)),
            tasks: taskMaps.flatMap((taskMap) => collectEntities<Task>(taskMap as any)),
            projects: collectEntities(store.projects as any),
            reason: options.reason,
            canceledAt,
        });
        const commit = await store.commitInvoiceCancellation({
            operationId,
            invoice: invoice as Invoice,
            desiredInvoice: cancellation.desiredInvoice,
            application: cancellation.application,
            createdAt: canceledAt,
        });

        return buildInvoiceCancellationResult({
            desiredInvoice: commit.invoice,
            application: commit.operation.application,
            alreadyApplied: commit.alreadyApplied,
        });
    }, [
        get,
        getAvailableYears,
        loadArchivedExpenses,
        loadArchivedTasks,
        loadEntriesForYear,
        store,
    ]);

    const finalizeInvoice = useCallback(async (
        desiredInvoice: Invoice,
        application: InvoiceFinalizationApplicationPlan,
        finalizedAt: number,
    ) => {
        return store.commitInvoiceFinalization({
            operationId: generateId(),
            desiredInvoice,
            application,
            createdAt: finalizedAt,
        });
    }, [store]);

    // Get total amounts
    const totals = useMemo(() => {
        const outstanding = filteredInvoices
            .filter((invoice) => !isInvoicePaid(invoice) && !isInvoiceCanceled(invoice))
            .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
            
        const paid = filteredInvoices
            .filter((invoice) => isInvoicePaid(invoice))
            .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
            
        return { outstanding, paid, total: outstanding + paid };
    }, [filteredInvoices]);

    return {
        // Data
        invoices: filteredInvoices,
        draftInvoices,
        sentInvoices,
        paidInvoices,
        overdueInvoices,
        canceledInvoices,
        isLoading: activeLoading || archivedLoading || Boolean(options.includeArchived && !archivedLoaded),
        archivedLoaded,
        totals,
        
        // CRUD
        getInvoice: get,
        createInvoice: create,
        updateInvoice,
        deleteInvoice,
        finalizeInvoice,
        cancelInvoice,
        undoLatestInvoice,

        // Status helpers
        markAsSent,
        markAsPaid,
        updatePaymentDetails,
        markAsUnpaid,
        canUndoInvoice,
        getInvoiceUndoBlockReason,
        getInvoiceCancellationBlockReason,
    };
}
