import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { generateId } from '../../utils/idUtils';
import { useToast } from '../../hooks/useToast';
import CustomCheckbox from '../CustomCheckbox';

/**
 * BusinessModal - Modal for creating and editing business information
 */
const BusinessModal = ({
    isOpen,
    onClose,
    businessInfos,
    setBusinessInfos,
    editingBusinessInfo = null
}) => {
    const { showSuccess } = useToast();
    
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
            const updatedBusinessInfos = businessInfos.map(info =>
                info.id === editingBusinessInfo.id
                    ? {
                        ...info,
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
                    }
                    : info
            );

            // If this business info is set as default, remove default from others
            let finalUpdatedBusinessInfos = updatedBusinessInfos;
            if (formData.isDefault) {
                finalUpdatedBusinessInfos = updatedBusinessInfos.map(info => ({
                    ...info,
                    isDefault: info.id === editingBusinessInfo.id
                }));
            }

            setBusinessInfos(finalUpdatedBusinessInfos);
            showSuccess('Business info updated successfully');
        } else {
            // Create new business info
            const newBusinessInfo = {
                id: generateId(),
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
                taxRate: parseFloat(formData.taxRate) || 0,
                createdAt: Date.now()
            };

            let updatedBusinessInfos = [...businessInfos, newBusinessInfo];

            // If this business info is set as default, remove default from others
            if (formData.isDefault) {
                updatedBusinessInfos = updatedBusinessInfos.map(info => ({
                    ...info,
                    isDefault: info.id === newBusinessInfo.id
                }));
            }

            setBusinessInfos(updatedBusinessInfos);
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
                    form="business-form"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    {editingBusinessInfo ? 'Update' : 'Create'} Business
                </button>
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
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                            Business Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                            placeholder="Enter title for this business info"
                        />
                    </div>

                    <div>
                        <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                            Business/Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="businessName"
                            name="businessName"
                            value={formData.businessName}
                            onChange={handleInputChange}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                            placeholder="Business name or personal name"
                        />
                    </div>

                    <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                            Address
                        </label>
                        <input
                            type="text"
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                            placeholder="Street address"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                                City
                            </label>
                            <input
                                type="text"
                                id="city"
                                name="city"
                                value={formData.city}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="City"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                State/ZIP
                            </label>
                            <div className="flex space-x-2 w-full">
                                <input
                                    type="text"
                                    id="state"
                                    name="state"
                                    value={formData.state}
                                    onChange={handleInputChange}
                                    className="mt-1 flex-1 min-w-0 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="State"
                                />
                                <input
                                    type="text"
                                    id="zip"
                                    name="zip"
                                    value={formData.zip}
                                    onChange={handleInputChange}
                                    className="mt-1 w-20 flex-shrink-0 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="ZIP"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                                Country
                            </label>
                            <input
                                type="text"
                                id="country"
                                name="country"
                                value={formData.country}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="Country"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700">
                                Reg. Number
                            </label>
                            <input
                                type="text"
                                id="registrationNumber"
                                name="registrationNumber"
                                value={formData.registrationNumber}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="Company registration"
                            />
                        </div>

                        <div>
                            <label htmlFor="vat" className="block text-sm font-medium text-gray-700">
                                VAT
                            </label>
                            <input
                                type="text"
                                id="vat"
                                name="vat"
                                value={formData.vat}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="VAT number"
                            />
                        </div>

                        <div>
                            <label htmlFor="taxNumber" className="block text-sm font-medium text-gray-700">
                                Tax Number
                            </label>
                            <input
                                type="text"
                                id="taxNumber"
                                name="taxNumber"
                                value={formData.taxNumber}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="Tax ID"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="contact@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                Phone
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>
                    </div>
                </div>

                {/* Custom Fields */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h5 className="text-sm font-medium text-gray-900">Custom Fields</h5>
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
                            No custom fields added. Click "Add Field" to add custom business details.
                        </p>
                    )}
                </div>

                {/* Tax Settings */}
                <div className="space-y-4">
                    <div className="border-t pt-4">
                        <h5 className="text-sm font-medium text-gray-900 mb-3">Tax Settings</h5>
                        
                        <div className="flex items-center space-x-3 mb-4">
                            <CustomCheckbox
                                checked={formData.taxEnabled}
                                onChange={(checked) => setFormData(prev => ({ ...prev, taxEnabled: checked }))}
                                label="Enable tax for this business"
                                labelClassName="text-sm font-medium text-gray-700"
                                id="taxEnabled"
                            />
                        </div>

                        {formData.taxEnabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="taxLabel" className="block text-sm font-medium text-gray-700">
                                        Tax Label
                                    </label>
                                    <select
                                        id="taxLabel"
                                        name="taxLabel"
                                        value={formData.taxLabel}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    >
                                        <option value="VAT">VAT</option>
                                        <option value="GST">GST</option>
                                        <option value="MOMS">MOMS</option>
                                        <option value="BTW">BTW</option>
                                        <option value="Tax">Tax</option>
                                        <option value="Sales Tax">Sales Tax</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700">
                                        Tax Rate (%)
                                    </label>
                                    <input
                                        type="number"
                                        id="taxRate"
                                        name="taxRate"
                                        value={formData.taxRate}
                                        onChange={handleInputChange}
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
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
