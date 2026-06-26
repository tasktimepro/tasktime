/**
 * useInvoices - React hook for invoices collection
 * 
 * Handles active invoices and on-demand loading of archived invoices
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useYjsCollection } from './useYjsCollection';
import type { Expense, Invoice, InvoiceTemplate, Task, TimeEntry } from '@/stores/yjs/types';
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
    isInvoicePaid,
    resolveCurrentInvoiceTemplate,
} from '@/utils/invoiceUtils';
import { buildMarkInvoicePaidUpdates, buildMarkInvoiceUnpaidUpdates } from '@/domain/invoices/invoicePayment';
import { planInvoiceUndo } from '@/domain/invoices/invoiceUndo';
import {
    buildClearedBilledTimeEntryUpdates,
    buildInvoiceTemplateSequenceRollbackUpdates,
    buildProjectInvoiceUnlinkUpdates,
    buildReleasedQuotedTaskUpdates,
    buildRestoredTaskBillingCutoffUpdates,
    buildUnbilledExpenseUpdates,
} from '@/domain/invoices/invoiceUndoApplication';

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

    const getPreferredCurrency = useCallback(() => {
        const storedPreference = store.preferences?.get('currency');
        return normalizeCurrencyCode(typeof storedPreference === 'string' ? storedPreference : undefined);
    }, [store]);

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
        return update(id, {
            status: 'sent',
            paidAt: null,
            paymentCurrencySnapshot: undefined,
        });
    }, [update]);

    const markAsPaid = useCallback(async (id: string, options: MarkInvoicePaidOptions = {}) => {
        const invoice = get(id);
        if (!invoice) {
            return undefined;
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
        const yearEntryMaps = new Map<number, any>();

        await Promise.all(availableYears.map(async (year) => {
            const yearMap = await loadEntriesForYear(year);
            yearEntryMaps.set(year, yearMap);
        }));

        const undoTimestamp = Date.now();
        const loadedEntries = store.getAllTimeEntries();
        const taskMaps = [store.tasks, store.archivedTasks].filter(Boolean);
        const allExpenseMaps = [store.expenses, store.archivedExpenses].filter(Boolean);
        const undoPlan = planInvoiceUndo({
            invoice: invoice as Invoice,
            invoiceId: id,
            entries: loadedEntries,
            tasks: taskMaps.flatMap((taskMap) => collectEntities<Task>(taskMap as any)),
            expenses: allExpenseMaps.flatMap((expenseMap) => collectEntities<Expense>(expenseMap as any)),
        });
        const entriesByMap = new Map<any, { toDelete: TimeEntry[]; toClear: TimeEntry[] }>();
        const queueEntryMutation = (entryMap: any, action: 'delete' | 'clear', entry: TimeEntry) => {
            if (!entryMap) {
                return;
            }

            const existing = entriesByMap.get(entryMap) || { toDelete: [], toClear: [] };

            if (action === 'delete') {
                existing.toDelete.push(entry);
            } else {
                existing.toClear.push(entry);
            }

            entriesByMap.set(entryMap, existing);
        };

        undoPlan.entriesToDelete.forEach((entry) => {
            const entryMap = store.activeTimeEntries.has(entry.id)
                ? store.activeTimeEntries
                : yearEntryMaps.get(new Date(entry.start).getFullYear());

            queueEntryMutation(entryMap, 'delete', entry);
        });

        undoPlan.entriesToClear.forEach((entry) => {
            const entryMap = store.activeTimeEntries.has(entry.id)
                ? store.activeTimeEntries
                : yearEntryMaps.get(new Date(entry.start).getFullYear());

            queueEntryMutation(entryMap, 'clear', entry);
        });

        entriesByMap.forEach((mutation, entryMap) => {
            const parentDoc = entryMap?.doc;

            const applyChanges = () => {
                mutation.toDelete.forEach((entry) => {
                    entryMap.delete(entry.id);
                });

                mutation.toClear.forEach((entry) => {
                    updateEntityFields(entryMap as any, entry.id, buildClearedBilledTimeEntryUpdates({
                        updatedAt: undoTimestamp,
                    }));
                });
            };

            if (parentDoc?.transact) {
                parentDoc.transact(applyChanges);
                return;
            }

            applyChanges();
        });

        const expenseIdsToUnbill = new Set(undoPlan.expenseIdsToUnbill);
        let unbilledExpenseCount = 0;

        allExpenseMaps.forEach((expenseMap) => {
            const parentDoc = (expenseMap as any)?.doc;

            const applyChanges = () => {
                (expenseMap as any).forEach((value: unknown, expenseId: string) => {
                    const expense = readEntity<any>(value);

                    if (!expense || !expenseIdsToUnbill.has(expenseId)) {
                        return;
                    }

                    updateEntityFields(expenseMap as any, expenseId, buildUnbilledExpenseUpdates({
                        updatedAt: undoTimestamp,
                    }));
                    unbilledExpenseCount += 1;
                });
            };

            if (parentDoc?.transact) {
                parentDoc.transact(applyChanges);
                return;
            }

            applyChanges();
        });

        releaseQuotedAmountsForInvoice(id);

        taskMaps.forEach((taskMap) => {
            const parentDoc = (taskMap as any)?.doc;

            const applyChanges = () => {
                undoPlan.taskLastBilledAtRestorations.forEach((restoredCutoff, taskId) => {
                    if (!(taskMap as any).has(taskId)) {
                        return;
                    }

                    updateEntityFields(taskMap as any, taskId, buildRestoredTaskBillingCutoffUpdates({
                        restoredCutoff,
                        updatedAt: undoTimestamp,
                    }));
                });
            };

            if (parentDoc?.transact) {
                parentDoc.transact(applyChanges);
                return;
            }

            applyChanges();
        });

        const template = resolveCurrentInvoiceTemplate(invoice, collectEntities(store.invoiceTemplates as any));
        const sequenceRollback = getInvoiceSequenceRollback(invoice, template, allInvoices);

        store.coreDoc.transact(() => {
            store.projects.forEach((value: unknown, projectId: string) => {
                const project = readEntity<any>(value);
                const updates = project
                    ? buildProjectInvoiceUnlinkUpdates({
                        project,
                        invoiceId: id,
                        updatedAt: undoTimestamp,
                    })
                    : null;

                if (!updates) {
                    return;
                }

                updateEntityFields(store.projects as any, projectId, updates);
            });

            if (sequenceRollback.canRollback && template?.id) {
                updateEntityFields(store.invoiceTemplates as any, template.id, buildInvoiceTemplateSequenceRollbackUpdates({
                    currentSequentialNumber: sequenceRollback.nextSequentialNumber,
                    updatedAt: undoTimestamp,
                }) as Partial<InvoiceTemplate>);
            }
        });

        const removed = store.invoices.has(id);

        if (removed) {
            store.invoices.delete(id);
        }

        if (!removed) {
            throw new Error('Invoice could not be removed.');
        }

        return {
            invoiceNumber: invoice?.invoiceNumber || id,
            clearedTimeEntryCount: undoPlan.clearedTimeEntryCount,
            deletedAdjustmentCount: undoPlan.deletedAdjustmentCount,
            unbilledExpenseCount,
            rewoundSequence: sequenceRollback.canRollback,
        };
    }, [
        allInvoices,
        get,
        getAvailableYears,
        loadArchivedExpenses,
        loadArchivedTasks,
        loadEntriesForYear,
        releaseQuotedAmountsForInvoice,
        store,
    ]);

    // Get total amounts
    const totals = useMemo(() => {
        const outstanding = filteredInvoices
            .filter((invoice) => !isInvoicePaid(invoice))
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
        isLoading: activeLoading || archivedLoading,
        archivedLoaded,
        totals,
        
        // CRUD
        getInvoice: get,
        createInvoice: create,
        updateInvoice: update,
        deleteInvoice,
        undoLatestInvoice,

        // Status helpers
        markAsSent,
        markAsPaid,
        updatePaymentDetails,
        markAsUnpaid,
        canUndoInvoice,
        getInvoiceUndoBlockReason,
    };
}
