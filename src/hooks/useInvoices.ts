/**
 * useInvoices - React hook for invoices collection
 * 
 * Handles active invoices and on-demand loading of archived invoices
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useYjsCollection } from './useYjsCollection';
import type { Invoice } from '@/stores/yjs/types';

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
        useYjsCollection<Invoice>((store) => store.invoices);

    // Archived invoices state
    const [archivedInvoices, setArchivedInvoices] = useState<Invoice[]>([]);
    const [archivedLoading, setArchivedLoading] = useState(false);
    const [archivedLoaded, setArchivedLoaded] = useState(false);

    // Load archived invoices when requested
    useEffect(() => {
        if (!options.includeArchived || !isReady || archivedLoaded || archivedLoading) return;

        let mounted = true;
        setArchivedLoading(true);

        loadArchived()
            .then(() => {
                if (!mounted) return;
                const archivedMap = store.archivedInvoicesSync;
                if (archivedMap) {
                    const invoices: Invoice[] = [];
                    archivedMap.forEach((invoice) => invoices.push(invoice));
                    setArchivedInvoices(invoices);
                }
                setArchivedLoaded(true);
            })
            .finally(() => {
                if (mounted) setArchivedLoading(false);
            });

        return () => { mounted = false; };
    }, [options.includeArchived, isReady, archivedLoaded, archivedLoading, loadArchived, store]);

    // Subscribe to archived invoices changes
    useEffect(() => {
        if (!archivedLoaded || !store.archivedInvoicesSync) return;

        const handler = () => {
            const archivedMap = store.archivedInvoicesSync;
            if (archivedMap) {
                const invoices: Invoice[] = [];
                archivedMap.forEach((invoice) => invoices.push(invoice));
                setArchivedInvoices(invoices);
            }
        };

        store.archivedInvoicesSync.observe(handler);
        return () => store.archivedInvoicesSync?.unobserve(handler);
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
        () => filteredInvoices.filter(i => i.status === 'draft'),
        [filteredInvoices]
    );

    const sentInvoices = useMemo(
        () => filteredInvoices.filter(i => i.status === 'sent'),
        [filteredInvoices]
    );

    const paidInvoices = useMemo(
        () => filteredInvoices.filter(i => i.status === 'paid'),
        [filteredInvoices]
    );

    const overdueInvoices = useMemo(
        () => filteredInvoices.filter(i => i.status === 'overdue'),
        [filteredInvoices]
    );

    // Status update helpers
    const markAsSent = useCallback((id: string) => {
        return update(id, { status: 'sent' });
    }, [update]);

    const markAsPaid = useCallback((id: string) => {
        return update(id, { 
            status: 'paid', 
            paidAt: Date.now() 
        });
    }, [update]);

    // Get total amounts
    const totals = useMemo(() => {
        const outstanding = filteredInvoices
            .filter(i => i.status !== 'paid')
            .reduce((sum, i) => sum + i.total, 0);
            
        const paid = filteredInvoices
            .filter(i => i.status === 'paid')
            .reduce((sum, i) => sum + i.total, 0);
            
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
    };
}
