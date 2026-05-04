/**
 * useInvoices - React hook for invoices collection
 * 
 * Handles active invoices and on-demand loading of archived invoices
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useYjsCollection } from './useYjsCollection';
import type { Invoice } from '@/stores/yjs/types';
import { collectEntities } from '@/stores/yjs/entityUtils';
import { fetchExchangeRates, normalizeCurrencyCode } from '@/utils/currencyUtils';
import {
    createInvoicePaymentCurrencySnapshot,
    getInvoiceStatus,
    getInvoiceStatusAfterMarkingUnpaid,
    getInvoiceTotal,
    isInvoicePaid,
} from '@/utils/invoiceUtils';

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

export function useInvoices(options: UseInvoicesOptions = {}) {
    const { store, isReady, loadArchivedInvoices: loadArchived } = useYjs();
    
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
            result = result.filter(i => i.projectId === options.projectId);
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

    // Status update helpers
    const markAsSent = useCallback((id: string) => {
        return update(id, {
            status: 'sent',
            paidAt: null,
            paymentCurrencySnapshot: undefined,
        });
    }, [update]);

    const markAsPaid = useCallback(async (id: string) => {
        const invoice = get(id);
        if (!invoice) {
            return undefined;
        }

        const paidAt = Date.now();
        const preferredCurrency = getPreferredCurrency();
        const requiresSnapshot = shouldStoreInvoicePaymentSnapshot(invoice, preferredCurrency);
        let rates: Record<string, number> | null = null;
        let error: string | null = null;

        if (requiresSnapshot) {
            ({ rates, error } = await fetchExchangeRates());

            if (!rates) {
                throw new Error(error || 'Unable to load exchange rates for payment snapshot.');
            }
        }

        return update(id, {
            status: 'paid',
            paidAt,
            paymentCurrencySnapshot: createInvoicePaymentCurrencySnapshot({
                invoice,
                preferredCurrency,
                exchangeRates: rates,
                capturedAt: paidAt,
            }) ?? undefined,
        });
    }, [get, getPreferredCurrency, update]);

    const markAsUnpaid = useCallback((id: string) => {
        const invoice = get(id);
        if (!invoice) {
            return undefined;
        }

        return update(id, {
            status: getInvoiceStatusAfterMarkingUnpaid(invoice),
            paidAt: null,
            paymentCurrencySnapshot: undefined,
        });
    }, [get, update]);

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
        deleteInvoice: remove,
        
        // Status helpers
        markAsSent,
        markAsPaid,
        markAsUnpaid,
    };
}
