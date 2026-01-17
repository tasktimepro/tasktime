import { Button } from '@/components/ui/button';

/**
 * InvoiceActions component - Footer action buttons for the invoice modal.
 * @param {Object} props
 * @param {Object|null} props.editingInvoice
 * @param {Function} props.handleCancel
 */
const InvoiceActions = ({ editingInvoice, handleCancel }) => {
    return (
        <div className="flex justify-end space-x-3">
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
    );
};

export default InvoiceActions;
