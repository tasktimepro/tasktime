import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, EllipsisHorizontalIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { generateId } from '../utils/idUtils';
import { useToast } from '../hooks/useToast';
import CustomCheckbox from './CustomCheckbox';

// Event name for dropdown coordination
const DROPDOWN_TOGGLE_EVENT = 'business-dropdown-toggle';

/**
 * BusinessInfo component - Manages global business information for invoices
 */
const BusinessInfo = ({ 
    businessInfos, 
    setBusinessInfos,
    autoOpenCreate = false
}) => {
    const [showCreateForm, setShowCreateForm] = useState(autoOpenCreate);
    const [editingBusinessInfo, setEditingBusinessInfo] = useState(null);
    const [showDropdown, setShowDropdown] = useState({}); // Track dropdown states by business info ID
    const { showSuccess } = useToast();

    // Auto-open create form when autoOpenCreate prop changes
    useEffect(() => {
        if (autoOpenCreate && !showCreateForm && !editingBusinessInfo) {
            setShowCreateForm(true);
        }
    }, [autoOpenCreate, showCreateForm, editingBusinessInfo]);

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

    // Close dropdown when clicking outside or when another dropdown opens
    useEffect(() => {
        const handleDropdownToggle = (event) => {
            const { businessId, open } = event.detail;
            if (!open) {
                // Close all dropdowns when any dropdown is closed
                setShowDropdown({});
            } else {
                // Close other dropdowns when a new one opens
                setShowDropdown({ [businessId]: true });
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
     * Validate email format (basic validation)
     */
    const validateEmail = (email) => {
        if (!email) return true; // Email is optional
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    /**
     * Create a new business info
     */
    const handleCreateBusinessInfo = (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            return;
        }

        if (!formData.businessName.trim()) {
            return;
        }

        // Validate email if provided
        if (formData.email && !validateEmail(formData.email)) {
            showSuccess('Please enter a valid email format', 'error');
            return;
        }

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

        setShowCreateForm(false);

        showSuccess('Business info created successfully');
    };

    /**
     * Update an existing business info
     */
    const handleUpdateBusinessInfo = (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            return;
        }

        if (!formData.businessName.trim()) {
            return;
        }

        // Validate email if provided
        if (formData.email && !validateEmail(formData.email)) {
            showSuccess('Please enter a valid email format', 'error');
            return;
        }

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

        setEditingBusinessInfo(null);

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

        showSuccess('Business info updated successfully');
    };

    /**
     * Delete a business info
     */
    const handleDeleteBusinessInfo = (businessInfoId) => {
        if (window.confirm('Are you sure you want to delete this business info?')) {
            setBusinessInfos(businessInfos.filter(info => info.id !== businessInfoId));
            
            // Close the edit form if the deleted item was being edited
            if (editingBusinessInfo && editingBusinessInfo.id === businessInfoId) {
                setEditingBusinessInfo(null);
                
                // Reset form data
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

            showSuccess('Business info deleted successfully');
        }
    };

    /**
     * Start editing a business info
     */
    const startEditing = (businessInfo) => {
        setEditingBusinessInfo(businessInfo);

        setFormData({
            title: businessInfo.title || '',
            businessName: businessInfo.businessName || '',
            address: businessInfo.address || '',
            city: businessInfo.city || '',
            state: businessInfo.state || '',
            zip: businessInfo.zip || '',
            country: businessInfo.country || '',
            registrationNumber: businessInfo.registrationNumber || '',
            vat: businessInfo.vat || '',
            taxNumber: businessInfo.taxNumber || '',
            email: businessInfo.email || '',
            phone: businessInfo.phone || '',
            custom: [...(businessInfo.custom || [])],
            isDefault: businessInfo.isDefault || false,
            taxEnabled: businessInfo.taxEnabled || false,
            taxLabel: businessInfo.taxLabel || 'VAT',
            taxRate: businessInfo.taxRate || 0
        });

        setShowCreateForm(false);
    };

    /**
     * Cancel form actions
     */
    const cancelForm = () => {
        setShowCreateForm(false);

        setEditingBusinessInfo(null);

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
    };

    return (
        <div className={`${(showCreateForm || editingBusinessInfo) ? 'space-y-8' : 'space-y-6'}`}>
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Your Business Info</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Manage sender business information for your invoices
                    </p>
                </div>

                <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Business Info
                </button>
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingBusinessInfo) && (
                <div className="bg-white shadow rounded-lg p-6 max-w-3xl mx-auto">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                        {editingBusinessInfo ? 'Edit Business Info' : 'New Business Info'}
                    </h4>

                    <form onSubmit={editingBusinessInfo ? handleUpdateBusinessInfo : handleCreateBusinessInfo} className="space-y-8">
                        {/* Standard Fields */}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                                    Business Info Title <span className="text-red-500">*</span>
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

                        <div className="flex justify-between items-center">
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
                                    onClick={cancelForm}
                                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    {editingBusinessInfo ? 'Update' : 'Create'} Business Info
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Business Info List */}
            {businessInfos.length === 0 ? (
                <div className="text-center py-12">
                    <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h4 className="mt-2 text-sm font-medium text-gray-900">No business info</h4>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first business info.</p>

                    <div className="mt-6">
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            New Business Info
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {businessInfos.map((info) => (
                        <div
                            key={info.id}
                            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow"
                        >
                            <div className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <BuildingOfficeIcon className="h-6 w-6 text-gray-400" />
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <h4 className="text-lg font-medium text-gray-900">
                                                        {info.title || info.name}
                                                    </h4>
                                                    {info.isDefault && (
                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-gray-500 space-y-1">
                                                    {info.businessName && <p>Business/Name: {info.businessName}</p>}
                                                    {info.address && <p>Address: {info.address}</p>}
                                                    {info.city && <p>City: {info.city}</p>}
                                                    {(info.state || info.zip) && (
                                                        <p>State/ZIP: {`${info.state || ''} ${info.zip || ''}`.trim()}</p>
                                                    )}
                                                    {info.country && <p>Country: {info.country}</p>}
                                                    {info.registrationNumber && <p>Registration: {info.registrationNumber}</p>}
                                                    {info.vat && <p>VAT: {info.vat}</p>}
                                                    {info.taxNumber && <p>Tax Number: {info.taxNumber}</p>}
                                                    {info.email && <p>Email: {info.email}</p>}
                                                    {info.phone && <p>Phone: {info.phone}</p>}
                                                    {info.custom && info.custom.length > 0 && (
                                                        <div className="space-y-1">
                                                            {info.custom.map((field, index) => (
                                                                <p key={index}>{field.label}: {field.value}</p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="mt-2 text-xs text-gray-400">
                                                    Created {new Date(info.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <div className="relative dropdown-container">
                                        <button
                                            onClick={() => {
                                                const newState = !showDropdown[info.id];
                                                setShowDropdown(newState ? { [info.id]: true } : {});

                                                // Dispatch a custom event to close other dropdowns
                                                const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                    detail: { businessId: info.id, open: newState }
                                                });
                                                document.dispatchEvent(event);
                                            }}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                            title="More actions"
                                        >
                                            <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                        </button>

                                        {showDropdown[info.id] && (
                                            <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            startEditing(info);
                                                            setShowDropdown({});
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors space-x-2"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleDeleteBusinessInfo(info.id);
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

export default BusinessInfo;
