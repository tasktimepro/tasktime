import { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, CreditCardIcon } from '@/components/ui/icons';
import { MoreHorizontal } from 'lucide-react';
import { useToast } from '../hooks/useToast.ts';
import { usePaymentMethods } from '../hooks/usePaymentMethods.ts';
import { toDisplayDate } from '../utils/dateUtils.ts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import Modal from './Modal';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * PaymentMethods component - Manages global payment methods for invoices
 */
const PaymentMethods = ({ 
    autoOpenCreate = false,
    // Modal functions
    openPaymentMethodModal = null,
    editPaymentMethodModal = null
}) => {
    const isMobileLayout = useIsMobileLayout();
    const { showSuccess } = useToast();
    const { paymentMethods, deletePaymentMethod } = usePaymentMethods();
    const [pendingDeletePaymentMethodId, setPendingDeletePaymentMethodId] = useState(null);

    // Auto-open create modal when autoOpenCreate prop changes
    useEffect(() => {
        if (autoOpenCreate && openPaymentMethodModal) {
            openPaymentMethodModal();
        }
    }, [autoOpenCreate, openPaymentMethodModal]);

    /**
     * Delete a payment method
     */
    const handleDeletePaymentMethod = (paymentMethodId) => {
        setPendingDeletePaymentMethodId(paymentMethodId);
    };

    const closeDeletePaymentMethodModal = () => {

        setPendingDeletePaymentMethodId(null);
    };

    const confirmDeletePaymentMethod = () => {

        if (!pendingDeletePaymentMethodId) {

            return;
        }

        deletePaymentMethod(pendingDeletePaymentMethodId);
        showSuccess('Payment method deleted successfully');
        setPendingDeletePaymentMethodId(null);
    };

    const pendingDeletePaymentMethod = pendingDeletePaymentMethodId
        ? paymentMethods.find((method) => method.id === pendingDeletePaymentMethodId)
        : null;

    return (
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4 overflow-x-hidden')}>
            {/* Header */}
            <div className={cn('flex justify-between gap-3', isMobileLayout ? 'flex-col items-start' : 'items-center')}>
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Payment Methods</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage reusable payment methods
                    </p>
                </div>

                <Button
                    onClick={() => openPaymentMethodModal && openPaymentMethodModal()}
                    leadingIcon={PlusIcon}
                    className={cn(isMobileLayout && 'w-full sm:w-auto')}
                >
                    New Payment Method
                </Button>
            </div>

            {/* Payment Methods List */}
            {paymentMethods.length === 0 ? (
                <div className="text-center py-12">
                    <CreditCardIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h4 className="mt-2 text-sm font-medium text-foreground">No payment methods</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first payment method.</p>

                    <div className="mt-6">
                        <Button
                            onClick={() => openPaymentMethodModal && openPaymentMethodModal()}
                            leadingIcon={PlusIcon}
                        >
                            New Payment Method
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {paymentMethods.map((method) => (
                        <Card
                            key={method.id}
                            className="hover:shadow-md transition-shadow"
                        >
                            <CardContent className={cn(isMobileLayout ? 'p-4' : 'pt-5')}>
                                <div className={cn('justify-between gap-3', isMobileLayout ? 'space-y-3' : 'flex items-center')}>
                                    <div className="flex-1">
                                        <div className="flex items-start space-x-3 min-w-0">
                                            <CreditCardIcon className="h-6 w-6 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-lg font-medium text-foreground break-words">
                                                        {method.title || method.name}
                                                    </h4>
                                                    {method.isDefault && (
                                                        <Badge variant="secondary">Default</Badge>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground space-y-1 break-words">
                                                    {method.fullName && <p>Full Name: {method.fullName}</p>}
                                                    {method.bank && <p>Bank: {method.bank}</p>}
                                                    {method.iban && <p>IBAN: {method.iban}</p>}
                                                    {method.swift && <p>SWIFT: {method.swift}</p>}
                                                    {method.bankAddress && <p>Bank Address: {method.bankAddress}</p>}
                                                    {method.paypal && <p>PayPal: {method.paypal}</p>}
                                                    {method.custom.length > 0 && (
                                                        <div className="space-y-1">
                                                            {method.custom.map((field, index) => (
                                                                <p key={index}>{field.label}: {field.value}</p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Created {toDisplayDate(method.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <div className={cn(isMobileLayout && 'flex justify-end')}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:bg-muted rounded-full transition-colors group"
                                                title="More actions"
                                                aria-label="More actions"
                                            >
                                                <MoreHorizontal className="h-5 w-5 group-hover:text-muted-foreground" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => editPaymentMethodModal && editPaymentMethodModal(method)}
                                                className="status-warning-action cursor-pointer"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                                <span>Edit</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDeletePaymentMethod(method.id)}
                                                className="status-danger-action cursor-pointer"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                <span>Delete</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                isOpen={Boolean(pendingDeletePaymentMethodId)}
                onClose={closeDeletePaymentMethodModal}
                title="Delete payment method?"
                description="This will permanently remove the payment method."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeletePaymentMethodModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeletePaymentMethod}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={pendingDeletePaymentMethod
                        ? `Deleting "${pendingDeletePaymentMethod.title || pendingDeletePaymentMethod.name}" cannot be undone.`
                        : 'Deleting this payment method cannot be undone.'}
                    variant="destructive"
                />
            </Modal>
        </div>
    );
};

export default PaymentMethods;
