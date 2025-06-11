import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { generateId } from '../../utils/idUtils';
import { useToast } from '../../hooks/useToast';
import CustomCheckbox from '../CustomCheckbox';

/**
 * PaymentMethodModal - Modal for creating and editing payment methods
 */
const PaymentMethodModal = ({
    isOpen,
    onClose,
    paymentMethods,
    setPaymentMethods,
    editingPaymentMethod = null
}) => {
    const { showSuccess } = useToast();
    
    const [formData, setFormData] = useState({
        title: '',
        fullName: '',
        bank: '',
        iban: '',
        swift: '',
        bankAddress: '',
        paypal: '',
        custom: [],
        isDefault: false
    });

    // Initialize form data when editing
    useEffect(() => {
        if (editingPaymentMethod) {
            setFormData({
                title: editingPaymentMethod.title || '',
                fullName: editingPaymentMethod.fullName || '',
                bank: editingPaymentMethod.bank || '',
                iban: editingPaymentMethod.iban || '',
                swift: editingPaymentMethod.swift || '',
                bankAddress: editingPaymentMethod.bankAddress || '',
                paypal: editingPaymentMethod.paypal || '',
                custom: [...(editingPaymentMethod.custom || [])],
                isDefault: editingPaymentMethod.isDefault || false
            });
        } else {
            setFormData({
                title: '',
                fullName: '',
                bank: '',
                iban: '',
                swift: '',
                bankAddress: '',
                paypal: '',
                custom: [],
                isDefault: false
            });
        }
    }, [editingPaymentMethod, isOpen]);

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
     * Handle form submission
     */
    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            showSuccess('Payment method title is required', 'error');
            return;
        }

        if (editingPaymentMethod) {
            // Update existing payment method
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
                        custom: formData.custom.filter(item => item.label.trim() && item.value.trim()),
                        isDefault: formData.isDefault
                    }
                    : method
            );

            // If this payment method is set as default, remove default from others
            let finalUpdatedPaymentMethods = updatedPaymentMethods;
            if (formData.isDefault) {
                finalUpdatedPaymentMethods = updatedPaymentMethods.map(method => ({
                    ...method,
                    isDefault: method.id === editingPaymentMethod.id
                }));
            }

            setPaymentMethods(finalUpdatedPaymentMethods);
            showSuccess('Payment method updated successfully');
        } else {
            // Create new payment method
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
                isDefault: formData.isDefault,
                createdAt: Date.now()
            };

            let updatedPaymentMethods = [...paymentMethods, newPaymentMethod];

            // If this payment method is set as default, remove default from others
            if (formData.isDefault) {
                updatedPaymentMethods = updatedPaymentMethods.map(method => ({
                    ...method,
                    isDefault: method.id === newPaymentMethod.id
                }));
            }

            setPaymentMethods(updatedPaymentMethods);
            showSuccess('Payment method created successfully');
        }

        onClose();
    };

    /**
     * Handle cancel
     */
    const handleCancel = () => {
        onClose();
    };

    // Modal footer with action buttons
    const modalFooter = (
        <div className="flex justify-between items-center">
            {/* Default Checkbox */}
            <div className="flex items-center space-x-2">
                <CustomCheckbox
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                    label="Set as default payment method"
                    labelClassName="text-sm font-medium text-gray-700"
                />
            </div>

            <div className="flex space-x-3">
                <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    form="payment-method-form"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    {editingPaymentMethod ? 'Update' : 'Create'} Payment Method
                </button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingPaymentMethod ? 'Edit Payment Method' : 'New Payment Method'}
            size="2xl"
            footer={modalFooter}
        >
            <form id="payment-method-form" onSubmit={handleSubmit} className="space-y-8">
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
                        <h4 className="text-sm font-medium text-gray-900">Custom Fields</h4>
                        <button
                            type="button"
                            onClick={addCustomField}
                            className="inline-flex items-center px-3 py-1 border border-blue-300 shadow-sm text-xs font-medium rounded text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                                    placeholder="Field label (e.g., Website)"
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
            </form>
        </Modal>
    );
};

export default PaymentMethodModal;
