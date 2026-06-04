import React, { useEffect, useRef, useState } from 'react';
import Modal from '../Modal';
import { ArrowDownTrayIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { toDisplayDate } from '../../utils/dateUtils.ts';
import { getCurrencySymbol, getPreferredCurrency } from '../../utils/currencyUtils.ts';
import { getInvoiceTotal } from '../../utils/invoiceUtils.ts';

const A4_PREVIEW_WIDTH_PX = 794;
const A4_PREVIEW_HEIGHT_PX = 1123;
const PREVIEW_HEIGHT_BUFFER_PX = 24;
const PREVIEW_TOP_PADDING_PX = 12;

/**
 * InvoicePreviewModal component - Displays invoice preview HTML or fallback summary.
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {string} props.title
 * @param {Object|null} props.invoice
 * @param {string|null} props.htmlContent
 * @param {React.ReactNode} props.footer
 * @param {Function} props.onDownload
 * @param {string} props.downloadLabel
 */
const InvoicePreviewModal = ({
    isOpen,
    onClose,
    title,
    invoice,
    htmlContent,
    footer,
    onDownload,
    downloadLabel = 'Download PDF'
}) => {
    const isQuoteMode = invoice?.documentMode === 'quote';
    const previewHtml = htmlContent || invoice?.htmlContent || '';
    const previewTitle = title || (invoice ? `${isQuoteMode ? 'Quote' : 'Invoice'} Preview - ${invoice.invoiceNumber}` : `${isQuoteMode ? 'Quote' : 'Invoice'} Preview`);
    const modalContentRef = useRef(null);
    const previewPageRef = useRef(null);
    const [previewScale, setPreviewScale] = useState(1);
    const [previewFrameWidth, setPreviewFrameWidth] = useState(A4_PREVIEW_WIDTH_PX);
    const [previewFrameHeight, setPreviewFrameHeight] = useState(A4_PREVIEW_HEIGHT_PX + PREVIEW_HEIGHT_BUFFER_PX);

    useEffect(() => {
        if (!isOpen || !previewHtml) {
            setPreviewScale(1);
            setPreviewFrameWidth(A4_PREVIEW_WIDTH_PX);
            setPreviewFrameHeight(A4_PREVIEW_HEIGHT_PX + PREVIEW_HEIGHT_BUFFER_PX);
            return undefined;
        }

        const syncPreviewLayout = () => {
            const measuredWidth = modalContentRef.current?.clientWidth || window.innerWidth || A4_PREVIEW_WIDTH_PX;
            const nextScale = Math.min(1, measuredWidth / A4_PREVIEW_WIDTH_PX);
            const invoiceDocumentElement = previewPageRef.current?.querySelector('.invoice-document');
            const previewContentWidth = invoiceDocumentElement?.scrollWidth
                || invoiceDocumentElement?.offsetWidth
                || previewPageRef.current?.scrollWidth
                || A4_PREVIEW_WIDTH_PX;
            const previewContentHeight = invoiceDocumentElement?.scrollHeight
                || invoiceDocumentElement?.offsetHeight
                || previewPageRef.current?.scrollHeight
                || A4_PREVIEW_HEIGHT_PX;
            const nextUnscaledWidth = Math.max(previewContentWidth, A4_PREVIEW_WIDTH_PX);
            const nextUnscaledHeight = Math.max(previewContentHeight, A4_PREVIEW_HEIGHT_PX);
            const nextFrameWidth = Math.ceil(nextUnscaledWidth * nextScale);
            const nextFrameHeight = Math.ceil(nextUnscaledHeight * nextScale) + PREVIEW_HEIGHT_BUFFER_PX;

            setPreviewScale(nextScale > 0 ? nextScale : 1);
            setPreviewFrameWidth(nextFrameWidth);
            setPreviewFrameHeight(nextFrameHeight);
        };

        syncPreviewLayout();

        let rafIdOne = 0;
        let rafIdTwo = 0;
        let timeoutId = 0;

        rafIdOne = window.requestAnimationFrame(() => {
            syncPreviewLayout();
            rafIdTwo = window.requestAnimationFrame(syncPreviewLayout);
        });

        timeoutId = window.setTimeout(syncPreviewLayout, 120);

        window.addEventListener('resize', syncPreviewLayout);

        let resizeObserver;

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(syncPreviewLayout);

            if (modalContentRef.current) {
                resizeObserver.observe(modalContentRef.current);
            }

            if (previewPageRef.current) {
                resizeObserver.observe(previewPageRef.current);
            }
        }

        return () => {
            window.cancelAnimationFrame(rafIdOne);
            window.cancelAnimationFrame(rafIdTwo);
            window.clearTimeout(timeoutId);
            window.removeEventListener('resize', syncPreviewLayout);
            resizeObserver?.disconnect();
        };
    }, [isOpen, previewHtml]);

    const modalFooter = footer || (
        <div className="flex justify-end gap-3">
            {onDownload ? (
                <Button
                    onClick={onDownload}
                    leadingIcon={ArrowDownTrayIcon}
                >
                    {downloadLabel}
                </Button>
            ) : null}
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
            contentRef={modalContentRef}
        >
            {previewHtml ? (
                <div className="space-y-3">
                    <Notice
                        compact
                        title="Preview note"
                        description="The final generated PDF can vary slightly from the preview below."
                    />
                    <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200 bg-white p-2 text-black sm:p-3" data-testid="invoice-preview-shell">
                        <div
                            className="mx-auto"
                            data-testid="invoice-preview-frame"
                            style={{
                                width: `${previewFrameWidth}px`,
                                minWidth: `${previewFrameWidth}px`,
                                height: `${previewFrameHeight}px`,
                            }}
                        >
                            <div
                                ref={previewPageRef}
                                className="origin-top-left overflow-visible bg-white text-black"
                                data-testid="invoice-preview-page"
                            style={{
                                width: `${A4_PREVIEW_WIDTH_PX}px`,
                                minHeight: `${A4_PREVIEW_HEIGHT_PX}px`,
                                transform: `scale(${previewScale})`,
                            }}
                        >
                                <div
                                    style={{ paddingTop: `${PREVIEW_TOP_PADDING_PX}px` }}
                                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="text-center border-b pb-4">
                        <h1 className="text-2xl font-bold text-foreground">{isQuoteMode ? 'QUOTE' : 'INVOICE'}</h1>
                        <p className="text-muted-foreground">{isQuoteMode ? 'Quote' : 'Invoice'} #{invoice?.invoiceNumber}</p>
                        <p className="text-muted-foreground">Date: {invoice?.date ? toDisplayDate(invoice.date) : '—'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-sm font-medium text-foreground mb-2">{isQuoteMode ? 'Quote To:' : 'Invoice To:'}</h3>
                            <div className="text-sm text-muted-foreground">
                                <p>{invoice?.client?.name}</p>
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
