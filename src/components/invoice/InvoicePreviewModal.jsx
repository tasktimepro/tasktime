import React from 'react';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { toDisplayDate } from '../../utils/dateUtils.ts';
import { getCurrencySymbol, getPreferredCurrency } from '../../utils/currencyUtils.ts';
import { getInvoiceTotal } from '../../utils/invoiceUtils.ts';

/**
 * InvoicePreviewModal component - Displays invoice preview HTML or fallback summary.
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {string} props.title
 * @param {Object|null} props.invoice
 * @param {string|null} props.htmlContent
 * @param {React.ReactNode} props.footer
 */
const InvoicePreviewModal = ({
    isOpen,
    onClose,
    title,
    invoice,
    htmlContent,
    footer
}) => {
    const previewHtml = htmlContent || invoice?.htmlContent || '';
    const previewTitle = title || (invoice ? `Invoice Preview - ${invoice.invoiceNumber}` : 'Invoice Preview');

    const modalFooter = footer || (
        <div className="flex justify-end">
            <Button
                onClick={onClose}
                variant="secondary"
            >
                Close
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={previewTitle}
            size="4xl"
            footer={modalFooter}
        >
            {previewHtml ? (
                <div className="bg-white text-black rounded-lg border border-border p-6 overflow-auto">
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="text-center border-b pb-4">
                        <h1 className="text-2xl font-bold text-foreground">INVOICE</h1>
                        <p className="text-muted-foreground">Invoice #{invoice?.invoiceNumber}</p>
                        <p className="text-muted-foreground">Date: {invoice?.date ? toDisplayDate(invoice.date) : '—'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-sm font-medium text-foreground mb-2">Invoice To:</h3>
                            <div className="text-sm text-muted-foreground">
                                <p>{invoice?.client?.name}</p>
                                {invoice?.client?.email && (
                                    <p>{invoice.client.email}</p>
                                )}
                                {invoice?.client?.address && (
                                    <p>{invoice.client.address}</p>
                                )}
                                {invoice?.client?.city && (
                                    <p>{invoice.client.city}, {invoice.client.state} {invoice.client.zip}</p>
                                )}
                            </div>
                        </div>
                        
                        <div>
                            <h3 className="text-sm font-medium text-foreground mb-2">Project:</h3>
                            <div className="text-sm text-muted-foreground">
                                <p>{invoice?.project?.title || 'Unknown Project'}</p>
                                {invoice?.project?.hourlyRate && (
                                    <p>
                                        <span className="sensitive-data">Rate: {getCurrencySymbol(invoice?.currency || getPreferredCurrency())}{invoice.project.hourlyRate}/{invoice?.currency || getPreferredCurrency()} per hour</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-foreground mb-2">Tasks:</h3>
                        <div className="space-y-1">
                            {invoice?.tasks?.map((task, index) => (
                                <div key={index} className="flex justify-between text-sm py-1 border-b border-border">
                                    <span>{task.title}</span>
                                    <span>{task.hours?.toFixed(2) || 0} hours</span>
                                </div>
                            )) || <p className="text-muted-foreground">No tasks found</p>}
                        </div>
                    </div>

                    <div className="border-t pt-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span>Total: {invoice?.totalHours?.toFixed(2) || 0} hours</span>
                            <span className="sensitive-data">{getCurrencySymbol(invoice?.currency || getPreferredCurrency())}{getInvoiceTotal(invoice).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default InvoicePreviewModal;