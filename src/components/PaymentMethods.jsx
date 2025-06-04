import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, EllipsisHorizontalIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { generateId } from '../utils/idUtils';
import { useToast } from '../hooks/useToast';

// Event name for dropdown coordination
const DROPDOWN_TOGGLE_EVENT = 'payment-dropdown-toggle';

/**
 * PaymentMethods component - Manages global payment methods for invoices
 */
const PaymentMethods = ({ 
    paymentMethods, 
    setPaymentMethods,
    autoOpenCreate = false
}) => {
    const [showCreateForm, setShowCreateForm] = useState(autoOpenCreate);
    const [editingPaymentMethod, setEditingPaymentMethod] = useState(null);
    const [showDropdown, setShowDropdown] = useState({}); // Track dropdown states by payment method ID
    const { showSuccess } = useToast();

    // Auto-open create form when autoOpenCreate prop changes
    useEffect(() => {
        if (autoOpenCreate && !showCreateForm && !editingPaymentMethod) {
            setShowCreateForm(true);
        }
    }, [autoOpenCreate, showCreateForm, editingPaymentMethod]);

    const [formData, setFormData] = useState({
        title: '',
        fullName: '',
        bank: '',
        iban: '',
        swift: '',
        bankAddress: '',
        paypal: '',
        custom: []
    });

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
     * Handle form input changes
     */
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    /**
     * Handle custom field changes
     */
    const handleCustomFieldChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            custom: prev.custom.map((item, i) => 
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    /**
     * Add a new custom field
     */
    const addCustomField = () => {
        setFormData(prev => ({
            ...prev,
            custom: [...prev.custom, { label: '', value: '' }]
        }));
    };

    /**
     * Remove a custom field
     */
    const removeCustomField = (index) => {
        setFormData(prev => ({
            ...prev,
            custom: prev.custom.filter((_, i) => i !== index)
        }));
    };

    /**
     * Validate IBAN format (basic validation)
     */
    const validateIBAN = (iban) => {
        if (!iban) return true; // IBAN is optional
        // Basic IBAN validation - check length and country code
        const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;
        return ibanRegex.test(iban.replace(/\s/g, ''));
    };

    /**
     * Validate SWIFT/BIC format (basic validation)
     */
    const validateSWIFT = (swift) => {
        if (!swift) return true; // SWIFT is optional
        // Basic SWIFT validation - 8 or 11 characters
        const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
        return swiftRegex.test(swift);
    };

    /**
     * Create a new payment method
     */
    const handleCreatePaymentMethod = (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            return;
        }

        // Validate IBAN and SWIFT if provided
        if (formData.iban && !validateIBAN(formData.iban)) {
            showSuccess('Please enter a valid IBAN format', 'error');
            return;
        }

        if (formData.swift && !validateSWIFT(formData.swift)) {
            showSuccess('Please enter a valid SWIFT/BIC format', 'error');
            return;
        }

        const newPaymentMethod = {
            id: generateId(),
            title: formData.title.trim(),
            fullName: formData.fullName.trim(),
            bank: formData.bank.trim(),
            iban: formData.iban.trim(),
            swift: formData.swift.trim(),
            bankAddress: formData.bankAddress.trim(),
            paypal: formData.paypal.trim(),
            custom: formData.custom.filter(item => item.label.trim() && item.value.trim()),
            createdAt: Date.now()
        };

        setPaymentMethods([...paymentMethods, newPaymentMethod]);

        setFormData({
            title: '',
            fullName: '',
            bank: '',
            iban: '',
            swift: '',
            bankAddress: '',
            paypal: '',
            custom: []
        });

        setShowCreateForm(false);

        showSuccess('Payment method created successfully');
    };

    /**
     * Update an existing payment method
     */
    const handleUpdatePaymentMethod = (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            return;
        }

        // Validate IBAN and SWIFT if provided
        if (formData.iban && !validateIBAN(formData.iban)) {
            showSuccess('Please enter a valid IBAN format', 'error');
            return;
        }

        if (formData.swift && !validateSWIFT(formData.swift)) {
            showSuccess('Please enter a valid SWIFT/BIC format', 'error');
            return;
        }

        const updatedPaymentMethods = paymentMethods.map(method =>
            method.id === editingPaymentMethod.id
                ? {
                    ...method,
                    title: formData.title.trim(),
                    fullName: formData.fullName.trim(),
                    bank: formData.bank.trim(),
                    iban: formData.iban.trim(),
                    swift: formData.swift.trim(),
                    bankAddress: formData.bankAddress.trim(),
                    paypal: formData.paypal.trim(),
                    custom: formData.custom.filter(item => item.label.trim() && item.value.trim())
                }
                : method
        );

        setPaymentMethods(updatedPaymentMethods);

        setEditingPaymentMethod(null);

        setFormData({
            title: '',
            fullName: '',
            bank: '',
            iban: '',
            swift: '',
            bankAddress: '',
            paypal: '',
            custom: []
        });

        showSuccess('Payment method updated successfully');
    };

    /**
     * Delete a payment method
     */
    const handleDeletePaymentMethod = (paymentMethodId) => {
        if (window.confirm('Are you sure you want to delete this payment method?')) {
            setPaymentMethods(paymentMethods.filter(method => method.id !== paymentMethodId));

            showSuccess('Payment method deleted successfully');
        }
    };

    /**
     * Start editing a payment method
     */
    const startEditing = (paymentMethod) => {
        setEditingPaymentMethod(paymentMethod);

        setFormData({
            title: paymentMethod.title || paymentMethod.name, // Handle legacy data
            fullName: paymentMethod.fullName || '',
            bank: paymentMethod.bank,
            iban: paymentMethod.iban,
            swift: paymentMethod.swift,
            bankAddress: paymentMethod.bankAddress,
            paypal: paymentMethod.paypal,
            custom: [...paymentMethod.custom]
        });

        setShowCreateForm(false);
    };

    /**
     * Cancel form actions
     */
    const cancelForm = () => {
        setShowCreateForm(false);

        setEditingPaymentMethod(null);

        setFormData({
            title: '',
            fullName: '',
            bank: '',
            iban: '',
            swift: '',
            bankAddress: '',
            paypal: '',
            custom: []
        });
    };

    return (
        <div className={`${(showCreateForm || editingPaymentMethod) ? 'space-y-8' : 'space-y-6'}`}>
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Payment Methods</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Manage reusable payment methods for your invoices
                    </p>
                </div>

                <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Payment Method
                </button>
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingPaymentMethod) && (
                <div className="bg-white shadow rounded-lg p-6 max-w-3xl mx-auto">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                        {editingPaymentMethod ? 'Edit Payment Method' : 'New Payment Method'}
                    </h4>

                    <form onSubmit={editingPaymentMethod ? handleUpdatePaymentMethod : handleCreatePaymentMethod} className="space-y-8">
                        {/* Standard Fields */}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                                    Payment Method Title <span className="text-red-500">*</span>
                                </label>

                                <input
                                    type="text"
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="Enter title for this payment method"
                                />
                            </div>

                            <div>
                                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                                    Full Name
                                </label>

                                <input
                                    type="text"
                                    id="fullName"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="Full name of the person sending the invoice"
                                />
                            </div>

                            <div>
                                <label htmlFor="bank" className="block text-sm font-medium text-gray-700">
                                    Bank Name
                                </label>

                                <input
                                    type="text"
                                    id="bank"
                                    name="bank"
                                    value={formData.bank}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="Bank name"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="iban" className="block text-sm font-medium text-gray-700">
                                        IBAN
                                    </label>

                                    <input
                                        type="text"
                                        id="iban"
                                        name="iban"
                                        value={formData.iban}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                        placeholder="GB29 NWBK 6016 1331 9268 19"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">International Bank Account Number</p>
                                </div>

                                <div>
                                    <label htmlFor="swift" className="block text-sm font-medium text-gray-700">
                                        SWIFT/BIC
                                    </label>

                                    <input
                                        type="text"
                                        id="swift"
                                        name="swift"
                                        value={formData.swift}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                        placeholder="NWBKGB2L"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Bank Identifier Code</p>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="bankAddress" className="block text-sm font-medium text-gray-700">
                                    Bank Address
                                </label>

                                <textarea
                                    id="bankAddress"
                                    name="bankAddress"
                                    value={formData.bankAddress}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="123 Bank Street, City, Country"
                                />
                            </div>

                            <div>
                                <label htmlFor="paypal" className="block text-sm font-medium text-gray-700">
                                    PayPal Email
                                </label>

                                <input
                                    type="email"
                                    id="paypal"
                                    name="paypal"
                                    value={formData.paypal}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="paypal@example.com"
                                />
                            </div>
                        </div>

                        {/* Custom Fields */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h5 className="text-sm font-medium text-gray-900">Custom Fields</h5>
                                <button
                                    type="button"
                                    onClick={addCustomField}
                                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <PlusIcon className="h-3 w-3 mr-1" />
                                    Add Field
                                </button>
                            </div>

                            {formData.custom.map((field, index) => (
                                <div key={index} className="grid grid-cols-2 gap-4">
                                    <div>
                                        <input
                                            type="text"
                                            value={field.label}
                                            onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)}
                                            className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                            placeholder="Field label (e.g., UPI ID)"
                                        />
                                    </div>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            value={field.value}
                                            onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                            className="flex-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                            placeholder="Field value"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeCustomField(index)}
                                            className="inline-flex items-center p-1.5 border border-gray-300 rounded text-gray-700 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {formData.custom.length === 0 && (
                                <p className="text-sm text-gray-500 italic">
                                    No custom fields added. Click "Add Field" to add custom payment details.
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={cancelForm}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                {editingPaymentMethod ? 'Update' : 'Create'} Payment Method
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Payment Methods List */}
            {paymentMethods.length === 0 ? (
                <div className="text-center py-12">
                    <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h4 className="mt-2 text-sm font-medium text-gray-900">No payment methods</h4>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first payment method.</p>

                    <div className="mt-6">
                        <button
                            onClick={() => setShowCreateForm(true)}
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
                                                <h4 className="text-lg font-medium text-gray-900">
                                                    {method.title || method.name}
                                                </h4>
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
                                                            startEditing(method);
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
