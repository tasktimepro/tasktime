import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { PlusIcon, TrashIcon } from '@/components/ui/icons';
import { useToast } from '../../hooks/useToast.ts';
import { useBusinessInfos } from '../../hooks/useBusinessInfos.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CustomCheckbox from '../CustomCheckbox';

/**
 * BusinessModal - Modal for creating and editing business information
 */
const BusinessModal = ({
    isOpen,
    onClose,
    editingBusinessInfo = null
}) => {
    const { showSuccess } = useToast();
    const { businessInfos, createBusinessInfo, updateBusinessInfo, setDefault } = useBusinessInfos();
    
    const [formData, setFormData] = useState({
        title: '',
        businessName: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        registrationNumber: '',
        vat: '',
        taxNumber: '',
        email: '',
        phone: '',
        custom: [],
        isDefault: false,
        taxEnabled: false,
        taxLabel: 'VAT',
        taxRate: 0
    });

    const [expandedSections, setExpandedSections] = useState({
        businessInfo: false
    });

    // Initialize form data when editing
    useEffect(() => {
        if (editingBusinessInfo) {
            setFormData({
                title: editingBusinessInfo.title || '',
                businessName: editingBusinessInfo.businessName || '',
                address: editingBusinessInfo.address || '',
                city: editingBusinessInfo.city || '',
                state: editingBusinessInfo.state || '',
                zip: editingBusinessInfo.zip || '',
                country: editingBusinessInfo.country || '',
                registrationNumber: editingBusinessInfo.registrationNumber || '',
                vat: editingBusinessInfo.vat || '',
                taxNumber: editingBusinessInfo.taxNumber || '',
                email: editingBusinessInfo.email || '',
                phone: editingBusinessInfo.phone || '',
                custom: [...(editingBusinessInfo.custom || [])],
                isDefault: editingBusinessInfo.isDefault || false,
                taxEnabled: editingBusinessInfo.taxEnabled || false,
                taxLabel: editingBusinessInfo.taxLabel || 'VAT',
                taxRate: editingBusinessInfo.taxRate || 0
            });
        } else {
            setFormData({
                title: '',
                businessName: '',
                address: '',
                city: '',
                state: '',
                zip: '',
                country: '',
                registrationNumber: '',
                vat: '',
                taxNumber: '',
                email: '',
                phone: '',
                custom: [],
                isDefault: false,
                taxEnabled: false,
                taxLabel: 'VAT',
                taxRate: 0
            });
        }
    }, [editingBusinessInfo, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setExpandedSections({
                businessInfo: false
            });
        }
    }, [isOpen, editingBusinessInfo]);

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

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
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
     * Validate email format (basic validation)
     */
    const validateEmail = (email) => {
        if (!email) return true; // Email is optional
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    /**
     * Handle form submission
     */
    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            showSuccess('Business title is required', 'error');
            return;
        }

        if (!formData.businessName.trim()) {
            showSuccess('Business name is required', 'error');
            return;
        }

        // Validate email if provided
        if (formData.email && !validateEmail(formData.email)) {
            showSuccess('Please enter a valid email format', 'error');
            return;
        }

        if (editingBusinessInfo) {
            // Update existing business info
            updateBusinessInfo(editingBusinessInfo.id, {
                title: formData.title.trim(),
                businessName: formData.businessName.trim(),
                address: formData.address.trim(),
                city: formData.city.trim(),
                state: formData.state.trim(),
                zip: formData.zip.trim(),
                country: formData.country.trim(),
                registrationNumber: formData.registrationNumber.trim(),
                vat: formData.vat.trim(),
                taxNumber: formData.taxNumber.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                custom: formData.custom.filter(item => item.label.trim() && item.value.trim()),
                isDefault: formData.isDefault,
                taxEnabled: formData.taxEnabled,
                taxLabel: formData.taxLabel,
                taxRate: parseFloat(formData.taxRate) || 0
            });

            // If this business info is set as default, remove default from others
            if (formData.isDefault) {
                setDefault(editingBusinessInfo.id);
            }

            showSuccess('Business info updated successfully');
        } else {
            // Create new business info
            const newBusinessInfo = createBusinessInfo({
                title: formData.title.trim(),
                businessName: formData.businessName.trim(),
                address: formData.address.trim(),
                city: formData.city.trim(),
                state: formData.state.trim(),
                zip: formData.zip.trim(),
                country: formData.country.trim(),
                registrationNumber: formData.registrationNumber.trim(),
                vat: formData.vat.trim(),
                taxNumber: formData.taxNumber.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                custom: formData.custom.filter(item => item.label.trim() && item.value.trim()),
                isDefault: formData.isDefault,
                taxEnabled: formData.taxEnabled,
                taxLabel: formData.taxLabel,
                taxRate: parseFloat(formData.taxRate) || 0
            });

            // If this business info is set as default, remove default from others
            if (formData.isDefault) {
                setDefault(newBusinessInfo.id);
            }

            showSuccess('Business info created successfully');
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
                    label="Set as default business info"
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
                    form="business-form"
                >
                    {editingBusinessInfo ? 'Update' : 'Create'} Business
                </Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingBusinessInfo ? 'Edit Business' : 'New Business'}
            size="3xl"
            footer={modalFooter}
        >
            <form id="business-form" onSubmit={handleSubmit} className="space-y-8">
                {/* Standard Fields */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Business Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            placeholder="Enter a title for this business"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="businessName">
                            Business/Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="businessName"
                            name="businessName"
                            value={formData.businessName}
                            onChange={handleInputChange}
                            required
                            placeholder="Business name or personal name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">
                                Email
                            </Label>
                            <Input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="contact@example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">
                                Phone
                            </Label>
                            <Input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>
                    </div>

                    <div className="border border-border rounded-lg">
                        <button
                            type="button"
                            onClick={() => toggleSection('businessInfo')}
                            className={`w-full px-4 py-3 text-left cursor-pointer bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${expandedSections.businessInfo ? 'rounded-t-lg' : 'rounded-lg'}`}
                        >
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-foreground">Business Info</h4>
                                <svg
                                    className={`w-5 h-5 text-muted-foreground transform transition-transform ${expandedSections.businessInfo ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>
                        {expandedSections.businessInfo && (
                            <div className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="address">
                                        Address
                                    </Label>
                                    <Input
                                        type="text"
                                        id="address"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        placeholder="Street address"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="city">
                                            City
                                        </Label>
                                        <Input
                                            type="text"
                                            id="city"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            placeholder="City"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>
                                            State/ZIP
                                        </Label>
                                        <div className="flex space-x-2 w-full">
                                            <Input
                                                type="text"
                                                id="state"
                                                name="state"
                                                value={formData.state}
                                                onChange={handleInputChange}
                                                className="flex-1 min-w-0"
                                                placeholder="State"
                                            />
                                            <Input
                                                type="text"
                                                id="zip"
                                                name="zip"
                                                value={formData.zip}
                                                onChange={handleInputChange}
                                                className="w-20 flex-shrink-0"
                                                placeholder="ZIP"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="country">
                                            Country
                                        </Label>
                                        <Input
                                            type="text"
                                            id="country"
                                            name="country"
                                            value={formData.country}
                                            onChange={handleInputChange}
                                            placeholder="Country"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="registrationNumber">
                                            Reg. Number
                                        </Label>
                                        <Input
                                            type="text"
                                            id="registrationNumber"
                                            name="registrationNumber"
                                            value={formData.registrationNumber}
                                            onChange={handleInputChange}
                                            placeholder="Company registration"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="vat">
                                            VAT
                                        </Label>
                                        <Input
                                            type="text"
                                            id="vat"
                                            name="vat"
                                            value={formData.vat}
                                            onChange={handleInputChange}
                                            placeholder="VAT number"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="taxNumber">
                                            Tax Number
                                        </Label>
                                        <Input
                                            type="text"
                                            id="taxNumber"
                                            name="taxNumber"
                                            value={formData.taxNumber}
                                            onChange={handleInputChange}
                                            placeholder="Tax ID"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Custom Fields */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h5 className="text-sm font-medium text-foreground">Custom Fields</h5>
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
                                    variant="outline"
                                    size="icon"
                                    onClick={() => removeCustomField(index)}
                                    className="hover:bg-accent hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {formData.custom.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">
                            No custom fields added. Click "Add Field" to add custom business details.
                        </p>
                    )}
                </div>

                {/* Tax Settings */}
                <div className="space-y-4">
                    <div className="border-t pt-4">
                        <h5 className="text-sm font-medium text-foreground mb-3">Tax Settings</h5>
                        
                        <div className="flex items-center space-x-3 mb-4">
                            <CustomCheckbox
                                checked={formData.taxEnabled}
                                onChange={(checked) => setFormData(prev => ({ ...prev, taxEnabled: checked }))}
                                label="Enable tax for this business"
                                labelClassName="text-sm font-medium text-foreground"
                                id="taxEnabled"
                            />
                        </div>

                        {formData.taxEnabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="taxLabel">
                                        Tax Label
                                    </Label>
                                    <Select
                                        value={formData.taxLabel}
                                        onValueChange={(value) => handleInputChange({ target: { name: 'taxLabel', value } })}
                                    >
                                        <SelectTrigger id="taxLabel">
                                            <SelectValue placeholder="Select tax label" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="VAT">VAT</SelectItem>
                                            <SelectItem value="GST">GST</SelectItem>
                                            <SelectItem value="MOMS">MOMS</SelectItem>
                                            <SelectItem value="BTW">BTW</SelectItem>
                                            <SelectItem value="Tax">Tax</SelectItem>
                                            <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="taxRate">
                                        Tax Rate (%)
                                    </Label>
                                    <Input
                                        type="number"
                                        id="taxRate"
                                        name="taxRate"
                                        value={formData.taxRate}
                                        onChange={handleInputChange}
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default BusinessModal;
