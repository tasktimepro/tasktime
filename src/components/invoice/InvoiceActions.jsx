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
                    leadingIcon={EyeIcon}
                >
                    Preview
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
                    {editingInvoice ? 'Update Invoice' : 'Generate New Invoice'}
                </Button>
            </div>
        </div>
    );
};

export default InvoiceActions;
