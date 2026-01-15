import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, EllipsisHorizontalIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { useToast } from '../hooks/useToast';

// Event name for dropdown coordination
const DROPDOWN_TOGGLE_EVENT = 'payment-dropdown-toggle';

/**
 * PaymentMethods component - Manages global payment methods for invoices
 */
const PaymentMethods = ({ 
    paymentMethods, 
    setPaymentMethods,
    autoOpenCreate = false,
    // Modal functions
    openPaymentMethodModal = null,
    editPaymentMethodModal = null
}) => {
    const [showDropdown, setShowDropdown] = useState({}); // Track dropdown states by payment method ID
    const { showSuccess } = useToast();

    // Auto-open create modal when autoOpenCreate prop changes
    useEffect(() => {
        if (autoOpenCreate && openPaymentMethodModal) {
            openPaymentMethodModal();
        }
    }, [autoOpenCreate, openPaymentMethodModal]);

    // Close dropdown when clicking outside or when another dropdown opens
    useEffect(() => {
        const handleDropdownToggle = (event) => {
            const { paymentId, open } = event.detail;
            if (!open) {
                // Close all dropdowns when any dropdown is closed
                setShowDropdown({});
            } else {
                // Close other dropdowns when a new one opens
                setShowDropdown({ [paymentId]: true });
            }
        };

        const handleClickOutside = (event) => {
            // Close dropdowns when clicking outside
            if (!event.target.closest('.dropdown-container')) {
                setShowDropdown({});
            }
        };

        document.addEventListener(DROPDOWN_TOGGLE_EVENT, handleDropdownToggle);
        document.addEventListener('click', handleClickOutside);
        
        return () => {
            document.removeEventListener(DROPDOWN_TOGGLE_EVENT, handleDropdownToggle);
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    /**
     * Delete a payment method
     */
    const handleDeletePaymentMethod = (paymentMethodId) => {
        if (window.confirm('Are you sure you want to delete this payment method?')) {
            setPaymentMethods(paymentMethods.filter(method => method.id !== paymentMethodId));
            showSuccess('Payment method deleted successfully');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Payment Methods</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Manage reusable payment methods for your invoices
                    </p>
                </div>

                <button
                    onClick={() => openPaymentMethodModal && openPaymentMethodModal()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Payment Method
                </button>
            </div>

            {/* Payment Methods List */}
            {paymentMethods.length === 0 ? (
                <div className="text-center py-12">
                    <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h4 className="mt-2 text-sm font-medium text-gray-900">No payment methods</h4>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first payment method.</p>

                    <div className="mt-6">
                        <button
                            onClick={() => openPaymentMethodModal && openPaymentMethodModal()}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            New Payment Method
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {paymentMethods.map((method) => (
                        <div
                            key={method.id}
                            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow"
                        >
                            <div className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <CreditCardIcon className="h-6 w-6 text-gray-400" />
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <h4 className="text-lg font-medium text-gray-900">
                                                        {method.title || method.name}
                                                    </h4>
                                                    {method.isDefault && (
                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-gray-500 space-y-1">
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
                                                <p className="mt-2 text-xs text-gray-400">
                                                    Created {new Date(method.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <div className="relative dropdown-container">
                                        <button
                                            onClick={() => {
                                                const newState = !showDropdown[method.id];
                                                setShowDropdown(newState ? { [method.id]: true } : {});

                                                // Dispatch a custom event to close other dropdowns
                                                const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                    detail: { paymentId: method.id, open: newState }
                                                });
                                                document.dispatchEvent(event);
                                            }}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                            title="More actions"
                                        >
                                            <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                        </button>

                                        {showDropdown[method.id] && (
                                            <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            editPaymentMethodModal && editPaymentMethodModal(method);
                                                            setShowDropdown({});
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors space-x-2"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleDeletePaymentMethod(method.id);
                                                            setShowDropdown({});
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors space-x-2"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PaymentMethods;
