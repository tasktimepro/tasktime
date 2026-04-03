import { Button } from '@/components/ui/button';
import { EyeIcon } from '@/components/ui/icons';

/**
 * InvoiceActions component - Footer action buttons for the invoice modal.
 * @param {Object} props
 * @param {Object|null} props.editingInvoice
 * @param {Function} props.handleCancel
 * @param {Function} props.onPreview
 */
const InvoiceActions = ({ editingInvoice, handleCancel, onPreview }) => {
    return (
        <div className="flex w-full items-center justify-between">
            {onPreview ? (
                <Button
                    type="button"
                    variant="outline"
                    onClick={onPreview}
                    aria-label="Preview invoice"
                    className="gap-0 px-2.5 sm:gap-2 sm:px-4"
                    leadingIcon={EyeIcon}
                >
                    <span className="hidden sm:inline">Preview</span>
                </Button>
            ) : (
                <div />
            )}
            <div className="flex items-center space-x-3">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancel}
                >
                    Cancel
                </Button>

                <Button
                    type="submit"
                    form="invoice-form"
                >
                    {editingInvoice ? 'Update Invoice' : 'Generate Invoice'}
                </Button>
            </div>
        </div>
    );
};

export default InvoiceActions;
