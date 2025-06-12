import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { generateId } from '../../utils/idUtils';
import { useToast } from '../../hooks/useToast';
import CustomCheckbox from '../CustomCheckbox';
import { getPreferredCurrency, getCurrencyOptions } from '../../utils/currencyUtils';
import Modal from '../Modal';

/**
 * ClientModal component - Modal for creating and editing clients
 */
const ClientModal = ({
    isOpen,
    onClose,
    clients,
    setClients,
    editingClient
}) => {
    const { showSuccess } = useToast();

    const [formData, setFormData] = useState({
        title: '',
        clientName: '',
        contactPerson: '',
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
        disableTax: false,
        defaultCurrency: getPreferredCurrency(),
        hourlyRate: '',
        flatRate: false
    });

    // Initialize form data when editing
    useEffect(() => {
        if (editingClient) {
            setFormData({
                title: editingClient.title,
                clientName: editingClient.clientName || '',
                contactPerson: editingClient.contactPerson || '',
                address: editingClient.address || '',
                city: editingClient.city || '',
                state: editingClient.state || '',
                zip: editingClient.zip || '',
                country: editingClient.country || '',
                registrationNumber: editingClient.registrationNumber || '',
                vat: editingClient.vat || '',
                taxNumber: editingClient.taxNumber || '',
                email: editingClient.email || '',
                phone: editingClient.phone || '',
                custom: editingClient.custom || [],
                disableTax: editingClient.disableTax || false,
                defaultCurrency: editingClient.defaultCurrency || getPreferredCurrency(),
                hourlyRate: editingClient.hourlyRate ? editingClient.hourlyRate.toString() : '',
                flatRate: editingClient.flatRate || false
            });
        } else {
            // Reset form for new client
            setFormData({
                title: '',
                clientName: '',
                contactPerson: '',
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
                disableTax: false,
                defaultCurrency: getPreferredCurrency(),
                hourlyRate: '',
                flatRate: false
            });
        }
    }, [editingClient]);

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
     * Create a new client
     */
    const handleCreateClient = (e) => {
        e.preventDefault();

        if (!formData.title) {
            return; // Title is required
        }

        if (!formData.clientName) {
            return; // Business name is required
        }

        if (!formData.flatRate && (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0)) {
            return; // Hourly rate is required when not using flat rate
        }

        const newClient = {
            id: generateId(),
            title: formData.title,
            clientName: formData.clientName,
            contactPerson: formData.contactPerson,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            country: formData.country,
            registrationNumber: formData.registrationNumber,
            vat: formData.vat,
            taxNumber: formData.taxNumber,
            email: formData.email,
            phone: formData.phone,
            custom: formData.custom,
            disableTax: formData.disableTax,
            defaultCurrency: formData.defaultCurrency,
            hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
            flatRate: formData.flatRate || false,
            createdAt: Date.now(),
            archived: false
        };

        setClients([...clients, newClient]);
        showSuccess('Client created successfully!');
        onClose();
    };

    /**
     * Update an existing client
     */
    const handleUpdateClient = (e) => {
        e.preventDefault();

        if (!formData.title) {
            return; // Title is required
        }

        if (!formData.clientName) {
            return; // Business name is required
        }

        if (!formData.flatRate && (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0)) {
            return; // Hourly rate is required when not using flat rate
        }

        const updatedClients = clients.map(client =>
            client.id === editingClient.id
                ? {
                    ...client,
                    title: formData.title,
                    clientName: formData.clientName,
                    contactPerson: formData.contactPerson,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                    country: formData.country,
                    registrationNumber: formData.registrationNumber,
                    vat: formData.vat,
                    taxNumber: formData.taxNumber,
                    email: formData.email,
                    phone: formData.phone,
                    custom: formData.custom,
                    disableTax: formData.disableTax,
                    defaultCurrency: formData.defaultCurrency,
                    hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
                    flatRate: formData.flatRate || false,
                    updatedAt: Date.now()
                }
                : client
        );

        setClients(updatedClients);
        showSuccess('Client updated successfully!');
        onClose();
    };

    const footer = (
        <div className="flex justify-end space-x-3">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                Cancel
            </button>

            <button
                type="submit"
                form="client-form"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                {editingClient ? 'Update' : 'Create'} Client
            </button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingClient ? 'Edit Client' : 'Create New Client'}
            size="3xl"
            footer={footer}
        >
            <form 
                id="client-form"
                onSubmit={editingClient ? handleUpdateClient : handleCreateClient} 
                className="space-y-6">

                <div className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                            Client Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                            placeholder="Enter title for this client"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
                                Business/Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="clientName"
                                name="clientName"
                                value={formData.clientName}
                                onChange={handleInputChange}
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="Business name or personal name"
                            />
                        </div>

                        <div>
                            <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700">
                                Contact Person
                            </label>
                            <input
                                type="text"
                                id="contactPerson"
                                name="contactPerson"
                                value={formData.contactPerson}
                                onChange={handleInputChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="Primary contact person"
                            />
                        </div>
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
                                No custom fields added. Click "Add Field" to add custom client details.
                            </p>
                        )}
                    </div>
                </div>

                {/* Default Currency */}
                <div className="space-y-4">
                    <div className="border-t pt-6">
                        <label htmlFor="defaultCurrency" className="block text-sm font-medium text-gray-900 mb-2">
                            Default Currency
                        </label>
                        <select
                            id="defaultCurrency"
                            name="defaultCurrency"
                            value={formData.defaultCurrency}
                            onChange={handleInputChange}
                            className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                        >
                            {getCurrencyOptions().map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-gray-500">
                            This currency will be used as the default for new projects and invoices for this client.
                        </p>
                    </div>
                </div>

                {/* Pricing & Taxes */}
                <div className="space-y-4">
                    <div className="border-t pt-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Pricing & Taxes</h4>

                        {/* Rate Section */}
                        <div className="space-y-4 mb-4">
                            <div className="flex items-center space-x-3 mb-4">
                                <CustomCheckbox
                                    checked={formData.flatRate}
                                    onChange={(checked) => setFormData(prev => ({ ...prev, flatRate: checked }))}
                                    label="Flat rate client (non-hourly basis)"
                                    labelClassName="text-sm font-medium text-gray-700"
                                    id="flatRate"
                                />
                            </div>

                            <div className={formData.flatRate ? "hidden" : ""}>
                                <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">
                                    Hourly Rate <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    id="hourlyRate"
                                    name="hourlyRate"
                                    value={formData.hourlyRate}
                                    onChange={handleInputChange}
                                    min="0"
                                    step="0.01"
                                    required={!formData.flatRate}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="0.00"
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    Default hourly rate for projects with this client. Can be overridden per project.
                                </p>
                            </div>
                        </div>

                        {/* Tax Settings */}
                        <div className="flex items-center space-x-3">
                            <CustomCheckbox
                                checked={formData.disableTax}
                                onChange={(checked) => setFormData(prev => ({ ...prev, disableTax: checked }))}
                                label="Disable tax for this client"
                                labelClassName="text-sm font-medium text-gray-700"
                                id="disableTax"
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            When enabled, this client will not have tax applied to their invoices, regardless of business tax settings.
                        </p>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default ClientModal;