import React, { useState, useMemo } from 'react';
import { DocumentTextIcon, PencilIcon, ArrowDownTrayIcon, EyeIcon, CheckIcon } from '@heroicons/react/24/outline';
import { generatePDF, createInvoiceHTML } from '../utils/pdfUtils';
import { getCurrencySymbol } from '../utils/currencyUtils';
import Pagination from './Pagination';
import Modal from './Modal';

/**
 * Helper function to determine if an invoice is overdue
 */
const isInvoiceOverdue = (invoice) => {
    if (!invoice.dueDate || invoice.paymentProcessed) {
        return false;
    }
    
    const today = new Date();
    const dueDate = new Date(invoice.dueDate);
    
    // Set times to start of day for accurate date comparison
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    return today > dueDate;
};

/**
 * InvoicesList component - Displays saved invoices with edit, download, and preview options
 */
const InvoicesList = ({ 
    projectInvoices = [], 
    onEditInvoice, 
    paymentMethods = [], 
    businessInfos = [], 
    clientInfos = [],
    hideNewInvoiceButton = false,
    setInvoices,
    invoiceTemplates = []
}) => {
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [activeTab, setActiveTab] = useState('outstanding');
    const [outstandingPage, setOutstandingPage] = useState(1);
    const [paidPage, setPaidPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    // Filter invoices by payment status
    const outstandingInvoices = useMemo(() => 
        projectInvoices.filter(invoice => !invoice.paymentProcessed),
    [projectInvoices]);

    const paidInvoices = useMemo(() => 
        projectInvoices.filter(invoice => invoice.paymentProcessed),
    [projectInvoices]);

    // Calculate paginated invoices for each tab
    const paginatedOutstandingInvoices = useMemo(() => {
        const startIndex = (outstandingPage - 1) * ITEMS_PER_PAGE;
        return outstandingInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [outstandingInvoices, outstandingPage]);

    const paginatedPaidInvoices = useMemo(() => {
        const startIndex = (paidPage - 1) * ITEMS_PER_PAGE;
        return paidInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [paidInvoices, paidPage]);

    // Calculate total pages for each tab
    const outstandingTotalPages = useMemo(() => 
        Math.ceil(outstandingInvoices.length / ITEMS_PER_PAGE) || 1,
    [outstandingInvoices.length]);

    const paidTotalPages = useMemo(() => 
        Math.ceil(paidInvoices.length / ITEMS_PER_PAGE) || 1,
    [paidInvoices.length]);
    
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

    // Handle tab change
    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    /**
     * Handle invoice download
     */
    const handleDownload = async (invoice) => {
        try {
            console.log('Downloading invoice:', invoice);
            
            // Check if htmlContent exists, if not, recreate it
            let htmlContent = invoice.htmlContent;
            if (!htmlContent) {
                console.log('No htmlContent found, recreating...');
                // Find the payment method if one is associated with this invoice
                const paymentMethod = invoice.paymentMethodId ? 
                    paymentMethods.find(pm => pm.id === invoice.paymentMethodId) : null;
                
                // Find the business info if one is associated with this invoice
                const businessInfo = invoice.businessInfoId ? 
                    businessInfos.find(bi => bi.id === invoice.businessInfoId) : null;
                
                // Find the client info if one is associated with this invoice
                const clientInfoData = invoice.clientInfoId ? 
                    clientInfos.find(ci => ci.id === invoice.clientInfoId) : null;
                
                // Prepare client data for PDF generation
                const clientData = clientInfoData ? {
                    name: clientInfoData.clientName || '',
                    contactPerson: clientInfoData.contactPerson || '',
                    email: clientInfoData.email || '',
                    address: clientInfoData.address || '',
                    city: clientInfoData.city || '',
                    state: clientInfoData.state || '',
                    zip: clientInfoData.zip || '',
                    country: clientInfoData.country || ''
                } : (invoice.clientInfo || invoice.client);
                
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
                    // Include pricing breakdown if available (for backward compatibility)
                    subtotal: invoice.subtotal,
                    discount: invoice.discount,
                    shipping: invoice.shipping,
                    tax: invoice.tax,
                    taxRate: invoice.taxRate,
                    taxLabel: invoice.taxLabel
                });
            }
            
            const filename = `invoice-${invoice.invoiceNumber}.pdf`;
            console.log('Generating PDF with filename:', filename);
            
            await generatePDF(htmlContent, filename);
            console.log('PDF generated successfully');
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
                const confirmEdit = window.confirm(
                    "This invoice is marked as Paid. Editing a paid invoice may cause inconsistencies in your records.\n\nAre you sure you want to continue?"
                );
                if (!confirmEdit) {
                    return; // User cancelled, don't proceed with edit
                }
            }
            
            onEditInvoice(invoice);
        } else {
            alert('Edit functionality requires integration with the parent component.');
        }
    };

    /**
     * Handle payment processed toggle
     */
    const handlePaymentProcessedToggle = (invoice) => {
        if (!setInvoices) {
            console.warn('setInvoices function not provided');
            return;
        }

        // Update the invoice with the new payment processed status
        const updatedInvoice = {
            ...invoice,
            paymentProcessed: !invoice.paymentProcessed
        };

        // Find the invoice in the list and update it
        const updatedInvoices = projectInvoices.map(inv => 
            inv.id === invoice.id ? updatedInvoice : inv
        );

        // Update the invoices state
        setInvoices(updatedInvoices);

        // If marking as paid and we're on outstanding tab, and it's the last item on the page,
        // go to previous page if available
        if (!invoice.paymentProcessed && activeTab === 'outstanding') {
            const remainingOutstanding = outstandingInvoices.filter(inv => inv.id !== invoice.id);
            const newTotalPages = Math.ceil(remainingOutstanding.length / ITEMS_PER_PAGE) || 1;
            if (outstandingPage > newTotalPages) {
                setOutstandingPage(Math.max(1, newTotalPages));
            }
        }
    };

    // Render empty state for a tab
    const renderEmptyState = (tabType) => (
        <div className="text-center py-8">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">
                {tabType === 'outstanding' ? 'No outstanding invoices' : 'No paid invoices'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
                {tabType === 'outstanding' 
                    ? 'All your invoices have been paid.'
                    : 'No invoices have been marked as paid yet.'
                }
            </p>
        </div>
    );

    // Render invoice list for current tab
    const renderInvoiceList = () => {
        const currentInvoices = activeTab === 'outstanding' ? paginatedOutstandingInvoices : paginatedPaidInvoices;
        const currentPage = activeTab === 'outstanding' ? outstandingPage : paidPage;
        const totalPages = activeTab === 'outstanding' ? outstandingTotalPages : paidTotalPages;
        const handlePageChange = activeTab === 'outstanding' ? handleOutstandingPageChange : handlePaidPageChange;
        const totalInvoices = activeTab === 'outstanding' ? outstandingInvoices.length : paidInvoices.length;

        if (currentInvoices.length === 0) {
            return renderEmptyState(activeTab);
        }

        return (
            <>
                <div className="space-y-4">
                    {currentInvoices.map((invoice) => (
                        <div key={invoice.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                            invoice.paymentProcessed 
                                ? 'border-green-300 bg-white' 
                                : 'border-gray-200 bg-white'
                        }`}>
                            <div className="flex flex-col space-y-4">
                                {/* Header row with invoice number and status tag */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                                        <h3 className="text-sm font-medium text-gray-900">
                                            {invoice.invoiceNumber}
                                        </h3>
                                    </div>
                                    <div>
                                        {invoice.paymentProcessed ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckIcon className="h-3 w-3 mr-1" />
                                                Paid
                                            </span>
                                        ) : isInvoiceOverdue(invoice) ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                Overdue
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                Outstanding
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Invoice details */}
                                <div className="ml-9">
                                    <p className="text-sm text-gray-500">
                                        {invoice.date} <span className="mx-1">•</span> {invoice.totalHours.toFixed(2)} hours <span className="mx-1">•</span> {getCurrencySymbol(invoice.project?.currency || 'USD')}{invoice.totalAmount.toFixed(2)}
                                    </p>
                                    {invoice.dueDate && (
                                        <p className={`text-sm mt-1 ${
                                            isInvoiceOverdue(invoice) 
                                                ? 'text-red-600 font-medium' 
                                                : 'text-gray-500'
                                        }`}>
                                            Due: {invoice.dueDate}
                                            {isInvoiceOverdue(invoice) && (
                                                <span className="ml-2 text-xs bg-red-100 text-red-800 px-1 py-0.5 rounded">
                                                    OVERDUE
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    <div className="text-xs text-gray-400 mt-1">
                                        <p>
                                            Project: <span className="font-medium text-gray-600">
                                                {invoice.project?.title || 'Unknown Project'}
                                            </span>
                                        </p>
                                        <p>
                                            Client: <span className="font-medium text-gray-600">
                                                {(() => {
                                                    // Try to get client name from clientInfoId first
                                                    if (invoice.clientInfoId) {
                                                        const clientInfo = clientInfos.find(ci => ci.id === invoice.clientInfoId);
                                                        if (clientInfo) {
                                                            return clientInfo.clientName;
                                                        }
                                                    }
                                                    // Fallback to stored client info or manual entry
                                                    return invoice.clientInfo?.name || invoice.client?.name || 'Unknown';
                                                })()}
                                            </span>
                                        </p>
                                        {invoice.templateId && invoiceTemplates.length > 0 && (() => {
                                            const template = invoiceTemplates.find(t => t.id === invoice.templateId);
                                            return template ? (
                                                <p>
                                                    Template: <span className="font-medium text-gray-600">{template.name}</span>
                                                </p>
                                            ) : null;
                                        })()}
                                        {invoice.businessInfoId && (() => {
                                            const businessInfo = businessInfos.find(bi => bi.id === invoice.businessInfoId);
                                            return businessInfo ? (
                                                <p>
                                                    Business: <span className="font-medium text-gray-600">{businessInfo.title}</span>
                                                </p>
                                            ) : null;
                                        })()}
                                        {invoice.paymentMethodId && (() => {
                                            const paymentMethod = paymentMethods.find(pm => pm.id === invoice.paymentMethodId);
                                            return paymentMethod ? (
                                                <p>
                                                    Payment Method: <span className="font-medium text-gray-600">{paymentMethod.title}</span>
                                                </p>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>

                                {/* Action buttons - bottom right */}
                                <div className="flex justify-end items-center space-x-2">
                                    {!invoice.paymentProcessed && (
                                        <button
                                            onClick={() => handlePaymentProcessedToggle(invoice)}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        >
                                            <CheckIcon className="h-3 w-3 mr-1" />
                                            Mark as Paid
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleEdit(invoice)}
                                        className="p-2 text-gray-400 hover:text-yellow-600 rounded-md hover:bg-yellow-50"
                                        title="Edit Invoice"
                                    >
                                        <PencilIcon className="h-5 w-5" />
                                    </button>
                                    
                                    <button
                                        onClick={() => handlePreview(invoice)}
                                        className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                                        title="Preview Invoice"
                                    >
                                        <EyeIcon className="h-5 w-5" />
                                    </button>
                                    
                                    <button
                                        onClick={() => handleDownload(invoice)}
                                        className="p-2 text-gray-400 hover:text-purple-600 rounded-md hover:bg-purple-50"
                                        title="Download as PDF"
                                    >
                                        <ArrowDownTrayIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
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
                <button
                    onClick={() => handleDownload(selectedInvoice)}
                    className="px-4 py-2 bg-purple-600 text-sm font-medium text-white rounded-md hover:bg-purple-700 flex items-center space-x-2"
                >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    <span>Download PDF</span>
                </button>
                <button
                    onClick={() => setShowPreview(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400"
                >
                    Close
                </button>
            </div>
        );

        return (
            <Modal 
                isOpen={showPreview && !!selectedInvoice}
                onClose={() => setShowPreview(false)}
                title={selectedInvoice ? `Invoice Preview - ${selectedInvoice.invoiceNumber}` : ''}
                size="4xl"
                footer={previewModalFooter}
            >
                {selectedInvoice.htmlContent ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedInvoice.htmlContent }} />
                ) : (
                    <div className="space-y-4">
                        <div className="text-center border-b pb-4">
                            <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
                            <p className="text-gray-600">Invoice #{selectedInvoice.invoiceNumber}</p>
                            <p className="text-gray-600">Date: {selectedInvoice.date}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 mb-2">Invoice To:</h3>
                                <div className="text-sm text-gray-600">
                                    <p>{(selectedInvoice.clientInfo || selectedInvoice.client)?.name}</p>
                                    {(selectedInvoice.clientInfo || selectedInvoice.client)?.email && (
                                        <p>{(selectedInvoice.clientInfo || selectedInvoice.client).email}</p>
                                    )}
                                    {(selectedInvoice.clientInfo || selectedInvoice.client)?.address && (
                                        <p>{(selectedInvoice.clientInfo || selectedInvoice.client).address}</p>
                                    )}
                                    {(selectedInvoice.clientInfo || selectedInvoice.client)?.city && (
                                        <p>{(selectedInvoice.clientInfo || selectedInvoice.client).city}, {(selectedInvoice.clientInfo || selectedInvoice.client).state} {(selectedInvoice.clientInfo || selectedInvoice.client).zip}</p>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 mb-2">Project:</h3>
                                <div className="text-sm text-gray-600">
                                    <p>{selectedInvoice.project?.title || 'Unknown Project'}</p>
                                    {selectedInvoice.project?.hourlyRate && (
                                        <p>
                                            Rate: {getCurrencySymbol(selectedInvoice.project?.currency || 'USD')}${selectedInvoice.project.hourlyRate}/${selectedInvoice.project?.currency || 'USD'} per hour
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-2">Tasks:</h3>
                            <div className="space-y-1">
                                {selectedInvoice.tasks?.map((task, index) => (
                                    <div key={index} className="flex justify-between text-sm py-1 border-b border-gray-200">
                                        <span>{task.title}</span>
                                        <span>{task.hours?.toFixed(2) || 0} hours</span>
                                    </div>
                                )) || <p className="text-gray-500">No tasks found</p>}
                            </div>
                        </div>

                        <div className="border-t pt-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Total: {selectedInvoice.totalHours?.toFixed(2) || 0} hours</span>
                                <span>{getCurrencySymbol(selectedInvoice.project?.currency || 'USD')}{selectedInvoice.totalAmount?.toFixed(2) || 0}</span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        );
    };

    if (projectInvoices.length === 0) {
        return (
            <div className="text-center py-8">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                    Get started by generating your first invoice.
                </p>
                {!hideNewInvoiceButton && (
                    <button
                        onClick={() => onEditInvoice && onEditInvoice(null)}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        <DocumentTextIcon className="h-5 w-5 mr-2" />
                        New Invoice
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
                        activeTab === 'outstanding'
                            ? 'border-yellow-500 text-yellow-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => handleTabChange('outstanding')}
                >
                    Outstanding ({outstandingInvoices.length})
                </button>
                <button
                    className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px ${
                        activeTab === 'paid'
                            ? 'border-green-500 text-green-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => handleTabChange('paid')}
                >
                    Paid ({paidInvoices.length})
                </button>
            </div>

            {/* Tab Content */}
            {renderInvoiceList()}

            {/* Invoice Preview Modal */}
            {renderInvoicePreview()}
        </div>
    );
};

export default InvoicesList;
