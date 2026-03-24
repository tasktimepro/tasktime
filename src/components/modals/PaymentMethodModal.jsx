import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { PlusIcon, TrashIcon } from '@/components/ui/icons';
import { useToast } from '../../hooks/useToast.ts';
import { usePaymentMethods } from '../../hooks/usePaymentMethods.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CustomCheckbox from '../CustomCheckbox';

/**
 * PaymentMethodModal - Modal for creating and editing payment methods
 */
const PaymentMethodModal = ({
    isOpen,
    onClose,
    editingPaymentMethod = null
}) => {
    const { showSuccess } = useToast();
    const { paymentMethods, createPaymentMethod, updatePaymentMethod, setDefault } = usePaymentMethods();
    
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
            updatePaymentMethod(editingPaymentMethod.id, {
                title: formData.title.trim(),
                fullName: formData.fullName.trim(),
                bank: formData.bank.trim(),
                iban: formData.iban.trim(),
                swift: formData.swift.trim(),
                bankAddress: formData.bankAddress.trim(),
                paypal: formData.paypal.trim(),
                custom: formData.custom.filter(item => item.label.trim() && item.value.trim()),
                isDefault: formData.isDefault
            });

            // If this payment method is set as default, remove default from others
            if (formData.isDefault) {
                setDefault(editingPaymentMethod.id);
            }

            showSuccess('Payment method updated successfully');
        } else {
            // Create new payment method
            const newPaymentMethod = createPaymentMethod({
                title: formData.title.trim(),
                fullName: formData.fullName.trim(),
                bank: formData.bank.trim(),
                iban: formData.iban.trim(),
                swift: formData.swift.trim(),
                bankAddress: formData.bankAddress.trim(),
                paypal: formData.paypal.trim(),
                custom: formData.custom.filter(item => item.label.trim() && item.value.trim()),
                isDefault: formData.isDefault
            });

            // If this payment method is set as default, remove default from others
            if (formData.isDefault) {
                setDefault(newPaymentMethod.id);
            }

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
        <div className="flex items-center space-x-4 justify-end">
            {/* Default Checkbox */}
            <div className="flex items-center space-x-2">
                <CustomCheckbox
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                    label="Set as default payment method"
                    labelClassName="text-sm font-medium text-foreground"
                />
            </div>

            <div className="flex space-x-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="payment-method-form"
                >
                    {editingPaymentMethod ? 'Update' : 'Create'} Payment Method
                </Button>
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
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Payment Method Title <span className="text-destructive-strong">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            placeholder="Enter a title for this payment method"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fullName">
                            Full Name
                        </Label>
                        <Input
                            type="text"
                            id="fullName"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleInputChange}
                            placeholder="Full name of the person sending the invoice"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bank">
                            Bank Name
                        </Label>
                        <Input
                            type="text"
                            id="bank"
                            name="bank"
                            value={formData.bank}
                            onChange={handleInputChange}
                            placeholder="Bank name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="iban">
                                IBAN
                            </Label>
                            <Input
                                type="text"
                                id="iban"
                                name="iban"
                                value={formData.iban}
                                onChange={handleInputChange}
                                placeholder="GB29 NWBK 6016 1331 9268 19"
                                style={{ textTransform: 'uppercase' }}
                            />
                            <p className="text-xs text-muted-foreground">International Bank Account Number</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="swift">
                                SWIFT/BIC
                            </Label>
                            <Input
                                type="text"
                                id="swift"
                                name="swift"
                                value={formData.swift}
                                onChange={handleInputChange}
                                placeholder="NWBKGB2L"
                                style={{ textTransform: 'uppercase' }}
                            />
                            <p className="text-xs text-muted-foreground">Bank Identifier Code</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bankAddress">
                            Bank Address
                        </Label>
                        <Textarea
                            id="bankAddress"
                            name="bankAddress"
                            value={formData.bankAddress}
                            onChange={handleInputChange}
                            rows={3}
                            placeholder="123 Bank Street, City, Country"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="paypal">
                            PayPal Email
                        </Label>
                        <Input
                            type="email"
                            id="paypal"
                            name="paypal"
                            value={formData.paypal}
                            onChange={handleInputChange}
                            placeholder="paypal@example.com"
                        />
                    </div>
                </div>

                {/* Custom Fields */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-foreground">Custom Fields</h4>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addCustomField}
                            leadingIcon={PlusIcon}
                        >
                            Add Field
                        </Button>
                    </div>

                    {formData.custom.map((field, index) => (
                        <div key={index} className="grid grid-cols-2 gap-4">
                            <div>
                                <Input
                                    type="text"
                                    value={field.label}
                                    onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)}
                                    placeholder="Field label (e.g., Website)"
                                />
                            </div>
                            <div className="flex space-x-2">
                                <Input
                                    type="text"
                                    value={field.value}
                                    onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                    className="flex-1"
                                    placeholder="Field value"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeCustomField(index)}
                                    className="hover:bg-accent text-destructive-strong hover-text-destructive-strong"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {formData.custom.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">
                            No custom fields added. Click "Add Field" to add custom payment details.
                        </p>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default PaymentMethodModal;
