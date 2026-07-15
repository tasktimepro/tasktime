import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { DocumentTextIcon, PencilIcon, ArrowDownTrayIcon, EyeIcon, CheckIcon, PlusIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Notice } from '@/components/ui/notice';
import { Send, Bell, MoreHorizontal, RotateCcw, Ban } from 'lucide-react';
import { generatePDF, getCurrentInvoiceHtmlContent } from '../utils/pdfUtils.ts';
import { getCurrencySymbol, normalizeCurrencyCode } from '../utils/currencyUtils.ts';
import { toDisplayDate } from '../utils/dateUtils.ts';
import { useUrlState } from '../hooks/useUrlState.ts';
import { useBusinessBrandAssets } from '../hooks/useBusinessBrandAssets.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import { useToast } from '../hooks/useToast.ts';
import {
    getInvoiceProjectTitle,
    getInvoicePaymentCurrencySnapshot,
    getInvoiceSequenceRollback,
    getInvoiceStatus,
    getInvoiceStatusAfterMarkingUnpaid,
    getInvoiceTotal,
    isInvoiceOverdue,
    isInvoicePaid,
    isInvoiceCanceled,
    isInvoiceOutstanding,
    matchesInvoiceStatusFilter,
    resolveCurrentInvoiceTemplate,
} from '../utils/invoiceUtils.ts';
import { INVOICE_CANCELLATION_REASON_MAX_LENGTH } from '../domain/invoices/invoiceCancellation.ts';
import Pagination from './Pagination';
import Modal from './Modal';
import InvoicePreviewModal from './invoice/InvoicePreviewModal';
import InvoicePaymentDetailsModal from './invoice/InvoicePaymentDetailsModal';
import EmailPreviewModal from './invoice/EmailPreviewModal';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { usePreferences } from '../hooks/usePreferences.ts';
import { cn } from '@/lib/utils';

/**
 * Resolve the list bucket a paid invoice will enter after its payment is corrected.
 */
const getInvoiceTabAfterMarkingUnpaid = (invoice) => {
    const unpaidInvoice = {
        ...invoice,
        status: getInvoiceStatusAfterMarkingUnpaid(invoice),
        paidAt: null,
        paymentCurrencySnapshot: undefined,
    };

    return getInvoiceStatus(unpaidInvoice) === 'overdue' ? 'overdue' : 'outstanding';
};

/**
 * InvoicesList component - Displays saved invoices with edit, download, and preview options
 * Uses Yjs hooks for invoice updates
 */
const InvoicesList = ({ 
    projectInvoices = [], 
    onEditInvoice, 
    paymentMethods = [], 
    businessInfos = [], 
    clients = [],
    hideNewInvoiceButton = false,
    invoiceTemplates = [],
    selectedTab = null // New prop to preselect a tab
}) => {
    const isMobileLayout = useIsMobileLayout();
    const { showSuccess, showError } = useToast();
    const { businessBrandAssets } = useBusinessBrandAssets();
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [pendingPaidEditInvoice, setPendingPaidEditInvoice] = useState(null);
    const [pendingPaymentInvoice, setPendingPaymentInvoice] = useState(null);
    const [paymentDetailsMode, setPaymentDetailsMode] = useState('mark-paid');
    const [isSavingPaymentDetails, setIsSavingPaymentDetails] = useState(false);
    const [pendingUnpaidInvoice, setPendingUnpaidInvoice] = useState(null);
    const [isMarkingInvoiceUnpaid, setIsMarkingInvoiceUnpaid] = useState(false);
    const [emailInvoice, setEmailInvoice] = useState(null);
    const [emailSendType, setEmailSendType] = useState('invoice');
    const [pendingUndoInvoice, setPendingUndoInvoice] = useState(null);
    const [undoConfirmationText, setUndoConfirmationText] = useState('');
    const [isUndoingInvoice, setIsUndoingInvoice] = useState(false);
    const [pendingCancellationInvoice, setPendingCancellationInvoice] = useState(null);
    const [cancellationReason, setCancellationReason] = useState('');
    const [cancellationConfirmationText, setCancellationConfirmationText] = useState('');
    const [isCancelingInvoice, setIsCancelingInvoice] = useState(false);
    const { updateUrl } = useUrlState();
    
    // Yjs hook for invoice updates
    const {
        invoices: allActiveInvoices,
        markAsPaid,
        updatePaymentDetails,
        markAsUnpaid,
        undoLatestInvoice,
        canUndoInvoice,
        cancelInvoice,
        getInvoiceCancellationBlockReason,
    } = useInvoices();
    const { preferences } = usePreferences();
    const preferredCurrency = normalizeCurrencyCode(preferences.currency);

    // Filter out soft-deleted invoices (projectInvoices already filtered by parent)
    const activeInvoices = useMemo(() => projectInvoices, [projectInvoices]);

    // Keep tabs mutually exclusive: overdue invoices are not also listed as outstanding.
    const outstandingInvoices = useMemo(() =>
        activeInvoices.filter((invoice) => (
            matchesInvoiceStatusFilter(invoice, 'outstanding')
            || matchesInvoiceStatusFilter(invoice, 'draft')
        )),
    [activeInvoices]);

    const paidInvoices = useMemo(() =>
        activeInvoices.filter((invoice) => matchesInvoiceStatusFilter(invoice, 'paid')),
    [activeInvoices]);

    // Overdue invoices are shown in their own bucket.
    const overdueInvoices = useMemo(() =>
        activeInvoices.filter((invoice) => matchesInvoiceStatusFilter(invoice, 'overdue')),
    [activeInvoices]);

    const canceledInvoices = useMemo(() =>
        activeInvoices.filter((invoice) => matchesInvoiceStatusFilter(invoice, 'canceled')),
    [activeInvoices]);
    
    // Default to first non-empty tab (overdue -> outstanding -> paid), with optional override via selectedTab
    const defaultTab = useMemo(() => {
        const validTabs = ['overdue', 'outstanding', 'paid', 'canceled'];
        if (selectedTab && validTabs.includes(selectedTab)) {
            if (selectedTab !== 'overdue' || overdueInvoices.length > 0) {
                return selectedTab;
            }
        }

        if (overdueInvoices.length > 0) return 'overdue';
        if (outstandingInvoices.length > 0) return 'outstanding';
        return 'paid';
    }, [selectedTab, overdueInvoices.length, outstandingInvoices.length]);
    
    const [activeTab, setActiveTab] = useState(defaultTab);
    
    // Update active tab when default tab changes (e.g., when overdue invoices appear/disappear)
    const prevDefaultTab = useRef(defaultTab);
    useEffect(() => {
        if (prevDefaultTab.current !== defaultTab && activeTab === prevDefaultTab.current) {
            setActiveTab(defaultTab);
        }
        prevDefaultTab.current = defaultTab;
    }, [defaultTab, activeTab]);
    const [outstandingPage, setOutstandingPage] = useState(1);
    const [paidPage, setPaidPage] = useState(1);
    const [overduePage, setOverduePage] = useState(1);
    const [canceledPage, setCanceledPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    // Calculate paginated invoices for each tab
    const paginatedOutstandingInvoices = useMemo(() => {
        const startIndex = (outstandingPage - 1) * ITEMS_PER_PAGE;
        return outstandingInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [outstandingInvoices, outstandingPage]);

    const paginatedPaidInvoices = useMemo(() => {
        const startIndex = (paidPage - 1) * ITEMS_PER_PAGE;
        return paidInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [paidInvoices, paidPage]);

    const paginatedOverdueInvoices = useMemo(() => {
        const startIndex = (overduePage - 1) * ITEMS_PER_PAGE;
        return overdueInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [overdueInvoices, overduePage]);

    const paginatedCanceledInvoices = useMemo(() => {
        const startIndex = (canceledPage - 1) * ITEMS_PER_PAGE;
        return canceledInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [canceledInvoices, canceledPage]);

    // Calculate total pages for each tab
    const outstandingTotalPages = useMemo(() => 
        Math.ceil(outstandingInvoices.length / ITEMS_PER_PAGE) || 1,
    [outstandingInvoices.length]);

    const paidTotalPages = useMemo(() => 
        Math.ceil(paidInvoices.length / ITEMS_PER_PAGE) || 1,
    [paidInvoices.length]);

    const overdueTotalPages = useMemo(() => 
        Math.ceil(overdueInvoices.length / ITEMS_PER_PAGE) || 1,
    [overdueInvoices.length]);

    const canceledTotalPages = useMemo(() =>
        Math.ceil(canceledInvoices.length / ITEMS_PER_PAGE) || 1,
    [canceledInvoices.length]);
    
    // Handle page change for outstanding invoices
    const handleOutstandingPageChange = (pageNumber) => {
        setOutstandingPage(pageNumber);
        // Scroll to top of the invoice list
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle page change for paid invoices
    const handlePaidPageChange = (pageNumber) => {
        setPaidPage(pageNumber);
        // Scroll to top of the invoice list
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle page change for overdue invoices
    const handleOverduePageChange = (pageNumber) => {
        setOverduePage(pageNumber);
        // Scroll to top of the invoice list
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCanceledPageChange = (pageNumber) => {
        setCanceledPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle tab change
    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab);
        // Update URL to reflect the selected tab, preserving other parameters
        const currentParams = new URLSearchParams(window.location.search);
        const section = currentParams.get('section');
        updateUrl({ 
            tab,
            section: section || 'invoices' // Preserve the current section
        });
    }, [updateUrl]);

    /**
     * Handle invoice download
     */
    const handleDownload = async (invoice) => {
        try {
            const htmlContent = getCurrentInvoiceHtmlContent(invoice, clients, businessBrandAssets);
            
            const filename = `invoice-${invoice.invoiceNumber}.pdf`;
            
            await generatePDF(htmlContent, filename);
        } catch (error) {
            console.error('Error downloading invoice:', error);
            showError('Failed to generate PDF: ' + error.message);
        }
    };

    /**
     * Handle invoice preview
     */
    const handlePreview = (invoice) => {
        setSelectedInvoice(invoice);
        setShowPreview(true);
    };

    /**
     * Open email preview modal for sending an invoice or reminder
     */
    const handleOpenEmailModal = useCallback((invoice, sendType = 'invoice') => {
        setEmailInvoice(invoice);
        setEmailSendType(sendType);
    }, []);

    const handleCloseEmailModal = useCallback(() => {
        setEmailInvoice(null);
    }, []);

    const handleOpenUndoModal = useCallback((invoice) => {
        setPendingUndoInvoice(invoice);
        setUndoConfirmationText('');
    }, []);

    const handleCloseUndoModal = useCallback(() => {
        if (isUndoingInvoice) {
            return;
        }

        setPendingUndoInvoice(null);
        setUndoConfirmationText('');
    }, [isUndoingInvoice]);

    const handleConfirmUndoInvoice = useCallback(async () => {
        if (!pendingUndoInvoice) {
            return;
        }

        const invoiceToUndo = pendingUndoInvoice;
        const expectedConfirmation = invoiceToUndo.invoiceNumber || '';
        if (undoConfirmationText.trim() !== expectedConfirmation) {
            showError(`Type ${expectedConfirmation} to confirm.`);
            return;
        }

        setIsUndoingInvoice(true);
        setPendingUndoInvoice(null);
        setUndoConfirmationText('');

        try {
            const result = await undoLatestInvoice(invoiceToUndo.id);

            if (selectedInvoice?.id === invoiceToUndo.id) {
                setShowPreview(false);
                setSelectedInvoice(null);
            }

            if (emailInvoice?.id === invoiceToUndo.id) {
                setEmailInvoice(null);
            }

            const sequenceMessage = result?.rewoundSequence
                ? ' Next invoice number was restored.'
                : '';

            showSuccess(
                `Invoice ${result?.invoiceNumber || invoiceToUndo.invoiceNumber} undone. ${result?.clearedTimeEntryCount || 0} billed entr${result?.clearedTimeEntryCount === 1 ? 'y' : 'ies'} restored, ${result?.deletedAdjustmentCount || 0} invoice adjustment${result?.deletedAdjustmentCount === 1 ? '' : 's'} removed, and ${result?.unbilledExpenseCount || 0} expense${result?.unbilledExpenseCount === 1 ? '' : 's'} unbilled.${sequenceMessage}`
            );
        } catch (error) {
            showError(error.message || 'Unable to undo this invoice.');
        } finally {
            setIsUndoingInvoice(false);
        }
    }, [emailInvoice, pendingUndoInvoice, selectedInvoice, showError, showSuccess, undoConfirmationText, undoLatestInvoice]);

    const handleOpenCancellationModal = useCallback((invoice) => {
        const blockReason = getInvoiceCancellationBlockReason(invoice);

        if (blockReason) {
            showError(blockReason);
            return;
        }

        setPendingCancellationInvoice(invoice);
        setCancellationReason('');
        setCancellationConfirmationText('');
    }, [getInvoiceCancellationBlockReason, showError]);

    const handleCloseCancellationModal = useCallback(() => {
        if (isCancelingInvoice) {
            return;
        }

        setPendingCancellationInvoice(null);
        setCancellationReason('');
        setCancellationConfirmationText('');
    }, [isCancelingInvoice]);

    const handleConfirmCancellation = useCallback(async () => {
        if (!pendingCancellationInvoice || isCancelingInvoice) {
            return;
        }

        const normalizedReason = cancellationReason.trim();
        const expectedConfirmation = pendingCancellationInvoice.invoiceNumber || '';
        const inputsAreValid = normalizedReason.length > 0
            && normalizedReason.length <= INVOICE_CANCELLATION_REASON_MAX_LENGTH
            && cancellationConfirmationText === expectedConfirmation;

        if (!inputsAreValid) {
            showError('Enter a cancellation reason and type the exact invoice number to confirm.');
            return;
        }

        setIsCancelingInvoice(true);

        try {
            const invoiceToCancel = pendingCancellationInvoice;
            const result = await cancelInvoice(invoiceToCancel.id, { reason: normalizedReason });
            const canceledInvoice = result?.invoice || {
                ...invoiceToCancel,
                status: 'canceled',
                cancellationReason: normalizedReason,
            };

            if (selectedInvoice?.id === invoiceToCancel.id) {
                setSelectedInvoice(canceledInvoice);
            }

            if (emailInvoice?.id === invoiceToCancel.id) {
                setEmailInvoice(null);
            }

            if (pendingPaymentInvoice?.id === invoiceToCancel.id) {
                setPendingPaymentInvoice(null);
            }

            if (pendingPaidEditInvoice?.id === invoiceToCancel.id) {
                setPendingPaidEditInvoice(null);
            }

            setPendingCancellationInvoice(null);
            setCancellationReason('');
            setCancellationConfirmationText('');
            handleTabChange('canceled');

            showSuccess(
                `Invoice ${canceledInvoice.invoiceNumber || invoiceToCancel.invoiceNumber} canceled. ${result?.releasedTimeEntryCount || 0} billed entr${result?.releasedTimeEntryCount === 1 ? 'y' : 'ies'} restored, ${result?.deletedAdjustmentCount || 0} invoice adjustment${result?.deletedAdjustmentCount === 1 ? '' : 's'} removed, ${result?.releasedExpenseCount || 0} expense${result?.releasedExpenseCount === 1 ? '' : 's'} unbilled, and ${result?.releasedQuotedTaskCount || 0} quoted task${result?.releasedQuotedTaskCount === 1 ? '' : 's'} released. Invoice number retained.`
            );
        } catch (error) {
            showError(error.message || 'Unable to cancel this invoice.');
        } finally {
            setIsCancelingInvoice(false);
        }
    }, [cancelInvoice, cancellationConfirmationText, cancellationReason, emailInvoice, handleTabChange, isCancelingInvoice, pendingCancellationInvoice, pendingPaidEditInvoice, pendingPaymentInvoice, selectedInvoice, showError, showSuccess]);

    /**
     * Handle invoice edit
     */
    const handleEdit = (invoice) => {
        if (onEditInvoice) {
            if (getInvoiceStatus(invoice) !== 'draft') {
                showError('Finalized invoices cannot be edited directly. Undo the latest invoice first, then create a corrected invoice.');
                return;
            }

            onEditInvoice(invoice);
        } else {
            alert('Edit functionality requires integration with the parent component.');
        }
    };

    const closePaidEditWarning = () => {

        setPendingPaidEditInvoice(null);
    };

    const confirmPaidEdit = () => {

        if (!pendingPaidEditInvoice || !onEditInvoice) {

            setPendingPaidEditInvoice(null);
            return;
        }

        onEditInvoice(pendingPaidEditInvoice);
        setPendingPaidEditInvoice(null);
    };

    const invoiceNeedsPaymentDetails = useCallback((invoice) => {
        const snapshot = getInvoicePaymentCurrencySnapshot(invoice);
        if (snapshot) {
            return true;
        }

        if (getInvoiceTotal(invoice) <= 0) {
            return false;
        }

        const invoiceCurrency = normalizeCurrencyCode(invoice?.currency || preferredCurrency);
        return invoiceCurrency !== preferredCurrency;
    }, [preferredCurrency]);

    const openPaymentDetailsModal = useCallback((invoice, mode) => {
        setPendingPaymentInvoice(invoice);
        setPaymentDetailsMode(mode);
    }, []);

    const closePaymentDetailsModal = useCallback(() => {
        if (isSavingPaymentDetails) {
            return;
        }

        setPendingPaymentInvoice(null);
    }, [isSavingPaymentDetails]);

    const handleAfterMarkPaid = useCallback((invoice) => {
        if (!isInvoicePaid(invoice) && (activeTab === 'outstanding' || activeTab === 'overdue')) {
            let remainingInvoices;
            let setPage;

            if (activeTab === 'overdue') {
                remainingInvoices = overdueInvoices.filter(inv => inv.id !== invoice.id);
                setPage = setOverduePage;
                if (remainingInvoices.length === 0) {
                    setActiveTab(outstandingInvoices.length > 0 ? 'outstanding' : 'paid');
                    return;
                }
            } else {
                remainingInvoices = outstandingInvoices.filter(inv => inv.id !== invoice.id);
                setPage = setOutstandingPage;
            }

            const newTotalPages = Math.ceil(remainingInvoices.length / ITEMS_PER_PAGE) || 1;
            const currentPageForTab = activeTab === 'overdue' ? overduePage : outstandingPage;

            if (currentPageForTab > newTotalPages) {
                setPage(Math.max(1, newTotalPages));
            }
        }
    }, [activeTab, outstandingInvoices, overdueInvoices, overduePage, outstandingPage]);

    const handleSubmitPaymentDetails = useCallback(async ({ paymentCurrencySnapshot }) => {
        if (!pendingPaymentInvoice) {
            return;
        }

        setIsSavingPaymentDetails(true);

        try {
            if (paymentDetailsMode === 'mark-paid') {
                await markAsPaid(pendingPaymentInvoice.id, {
                    paidAt: paymentCurrencySnapshot?.capturedAt,
                    paymentCurrencySnapshot,
                });
                handleAfterMarkPaid(pendingPaymentInvoice);
            } else {
                await updatePaymentDetails?.(pendingPaymentInvoice.id, { paymentCurrencySnapshot });
                showSuccess('Payment details updated');
            }

            setPendingPaymentInvoice(null);
        } catch (error) {
            showError(error.message || 'Unable to save invoice payment details.');
        } finally {
            setIsSavingPaymentDetails(false);
        }
    }, [handleAfterMarkPaid, markAsPaid, paymentDetailsMode, pendingPaymentInvoice, showError, showSuccess, updatePaymentDetails]);

    const handleOpenMarkUnpaidModal = useCallback((invoice) => {
        if (!isInvoicePaid(invoice) || isInvoiceCanceled(invoice)) {
            showError('Only paid invoices can be marked as unpaid.');
            return;
        }

        setPendingUnpaidInvoice(invoice);
    }, [showError]);

    const handleCloseMarkUnpaidModal = useCallback(() => {
        if (isMarkingInvoiceUnpaid) {
            return;
        }

        setPendingUnpaidInvoice(null);
    }, [isMarkingInvoiceUnpaid]);

    const handleConfirmMarkUnpaid = useCallback(async () => {
        if (!pendingUnpaidInvoice || isMarkingInvoiceUnpaid) {
            return;
        }

        const invoiceToUpdate = pendingUnpaidInvoice;
        setIsMarkingInvoiceUnpaid(true);

        try {
            const updatedInvoice = await markAsUnpaid(invoiceToUpdate.id);

            if (!updatedInvoice) {
                throw new Error('Invoice could not be found. Refresh the list and try again.');
            }

            const nextTab = getInvoiceTabAfterMarkingUnpaid(invoiceToUpdate);
            setPendingUnpaidInvoice(null);
            handleTabChange(nextTab);
            showSuccess(
                `Invoice ${invoiceToUpdate.invoiceNumber} marked as unpaid. Recorded payment details were cleared.`
            );
        } catch (error) {
            showError(error.message || 'Unable to mark this invoice as unpaid.');
        } finally {
            setIsMarkingInvoiceUnpaid(false);
        }
    }, [handleTabChange, isMarkingInvoiceUnpaid, markAsUnpaid, pendingUnpaidInvoice, showError, showSuccess]);

    /**
     * Mark an unpaid finalized invoice as paid.
     */
    const handleMarkPaid = async (invoice) => {
        if (isInvoiceCanceled(invoice)) {
            showError('Canceled invoices are read-only historical records.');
            return;
        }

        try {
            if (invoiceNeedsPaymentDetails(invoice)) {
                openPaymentDetailsModal(invoice, 'mark-paid');
                return;
            }

            await markAsPaid(invoice.id);
            handleAfterMarkPaid(invoice);
        } catch (error) {
            showError(error.message || 'Unable to update invoice payment status.');
        }
    };

    // Render empty state for a tab
    const renderEmptyState = (tabType) => (
        <div className="text-center py-8">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-sm font-medium text-foreground">
                {tabType === 'outstanding' ? 'No outstanding invoices' :
                 tabType === 'overdue' ? 'No overdue invoices' :
                 tabType === 'canceled' ? 'No canceled invoices' : 'No paid invoices'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
                {tabType === 'outstanding' 
                    ? 'You have no current invoices awaiting payment.'
                    : tabType === 'overdue'
                    ? 'All your invoices are up to date.'
                    : tabType === 'canceled'
                    ? 'Canceled invoices remain here as read-only historical records.'
                    : 'No invoices have been marked as paid yet.'
                }
            </p>
        </div>
    );

    // Render invoice list for current tab
    const renderInvoiceList = () => {
        let currentInvoices, currentPage, totalPages, handlePageChange, totalInvoices;
        
        if (activeTab === 'overdue') {
            currentInvoices = paginatedOverdueInvoices;
            currentPage = overduePage;
            totalPages = overdueTotalPages;
            handlePageChange = handleOverduePageChange;
            totalInvoices = overdueInvoices.length;
        } else if (activeTab === 'outstanding') {
            currentInvoices = paginatedOutstandingInvoices;
            currentPage = outstandingPage;
            totalPages = outstandingTotalPages;
            handlePageChange = handleOutstandingPageChange;
            totalInvoices = outstandingInvoices.length;
        } else if (activeTab === 'canceled') {
            currentInvoices = paginatedCanceledInvoices;
            currentPage = canceledPage;
            totalPages = canceledTotalPages;
            handlePageChange = handleCanceledPageChange;
            totalInvoices = canceledInvoices.length;
        } else {
            currentInvoices = paginatedPaidInvoices;
            currentPage = paidPage;
            totalPages = paidTotalPages;
            handlePageChange = handlePaidPageChange;
            totalInvoices = paidInvoices.length;
        }

        if (currentInvoices.length === 0) {
            return renderEmptyState(activeTab);
        }

        return (
            <>
                <div className="space-y-4">
                    {currentInvoices.map((invoice) => {
                        const invoiceCurrency = invoice.currency || preferredCurrency;
                        const invoiceTotalValue = getInvoiceTotal(invoice);
                        const invoiceTotal = `${getCurrencySymbol(invoiceCurrency)}${invoiceTotalValue.toFixed(2)}`;
                        const clientForColor = invoice.clientId
                            ? clients.find((client) => client.id === invoice.clientId)
                            : null;
                        const borderColor = invoice.project?.color || clientForColor?.color || null;
                        const invoiceStatus = getInvoiceStatus(invoice);
                        const invoiceIsPaid = isInvoicePaid(invoice);
                        const invoiceIsOverdue = isInvoiceOverdue(invoice);
                        const invoiceIsCanceled = isInvoiceCanceled(invoice);
                        const invoiceCanBeUndone = !invoiceIsCanceled && canUndoInvoice(invoice);
                        const invoiceCanBeCanceled = isInvoiceOutstanding(invoice);
                        const invoiceHasEditablePaymentDetails = invoiceNeedsPaymentDetails(invoice);

                        return (
                            <Card
                                key={invoice.id}
                                className={`hover:shadow-md transition-shadow ${borderColor ? 'border-l-4' : ''}`}
                                style={borderColor ? { borderLeftColor: borderColor } : undefined}
                            >
                                <CardContent className={cn(isMobileLayout ? 'p-3' : 'p-4')}>
                                    <div className="flex flex-col space-y-4">
                                    {/* Header row with invoice number and status tag */}
                                    <div className={cn('flex justify-between gap-3', isMobileLayout ? 'flex-col items-start' : 'items-center')}>
                                        <div className="flex items-center space-x-3 min-w-0">
                                            <DocumentTextIcon className="h-6 w-6 text-muted-foreground" />
                                            <h3 className="text-sm font-medium text-foreground truncate">
                                                {invoice.invoiceNumber}
                                            </h3>
                                        </div>
                                        <div className={cn('flex flex-wrap gap-2', isMobileLayout && 'w-full')}>
                                            {invoiceIsCanceled ? null : invoiceIsPaid ? (
                                                <Badge variant="success">
                                                    <CheckIcon className="h-3 w-3 mr-1" />
                                                    Paid <span className="mx-1">•</span>
                                                    <span className="sensitive-data">{invoiceTotal}</span>
                                                </Badge>
                                            ) : invoiceIsOverdue ? (
                                                <Badge variant="error">
                                                    Overdue <span className="mx-1">•</span>
                                                    <span className="sensitive-data">{invoiceTotal}</span>
                                                </Badge>
                                            ) : invoiceStatus === 'draft' ? (
                                                <Badge variant="secondary">
                                                    Draft <span className="mx-1">•</span>
                                                    <span className="sensitive-data">{invoiceTotal}</span>
                                                </Badge>
                                            ) : (
                                                <Badge variant="warning">
                                                    Outstanding <span className="mx-1">•</span>
                                                    <span className="sensitive-data">{invoiceTotal}</span>
                                                </Badge>
                                            )}

                                            {invoice.sentAt && (
                                                <Badge variant="outline" className="text-xs">
                                                    <Send className="h-3 w-3 mr-1" />
                                                    Sent
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                {/* Invoice details with action buttons on the same row */}
                                <div className={cn('justify-between', isMobileLayout ? 'ml-0 space-y-3' : 'ml-9 flex items-end')}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">
                                            {toDisplayDate(invoice.date)}
                                            {invoice.totalHours > 0 && (
                                                <>
                                                    <span className="mx-1">•</span>
                                                    {invoice.totalHours.toFixed(2)} hours
                                                </>
                                            )}
                                            <span className="mx-1">•</span>
                                            <span className="sensitive-data">
                                                {getCurrencySymbol(invoice.currency || preferredCurrency)}{invoiceTotalValue.toFixed(2)}
                                            </span>
                                        </p>
                                        {invoice.dueDate && !invoiceIsPaid && (
                                            <p className={`text-sm mt-1 ${
                                                invoiceIsOverdue 
                                                    ? 'status-danger-text-strong font-medium' 
                                                    : 'text-muted-foreground'
                                            }`}>
                                                Due: {toDisplayDate(invoice.dueDate)}
                                            </p>
                                        )}
                                        {invoiceIsCanceled && (
                                            <Notice
                                                className="mt-2"
                                                compact
                                                title="Cancellation reason"
                                                description={invoice.cancellationReason}
                                            />
                                        )}
                                        <div className="mt-1 text-xs text-muted-foreground break-words">
                                            <p>
                                                Client: <span className="font-medium text-muted-foreground">
                                                    {(() => {
                                                        // Try to get client name from clientId first
                                                        if (invoice.clientId) {
                                                            const client = clients.find(ci => ci.id === invoice.clientId);
                                                            if (client) {
                                                                return client.clientName;
                                                            }
                                                        }
                                                        // Fallback to stored client or manual entry
                                                        return invoice.client?.name || 'Unknown';
                                                    })()}
                                                </span>
                                            </p>
                                            <p>
                                                Project: <span className="font-medium text-muted-foreground">
                                                    {getInvoiceProjectTitle(invoice) || 'Unknown Project'}
                                                </span>
                                            </p>
                                            {invoice.template && (() => {
                                                const template = invoice.template;
                                                const isDeleted = template?.id
                                                    ? !invoiceTemplates.find(t => t.id === template.id)
                                                    : false;
                                                
                                                return (
                                                    <p>
                                                        Template: <span className="font-medium text-muted-foreground">{template.name}</span>
                                                        {isDeleted && (
                                                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium status-danger-surface status-danger-text">
                                                                deleted
                                                            </span>
                                                        )}
                                                    </p>
                                                );
                                            })()}
                                            {invoice.businessInfo && (() => {
                                                const businessInfo = invoice.businessInfo;
                                                const isDeleted = businessInfo?.id
                                                    ? !businessInfos.find(bi => bi.id === businessInfo.id)
                                                    : false;
                                                
                                                return (
                                                    <p>
                                                        Business: <span className="font-medium text-muted-foreground">{businessInfo.title}</span>
                                                        {isDeleted && (
                                                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium status-danger-surface status-danger-text">
                                                                deleted
                                                            </span>
                                                        )}
                                                    </p>
                                                );
                                            })()}
                                            {invoice.paymentMethod && (() => {
                                                const paymentMethod = invoice.paymentMethod;
                                                const isDeleted = paymentMethod?.id
                                                    ? !paymentMethods.find(pm => pm.id === paymentMethod.id)
                                                    : false;
                                                
                                                return (
                                                    <p>
                                                        Payment Method: <span className="font-medium text-muted-foreground">{paymentMethod.title || paymentMethod.name}</span>
                                                        {isDeleted && (
                                                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium status-danger-surface status-danger-text">
                                                                deleted
                                                            </span>
                                                        )}
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Action buttons - right side */}
                                    <div className={cn('flex items-center gap-2', isMobileLayout ? 'w-full flex-wrap justify-end' : 'justify-end')}>
                                        {!invoiceIsPaid && !invoiceIsCanceled && (
                                            <Button
                                                onClick={() => handleMarkPaid(invoice)}
                                                size="sm"
                                                leadingIcon={CheckIcon}
                                            >
                                                Mark as Paid
                                            </Button>
                                        )}

                                        {/* Email actions: Send Invoice or Send Reminder */}
                                        {!invoiceIsPaid && !invoiceIsCanceled && !invoice.sentAt && (
                                            <Button
                                                onClick={() => handleOpenEmailModal(invoice, 'invoice')}
                                                variant="ghost"
                                                size="icon"
                                                title="Send Invoice by Email"
                                            >
                                                <Send className="h-5 w-5" />
                                            </Button>
                                        )}
                                        {!invoiceIsPaid && invoice.sentAt && invoiceIsOverdue && (
                                            <Button
                                                onClick={() => handleOpenEmailModal(invoice, 'reminder')}
                                                variant="ghost"
                                                size="icon"
                                                title="Send Payment Reminder"
                                            >
                                                <Bell className="h-5 w-5" />
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => handlePreview(invoice)}
                                            variant="ghost"
                                            size="icon"
                                            title="Preview Invoice"
                                        >
                                            <EyeIcon className="h-5 w-5" />
                                        </Button>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-md text-muted-foreground transition-colors hover:bg-accent"
                                                    title="More actions"
                                                    aria-label="More actions"
                                                >
                                                    <MoreHorizontal className="h-5 w-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => handleDownload(invoice)}
                                                    className="cursor-pointer hover:bg-accent focus:bg-accent"
                                                >
                                                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                                    <span>Download</span>
                                                </DropdownMenuItem>
                                                {!invoiceIsCanceled && invoiceIsPaid && invoiceHasEditablePaymentDetails && (
                                                    <DropdownMenuItem
                                                        onClick={() => openPaymentDetailsModal(invoice, 'edit-payment')}
                                                        className="cursor-pointer hover:bg-accent focus:bg-accent"
                                                    >
                                                        <CheckIcon className="h-4 w-4 mr-2" />
                                                        <span>Edit payment details</span>
                                                    </DropdownMenuItem>
                                                )}
                                                {!invoiceIsCanceled && invoiceIsPaid && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleOpenMarkUnpaidModal(invoice)}
                                                        className="status-danger-action cursor-pointer"
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-2" />
                                                        <span>Mark as unpaid</span>
                                                    </DropdownMenuItem>
                                                )}
                                                {invoiceStatus === 'draft' && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleEdit(invoice)}
                                                        className="cursor-pointer hover:bg-accent focus:bg-accent"
                                                    >
                                                        <PencilIcon className="h-4 w-4 mr-2" />
                                                        <span>Edit invoice</span>
                                                    </DropdownMenuItem>
                                                )}
                                                {invoiceCanBeUndone && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleOpenUndoModal(invoice)}
                                                        className="status-danger-action cursor-pointer"
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-2" />
                                                        <span>Undo</span>
                                                    </DropdownMenuItem>
                                                )}
                                                {invoiceCanBeCanceled && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleOpenCancellationModal(invoice)}
                                                        className="status-danger-action cursor-pointer"
                                                    >
                                                        <Ban className="h-4 w-4 mr-2" />
                                                        <span>Cancel invoice</span>
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                </div>
                            </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Pagination */}
                {totalInvoices > ITEMS_PER_PAGE && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                    />
                )}
            </>
        );
    };

    // Render the invoice preview modal
    const renderInvoicePreview = () => {
        if (!selectedInvoice) return null;

        // Footer with action buttons for the invoice preview modal
        const previewModalFooter = (
            <div className="flex justify-end space-x-4">
                <Button
                    onClick={() => handleDownload(selectedInvoice)}
                    leadingIcon={ArrowDownTrayIcon}
                >
                    Download PDF
                </Button>
                <Button
                    onClick={() => setShowPreview(false)}
                    variant="secondary"
                >
                    Close
                </Button>
            </div>
        );

        return (
            <InvoicePreviewModal
                isOpen={showPreview && !!selectedInvoice}
                onClose={() => setShowPreview(false)}
                title={selectedInvoice ? `Invoice Preview - ${selectedInvoice.invoiceNumber}` : ''}
                invoice={selectedInvoice}
                htmlContent={selectedInvoice ? getCurrentInvoiceHtmlContent(selectedInvoice, clients, businessBrandAssets) : ''}
                footer={previewModalFooter}
            />
        );
    };

    if (projectInvoices.length === 0) {
        return (
            <EmptyState
                icon={DocumentTextIcon}
                title="No invoices yet"
                description="Get started by generating your first invoice."
                actionLabel={!hideNewInvoiceButton ? "Create First Invoice" : undefined}
                actionIcon={!hideNewInvoiceButton ? PlusIcon : undefined}
                onAction={!hideNewInvoiceButton ? () => onEditInvoice && onEditInvoice(null) : undefined}
            />
        );
    }

    return (
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4 overflow-x-hidden')}>
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className={cn(
                    'w-full bg-transparent rounded-none',
                    isMobileLayout
                        ? 'h-auto flex-wrap justify-start gap-2 border-0 p-0'
                        : 'justify-start border-b border-border p-0'
                )}>
                    {/* Overdue tab - only show when there are overdue invoices */}
                    {overdueInvoices.length > 0 && (
                        <TabsTrigger
                            value="overdue"
                            className={cn(
                                isMobileLayout
                                    ? 'rounded-full border border-border bg-transparent px-3 py-1.5 font-medium text-sm data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none'
                                    : 'px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border'
                            )}
                        >
                            Overdue ({overdueInvoices.length})
                        </TabsTrigger>
                    )}
                    <TabsTrigger
                        value="outstanding"
                        className={cn(
                            isMobileLayout
                                ? 'rounded-full border border-border bg-transparent px-3 py-1.5 font-medium text-sm data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none'
                                : 'px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border'
                        )}
                    >
                        Outstanding ({outstandingInvoices.length})
                    </TabsTrigger>
                    <TabsTrigger
                        value="paid"
                        className={cn(
                            isMobileLayout
                                ? 'rounded-full border border-border bg-transparent px-3 py-1.5 font-medium text-sm data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none'
                                : 'px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border'
                        )}
                    >
                        Paid ({paidInvoices.length})
                    </TabsTrigger>
                    <TabsTrigger
                        value="canceled"
                        className={cn(
                            isMobileLayout
                                ? 'rounded-full border border-border bg-transparent px-3 py-1.5 font-medium text-sm data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none'
                                : 'px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border'
                        )}
                    >
                        Canceled ({canceledInvoices.length})
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Tab Content */}
            {renderInvoiceList()}

            {/* Invoice Preview Modal */}
            {renderInvoicePreview()}

            <InvoicePaymentDetailsModal
                isOpen={Boolean(pendingPaymentInvoice)}
                onClose={closePaymentDetailsModal}
                invoice={pendingPaymentInvoice}
                mode={paymentDetailsMode}
                preferredCurrency={preferredCurrency}
                isSaving={isSavingPaymentDetails}
                onSubmit={handleSubmitPaymentDetails}
            />

            {/* Email Preview Modal */}
            {emailInvoice && (
                <EmailPreviewModal
                    isOpen={!!emailInvoice}
                    onClose={handleCloseEmailModal}
                    invoice={emailInvoice}
                    client={clients.find(c => c.id === emailInvoice.clientId)}
                    businessInfo={emailInvoice.businessInfo?.id
                        ? businessInfos.find(bi => bi.id === emailInvoice.businessInfo.id)
                        : businessInfos.find(bi => bi.isDefault) || businessInfos[0]
                    }
                    clients={clients}
                    sendType={emailSendType}
                />
            )}

            <Modal
                isOpen={Boolean(pendingPaidEditInvoice)}
                onClose={closePaidEditWarning}
                title="Edit paid invoice?"
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closePaidEditWarning}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmPaidEdit}
                        >
                            Continue
                        </Button>
                    </div>
                )}
            >
                <p className="text-sm text-muted-foreground mb-3">
                    Editing a paid invoice can create inconsistencies in your records.
                </p>
                <Notice
                    title="This invoice is marked as paid. Continue anyway?"
                    description="Use Edit payment details instead when you only need to reconcile the received conversion."
                    variant="warning"
                />
            </Modal>

            <Modal
                isOpen={Boolean(pendingUnpaidInvoice)}
                onClose={handleCloseMarkUnpaidModal}
                title="Mark Invoice as Unpaid?"
                description="Correct a mistakenly recorded invoice payment."
                footer={(
                    <div className="flex flex-wrap justify-end gap-3">
                        <Button
                            variant="destructive"
                            onClick={handleConfirmMarkUnpaid}
                            loading={isMarkingInvoiceUnpaid}
                            loadingText="Marking as Unpaid"
                        >
                            Mark as Unpaid
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleCloseMarkUnpaidModal}
                            disabled={isMarkingInvoiceUnpaid}
                        >
                            Keep Paid
                        </Button>
                    </div>
                )}
            >
                {pendingUnpaidInvoice && (
                    <div className="space-y-4">
                        <Notice
                            variant="warning"
                            title="Use this only to correct a mistakenly recorded payment."
                        >
                            <div className="space-y-2">
                                <p>The recorded payment date and currency conversion snapshot will be removed.</p>
                                <p>This does not record or issue a refund.</p>
                            </div>
                        </Notice>

                        <div className="space-y-1 text-sm text-muted-foreground">
                            <p>
                                Invoice: <span className="font-medium text-foreground">{pendingUnpaidInvoice.invoiceNumber}</span>
                            </p>
                            <p>
                                The invoice remains finalized and its billed time and expenses stay linked. It will return to {getInvoiceTabAfterMarkingUnpaid(pendingUnpaidInvoice) === 'overdue' ? 'Overdue' : 'Outstanding'}.
                            </p>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={Boolean(pendingCancellationInvoice)}
                onClose={handleCloseCancellationModal}
                title="Cancel Invoice?"
                size="xl"
                footer={(
                    <div className="flex flex-wrap justify-end gap-3">
                        <Button
                            variant="destructive"
                            onClick={handleConfirmCancellation}
                            loading={isCancelingInvoice}
                            loadingText="Canceling Invoice"
                            disabled={
                                !cancellationReason.trim()
                                || cancellationReason.trim().length > INVOICE_CANCELLATION_REASON_MAX_LENGTH
                                || cancellationConfirmationText !== (pendingCancellationInvoice?.invoiceNumber || '')
                            }
                        >
                            Cancel Invoice
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleCloseCancellationModal}
                            disabled={isCancelingInvoice}
                        >
                            Keep Invoice
                        </Button>
                    </div>
                )}
            >
                {pendingCancellationInvoice && (
                    <div className="space-y-4">
                        <Notice
                            variant="warning"
                            title="The invoice will remain as a canceled historical record."
                            description="Its invoice number stays permanently used. This does not issue a refund or credit note."
                        />

                        <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-x-6">
                            <p>Invoice: <span className="font-medium text-foreground">{pendingCancellationInvoice.invoiceNumber}</span></p>
                            <p>Date: <span className="font-medium text-foreground">{toDisplayDate(pendingCancellationInvoice.date) || '—'}</span></p>
                            <p>
                                Client: <span className="font-medium text-foreground">
                                    {pendingCancellationInvoice.clientId
                                        ? clients.find((candidate) => candidate.id === pendingCancellationInvoice.clientId)?.clientName || pendingCancellationInvoice.client?.name || 'Unknown'
                                        : pendingCancellationInvoice.client?.name || 'Unknown'}
                                </span>
                            </p>
                            <p>
                                Original total: <span className="font-medium text-foreground sensitive-data">
                                    {getCurrencySymbol(pendingCancellationInvoice.currency || preferredCurrency)}{getInvoiceTotal(pendingCancellationInvoice).toFixed(2)} {pendingCancellationInvoice.currency || preferredCurrency}
                                </span>
                            </p>
                        </div>

                        <Notice title="Cancellation effects">
                            <ul className="list-disc space-y-1 pl-5">
                                <li>Billed time and linked expenses become available to invoice again.</li>
                                <li>Invoice-only adjustment entries are removed.</li>
                                <li>Revenue, tax, payment, outstanding, and overdue reports stop counting this invoice.</li>
                            </ul>
                        </Notice>

                        <Notice
                            variant="destructive"
                            title="Accounting correction may still be required"
                            description="If this invoice was paid or already tax-accounted, use the appropriate credit-note or refund process outside TaskTime Pro."
                        />

                        <div className="space-y-2">
                            <Label htmlFor="invoice-cancellation-reason">
                                Cancellation reason <span className="text-destructive-strong" aria-hidden="true">*</span>
                            </Label>
                            <Textarea
                                id="invoice-cancellation-reason"
                                value={cancellationReason}
                                onChange={(event) => setCancellationReason(event.target.value)}
                                maxLength={INVOICE_CANCELLATION_REASON_MAX_LENGTH}
                                rows={4}
                                disabled={isCancelingInvoice}
                                placeholder="Explain why this invoice is being canceled"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                {cancellationReason.length}/{INVOICE_CANCELLATION_REASON_MAX_LENGTH} characters
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cancel-invoice-confirmation" className="block">
                                Type <strong>{pendingCancellationInvoice.invoiceNumber}</strong> to confirm:
                            </Label>
                            <Input
                                id="cancel-invoice-confirmation"
                                type="text"
                                value={cancellationConfirmationText}
                                onChange={(event) => setCancellationConfirmationText(event.target.value)}
                                placeholder={pendingCancellationInvoice.invoiceNumber}
                                disabled={isCancelingInvoice}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={Boolean(pendingUndoInvoice)}
                onClose={handleCloseUndoModal}
                title="Undo Invoice?"
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="destructive"
                            onClick={handleConfirmUndoInvoice}
                            loading={isUndoingInvoice}
                            loadingText="Undoing Invoice"
                            disabled={undoConfirmationText.trim() !== (pendingUndoInvoice?.invoiceNumber || '')}
                        >
                            Undo Invoice
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleCloseUndoModal}
                            disabled={isUndoingInvoice}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            >
                {pendingUndoInvoice && (() => {
                    const template = resolveCurrentInvoiceTemplate(pendingUndoInvoice, invoiceTemplates);
                    const sequenceRollback = getInvoiceSequenceRollback(pendingUndoInvoice, template, allActiveInvoices);

                    return (
                        <div className="space-y-4">
                            <Notice
                                title="This will restore billing state as if the invoice was never generated."
                                variant="warning"
                            >
                                <p>
                                    The invoice record will be removed, billed time entries will be restored, invoice adjustments deleted, quoted flat amounts released, and linked expenses marked unbilled again.
                                </p>
                            </Notice>

                            <div className="space-y-1 text-sm text-muted-foreground">
                                <p>
                                    Invoice: <span className="font-medium text-foreground">{pendingUndoInvoice.invoiceNumber}</span>
                                </p>
                                <p>
                                    Client: <span className="font-medium text-foreground">
                                        {(() => {
                                            if (pendingUndoInvoice.clientId) {
                                                const client = clients.find((candidate) => candidate.id === pendingUndoInvoice.clientId);
                                                if (client) {
                                                    return client.clientName;
                                                }
                                            }

                                            return pendingUndoInvoice.client?.name || 'Unknown';
                                        })()}
                                    </span>
                                </p>
                                <p>
                                    Total: <span className="font-medium text-foreground sensitive-data">
                                        {getCurrencySymbol(pendingUndoInvoice.currency || preferredCurrency)}{getInvoiceTotal(pendingUndoInvoice).toFixed(2)}
                                    </span>
                                </p>
                                <p>
                                    Invoice number sequence: <span className="font-medium text-foreground">
                                        {sequenceRollback.canRollback
                                            ? 'Will be restored'
                                            : 'Will stay as-is'}
                                    </span>
                                </p>
                                {sequenceRollback.reason && (
                                    <p>{sequenceRollback.reason}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="undo-invoice-confirmation" className="block">
                                    Type <strong>{pendingUndoInvoice.invoiceNumber}</strong> to confirm:
                                </Label>
                                <Input
                                    id="undo-invoice-confirmation"
                                    type="text"
                                    value={undoConfirmationText}
                                    onChange={(event) => setUndoConfirmationText(event.target.value)}
                                    placeholder={pendingUndoInvoice.invoiceNumber}
                                    disabled={isUndoingInvoice}
                                />
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default InvoicesList;
