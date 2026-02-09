import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DocumentTextIcon, PencilIcon, ArrowDownTrayIcon, EyeIcon, CheckIcon, PlusIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Notice } from '@/components/ui/notice';
import { generatePDF, createInvoiceHTML } from '../utils/pdfUtils.ts';
import { getCurrencySymbol, getPreferredCurrency } from '../utils/currencyUtils.ts';
import { parseStoredDate, toDisplayDate } from '../utils/dateUtils.ts';
import { useUrlState } from '../hooks/useUrlState.ts';
import { useInvoices } from '../hooks/useInvoices.ts';
import Pagination from './Pagination';
import Modal from './Modal';
import InvoicePreviewModal from './invoice/InvoicePreviewModal';

/**
 * Helper function to determine if an invoice is overdue
 */
const isInvoiceOverdue = (invoice) => {
    if (!invoice.dueDate || invoice.paymentProcessed) {
        return false;
    }
    
    const today = new Date();
    // parseStoredDate handles ISO date strings and timestamps
    const dueDate = parseStoredDate(invoice.dueDate);
    
    if (!dueDate) return false;
    
    // Set times to start of day for accurate date comparison
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    return today > dueDate;
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
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [pendingPaidEditInvoice, setPendingPaidEditInvoice] = useState(null);
    const { updateUrl } = useUrlState();
    
    // Yjs hook for invoice updates
    const { updateInvoice } = useInvoices();

    // Filter out soft-deleted invoices (projectInvoices already filtered by parent)
    const activeInvoices = useMemo(() => projectInvoices, [projectInvoices]);
    
    // Default to overdue tab if there are overdue invoices, otherwise outstanding
    // But allow override via selectedTab prop
    const defaultTab = useMemo(() => {
        // If a specific tab is selected via prop, use that (if valid)
        if (selectedTab && ['overdue', 'outstanding', 'paid'].includes(selectedTab)) {
            return selectedTab;
        }
        
        // Otherwise use the existing logic
        const hasOverdueInvoices = activeInvoices.some(invoice => 
            !invoice.paymentProcessed && isInvoiceOverdue(invoice)
        );
        return hasOverdueInvoices ? 'overdue' : 'outstanding';
    }, [activeInvoices, selectedTab]);
    
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
    const ITEMS_PER_PAGE = 8;

    // Filter invoices by payment status (using activeInvoices which excludes deleted)
    const outstandingInvoices = useMemo(() => 
        activeInvoices.filter(invoice => !invoice.paymentProcessed),
    [activeInvoices]);

    const paidInvoices = useMemo(() => 
        activeInvoices.filter(invoice => invoice.paymentProcessed),
    [activeInvoices]);

    // Filter overdue invoices (subset of outstanding)
    const overdueInvoices = useMemo(() => 
        outstandingInvoices.filter(invoice => isInvoiceOverdue(invoice)),
    [outstandingInvoices]);

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

    // Handle tab change
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        // Update URL to reflect the selected tab, preserving other parameters
        const currentParams = new URLSearchParams(window.location.search);
        const section = currentParams.get('section');
        updateUrl({ 
            tab,
            section: section || 'invoices' // Preserve the current section
        });
    };

    /**
     * Handle invoice download
     */
    const handleDownload = async (invoice) => {
        try {
            // Check if htmlContent exists, if not, recreate it
            let htmlContent = invoice.htmlContent;
            if (!htmlContent) {
                
                const paymentMethod = invoice.paymentMethod;
                const businessInfo = invoice.businessInfo;
                
                // Find the client if one is associated with this invoice
                const foundClient = invoice.clientId ? 
                    clients.find(ci => ci.id === invoice.clientId) : null;
                
                // Prepare client data for PDF generation
                const clientData = foundClient ? {
                    name: foundClient.clientName || '',
                    contactPerson: foundClient.contactPerson || '',
                    email: foundClient.email || '',
                    address: foundClient.address || '',
                    city: foundClient.city || '',
                    state: foundClient.state || '',
                    zip: foundClient.zip || '',
                    country: foundClient.country || ''
                } : invoice.client;
                
                // Recreate the HTML content from the invoice data
                htmlContent = createInvoiceHTML({
                    project: invoice.project,
                    client: clientData,
                    tasks: invoice.tasks,
                    totalHours: invoice.totalHours,
                    totalAmount: invoice.totalAmount,
                    invoiceNumber: invoice.invoiceNumber,
                    date: invoice.date,
                    dueDate: invoice.dueDate,
                    paymentMethod: paymentMethod,
                    businessInfo: businessInfo,
                    subtotal: invoice.subtotal,
                    discount: invoice.discount,
                    shipping: invoice.shipping,
                    tax: invoice.tax,
                    taxRate: invoice.taxRate,
                    taxLabel: invoice.taxLabel
                });
            }
            
            const filename = `invoice-${invoice.invoiceNumber}.pdf`;
            
            await generatePDF(htmlContent, filename);
        } catch (error) {
            console.error('Error downloading invoice:', error);
            alert('Error downloading invoice: ' + error.message);
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
     * Handle invoice edit
     */
    const handleEdit = (invoice) => {
        if (onEditInvoice) {
            // Show warning for paid invoices
            if (invoice.paymentProcessed) {
                setPendingPaidEditInvoice(invoice);
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

    /**
     * Handle payment processed toggle
     */
    const handlePaymentProcessedToggle = (invoice) => {
        const nextPaidState = !invoice.paymentProcessed;
        // Update the invoice with the new payment processed status using Yjs hook
        updateInvoice(invoice.id, {
            paymentProcessed: nextPaidState,
            paidAt: nextPaidState ? Date.now() : null
        });

        // If marking as paid and we're on outstanding or overdue tab, and it's the last item on the page,
        // go to previous page if available
        if (!invoice.paymentProcessed && (activeTab === 'outstanding' || activeTab === 'overdue')) {
            let remainingInvoices, setPage;
            
            if (activeTab === 'overdue') {
                remainingInvoices = overdueInvoices.filter(inv => inv.id !== invoice.id);
                setPage = setOverduePage;
                // If no more overdue invoices, switch to outstanding tab
                if (remainingInvoices.length === 0) {
                    setActiveTab('outstanding');
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
    };

    // Render empty state for a tab
    const renderEmptyState = (tabType) => (
        <div className="text-center py-8">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-sm font-medium text-foreground">
                {tabType === 'outstanding' ? 'No outstanding invoices' : 
                 tabType === 'overdue' ? 'No overdue invoices' : 'No paid invoices'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
                {tabType === 'outstanding' 
                    ? 'All your invoices have been paid.'
                    : tabType === 'overdue'
                    ? 'All your invoices are up to date.'
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
                        const invoiceCurrency = invoice.currency || getPreferredCurrency();
                        const invoiceTotal = `${getCurrencySymbol(invoiceCurrency)}${(invoice.totalAmount || 0).toFixed(2)}`;
                        const clientForColor = invoice.clientId
                            ? clients.find((client) => client.id === invoice.clientId)
                            : null;
                        const borderColor = invoice.project?.color || clientForColor?.color || null;

                        return (
                            <Card
                                key={invoice.id}
                                className={`hover:shadow-md transition-shadow ${borderColor ? 'border-l-4' : ''}`}
                                style={borderColor ? { borderLeftColor: borderColor } : undefined}
                            >
                                <CardContent className="p-4">
                                    <div className="flex flex-col space-y-4">
                                    {/* Header row with invoice number and status tag */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <DocumentTextIcon className="h-6 w-6 text-muted-foreground" />
                                            <h3 className="text-sm font-medium text-foreground">
                                                {invoice.invoiceNumber}
                                            </h3>
                                        </div>
                                        <div>
                                            {invoice.paymentProcessed ? (
                                                <Badge variant="success">
                                                    <CheckIcon className="h-3 w-3 mr-1" />
                                                    Paid <span className="mx-1">•</span>
                                                    <span className="sensitive-data">{invoiceTotal}</span>
                                                </Badge>
                                            ) : isInvoiceOverdue(invoice) ? (
                                                <Badge variant="error">
                                                    Overdue <span className="mx-1">•</span>
                                                    <span className="sensitive-data">{invoiceTotal}</span>
                                                </Badge>
                                            ) : (
                                                <Badge variant="warning">
                                                    Outstanding <span className="mx-1">•</span>
                                                    <span className="sensitive-data">{invoiceTotal}</span>
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                {/* Invoice details with action buttons on the same row */}
                                <div className="flex items-end justify-between ml-9">
                                    <div className="flex-1">
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
                                                {getCurrencySymbol(invoice.currency || getPreferredCurrency())}{invoice.totalAmount.toFixed(2)}
                                            </span>
                                        </p>
                                        {invoice.dueDate && !invoice.paymentProcessed && (
                                            <p className={`text-sm mt-1 ${
                                                isInvoiceOverdue(invoice) 
                                                    ? 'text-red-600 font-medium' 
                                                    : 'text-muted-foreground'
                                            }`}>
                                                Due: {toDisplayDate(invoice.dueDate)}
                                            </p>
                                        )}
                                        <div className="text-xs text-muted-foreground mt-1">
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
                                                    {invoice.project?.title || 'Unknown Project'}
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
                                                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
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
                                                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
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
                                                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                deleted
                                                            </span>
                                                        )}
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Action buttons - right side */}
                                    <div className="flex justify-end items-center space-x-2">
                                        {!invoice.paymentProcessed && (
                                            <Button
                                                onClick={() => handlePaymentProcessedToggle(invoice)}
                                                size="sm"
                                                leadingIcon={CheckIcon}
                                            >
                                                Mark as Paid
                                            </Button>
                                        )}

                                        <Button
                                            onClick={() => handleEdit(invoice)}
                                            variant="ghost"
                                            size="icon"
                                            title="Edit Invoice"
                                        >
                                            <PencilIcon className="h-5 w-5" />
                                        </Button>
                                        
                                        <Button
                                            onClick={() => handlePreview(invoice)}
                                            variant="ghost"
                                            size="icon"
                                            title="Preview Invoice"
                                        >
                                            <EyeIcon className="h-5 w-5" />
                                        </Button>
                                        
                                        <Button
                                            onClick={() => handleDownload(invoice)}
                                            variant="ghost"
                                            size="icon"
                                            title="Download as PDF"
                                        >
                                            <ArrowDownTrayIcon className="h-5 w-5" />
                                        </Button>
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
        <div className="space-y-6">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-border rounded-none">
                    {/* Overdue tab - only show when there are overdue invoices */}
                    {overdueInvoices.length > 0 && (
                        <TabsTrigger
                            value="overdue"
                            className="px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-red-700 dark:data-[state=active]:border-red-300 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-300 data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border"
                        >
                            Overdue ({overdueInvoices.length})
                        </TabsTrigger>
                    )}
                    <TabsTrigger
                        value="outstanding"
                        className={`px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border ${outstandingInvoices.length > 0
                            ? 'data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300 data-[state=active]:border-amber-700 dark:data-[state=active]:border-amber-300'
                            : 'data-[state=active]:text-foreground data-[state=active]:border-foreground'
                        }`}
                    >
                        Outstanding ({outstandingInvoices.length})
                    </TabsTrigger>
                    <TabsTrigger
                        value="paid"
                        className="px-4 py-2 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm -mb-px transition-colors data-[state=active]:bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border"
                    >
                        Paid ({paidInvoices.length})
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Tab Content */}
            {renderInvoiceList()}

            {/* Invoice Preview Modal */}
            {renderInvoicePreview()}

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
                    variant="warning"
                />
            </Modal>
        </div>
    );
};

export default InvoicesList;
