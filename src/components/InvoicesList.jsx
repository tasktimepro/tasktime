import { useState } from 'react';
import { DocumentTextIcon, PencilIcon, ArrowDownTrayIcon, EyeIcon } from '@heroicons/react/24/outline';
import { generatePDF, createInvoiceHTML } from '../utils/pdfUtils';
import { getCurrencySymbol } from '../utils/currencyUtils';

/**
 * InvoicesList component - Displays saved invoices with edit, download, and preview options
 */
const InvoicesList = ({ 
    projectInvoices = [], 
    onEditInvoice, 
    paymentMethods = [], 
    businessInfos = [], 
    clientInfos = [],
    hideNewInvoiceButton = false 
}) => {
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showPreview, setShowPreview] = useState(false);

    const invoices = projectInvoices;

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
            onEditInvoice(invoice);
        } else {
            alert('Edit functionality requires integration with the parent component.');
        }
    };

    if (invoices.length === 0) {
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
        <div>
            {/* Info about invoice management */}
            {invoices.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-600">
                        <strong>Note:</strong> Invoices preserve billing history and cannot be deleted. You can edit invoice details or submit corrections as needed.
                    </p>
                </div>
            )}
            
            <div className="space-y-4">
                {invoices.map((invoice) => (
                    <div key={invoice.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                    <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-900">
                                            {invoice.invoiceNumber}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {invoice.date} <span className="mx-1">•</span> {invoice.totalHours.toFixed(2)} hours <span className="mx-1">•</span> {getCurrencySymbol(invoice.project?.currency || 'USD')}{invoice.totalAmount.toFixed(2)}
                                        </p>
                                        <div className="text-xs text-gray-400 mt-1">
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
                                            <p>
                                                Project: <span className="font-medium text-gray-600">
                                                    {invoice.project?.title || 'Unknown Project'}
                                                </span>
                                            </p>
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
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => handlePreview(invoice)}
                                    className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                                    title="Preview Invoice"
                                >
                                    <EyeIcon className="h-5 w-5" />
                                </button>
                                
                                <button
                                    onClick={() => handleEdit(invoice)}
                                    className="p-2 text-gray-400 hover:text-yellow-600 rounded-md hover:bg-yellow-50"
                                    title="Edit Invoice"
                                >
                                    <PencilIcon className="h-5 w-5" />
                                </button>
                                
                                <button
                                    onClick={() => handleDownload(invoice)}
                                    className="p-2 text-gray-400 hover:text-purple-600 rounded-md hover:bg-purple-50"
                                    title="Download as PDF"
                                >
                                    <ArrowDownTrayIcon className="h-5 w-5" />
                                </button>

                                {/* Removed delete button to maintain billing integrity */}
                                {/* Once an invoice is generated, it should not be deleted to preserve billing history */}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Invoice Preview Modal */}
            {showPreview && selectedInvoice && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 !mt-0">
                    <div className="relative mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white my-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900">
                                Invoice Preview - {selectedInvoice.invoiceNumber}
                            </h3>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-[40rem] overflow-y-auto">
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
                        </div>

                        <div className="flex justify-end space-x-4 mt-4">
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoicesList;
