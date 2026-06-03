import { Button } from '@/components/ui/button';
import { EyeIcon, PaperAirplaneIcon } from '@/components/ui/icons';

/**
 * InvoiceActions component - Footer action buttons for the invoice modal.
 * @param {Object} props
 * @param {Object|null} props.editingInvoice
 * @param {Function} props.handleClose
 * @param {Function} props.onPreview
 */
const InvoiceActions = ({
    editingInvoice,
    handleClose,
    onPreview,
    mode = 'invoice',
    onSend,
    onDownload,
    canUndoInvoice = false,
    onUndoInvoice,
}) => {
    const isQuoteMode = mode === 'quote';

    return (
        <div className="flex w-full items-center justify-between gap-2">
            {onPreview ? (
                <Button
                    type="button"
                    variant="outline"
                    onClick={onPreview}
                    aria-label={isQuoteMode ? 'Preview quote' : 'Preview invoice'}
                    className="gap-0 px-2.5 sm:gap-2 sm:px-4"
                    leadingIcon={EyeIcon}
                >
                    <span className="hidden sm:inline">Preview</span>
                </Button>
            ) : (
                <div />
            )}
            <div className="flex items-center gap-2 sm:gap-3">
                {editingInvoice && canUndoInvoice && onUndoInvoice && (
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={onUndoInvoice}
                    >
                        Undo Invoice
                    </Button>
                )}

                <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                >
                    Close
                </Button>

                {isQuoteMode ? (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onSend}
                            aria-label="Send Quote"
                            className="gap-0 px-2.5 sm:gap-2 sm:px-4"
                            leadingIcon={PaperAirplaneIcon}
                        >
                            <span className="hidden sm:inline">Send Quote</span>
                        </Button>
                        <Button
                            type="button"
                            onClick={onDownload}
                        >
                            Download Quote
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            type="submit"
                            form="invoice-form"
                        >
                            {editingInvoice ? 'Update Invoice' : 'Generate Invoice'}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

export default InvoiceActions;
