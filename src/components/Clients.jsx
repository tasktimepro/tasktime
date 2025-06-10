import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, PencilIcon, EllipsisHorizontalIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useToast } from '../hooks/useToast';
import { generateId } from '../utils/idUtils';

/**
 * Clients component for managing client information
 */
const Clients = ({ 
    clients, 
    setClients,
    autoOpenCreate = false
}) => {
    const { showSuccess, showError } = useToast();
    
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [showDropdown, setShowDropdown] = useState({});
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
        custom: []
    });

    // Add event listener for dropdown close behavior
    const DROPDOWN_TOGGLE_EVENT = 'closeOtherDropdowns';

    useEffect(() => {
        const handleCloseDropdowns = (event) => {
            const { clientId, open } = event.detail;
            
            if (open) {
                // Close all dropdowns except the one being opened
                setShowDropdown({ [clientId]: true });
            }
        };

        const handleClickOutside = (event) => {
            if (!event.target.closest('.dropdown-container')) {
                setShowDropdown({});
            }
        };

        document.addEventListener(DROPDOWN_TOGGLE_EVENT, handleCloseDropdowns);
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener(DROPDOWN_TOGGLE_EVENT, handleCloseDropdowns);
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    // Handle auto-opening create form
    useEffect(() => {
        if (autoOpenCreate) {
            setShowCreateForm(true);
        }
    }, [autoOpenCreate]);

    /**
     * Handle input changes
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
     * Validate email format (basic validation)
     */
    const validateEmail = (email) => {
        if (!email) return true; // Optional field
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    /**
     * Create a new client
     */
    const handleCreateClient = (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.title.trim()) {
            showError('Client title is required');
            return;
        }

        if (formData.email && !validateEmail(formData.email)) {
            showError('Please enter a valid email address');
            return;
        }

        // Check if title already exists
        const titleExists = clients.some(info => 
            info.title.toLowerCase() === formData.title.toLowerCase()
        );

        if (titleExists) {
            showError('A client with this title already exists');
            return;
        }

        const newClient = {
            id: generateId(),
            ...formData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setClients(prev => [...prev, newClient]);
        setShowCreateForm(false);

        // Reset form
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
            custom: []
        });

        showSuccess('Client created successfully');
    };

    /**
     * Update an existing client
     */
    const handleUpdateClient = (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.title.trim()) {
            showError('Client title is required');
            return;
        }

        if (formData.email && !validateEmail(formData.email)) {
            showError('Please enter a valid email address');
            return;
        }

        // Check if title already exists (excluding current item)
        const titleExists = clients.some(info => 
            info.id !== editingClient.id && 
            info.title.toLowerCase() === formData.title.toLowerCase()
        );

        if (titleExists) {
            showError('A client with this title already exists');
            return;
        }

        const updatedClient = {
            ...editingClient,
            ...formData,
            updatedAt: new Date().toISOString()
        };

        setClients(prev => prev.map(info => 
            info.id === editingClient.id ? updatedClient : info
        ));

        setEditingClient(null);

        // Reset form
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
            custom: []
        });

        showSuccess('Client updated successfully');
    };

    /**
     * Delete a client
     */
    const handleDeleteClient = (clientId) => {
        if (window.confirm('Are you sure you want to delete this client?')) {
            setClients(prev => prev.filter(info => info.id !== clientId));
            
            // Close the edit form if the deleted item was being edited
            if (editingClient && editingClient.id === clientId) {
                setEditingClient(null);
                
                // Reset form data
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
                    custom: []
                });
            }

            showSuccess('Client deleted successfully');
        }
    };

    /**
     * Start editing a client
     */
    const startEditing = (client) => {
        setEditingClient(client);

        setFormData({
            title: client.title || '',
            clientName: client.clientName || '',
            contactPerson: client.contactPerson || '',
            address: client.address || '',
            city: client.city || '',
            state: client.state || '',
            zip: client.zip || '',
            country: client.country || '',
            registrationNumber: client.registrationNumber || '',
            vat: client.vat || '',
            taxNumber: client.taxNumber || '',
            email: client.email || '',
            phone: client.phone || '',
            custom: [...(client.custom || [])]
        });

        setShowCreateForm(false);
    };

    /**
     * Cancel form actions
     */
    const cancelForm = () => {
        setShowCreateForm(false);

        setEditingClient(null);

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
            custom: []
        });
    };

    return (
        <div className={`${(showCreateForm || editingClient) ? 'space-y-8' : 'space-y-6'}`}>
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Manage client information for your invoices
                    </p>
                </div>

                <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Client
                </button>
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingClient) && (
                <div className="bg-white shadow rounded-lg p-6 max-w-3xl mx-auto">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                        {editingClient ? 'Edit Client' : 'New Client'}
                    </h4>

                    <form onSubmit={editingClient ? handleUpdateClient : handleCreateClient} className="space-y-8">
                        {/* Standard Fields */}
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

                            <div>
                                <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
                                    Client/Company Name
                                </label>

                                <input
                                    type="text"
                                    id="clientName"
                                    name="clientName"
                                    value={formData.clientName}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="Client name or company name"
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
                                        Reg. Number <span className="text-gray-400 font-normal">(optional)</span>
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
                                        VAT <span className="text-gray-400 font-normal">(optional)</span>
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
                                        Tax Number <span className="text-gray-400 font-normal">(optional)</span>
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
                                        Email <span className="text-gray-400 font-normal">(optional)</span>
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
                                        Phone <span className="text-gray-400 font-normal">(optional)</span>
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
                                    No custom fields added. Click "Add Field" to add custom client details.
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
                                {editingClient ? 'Update' : 'Create'} Client
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Client List */}
            {clients.length === 0 ? (
                <div className="text-center py-12">
                    <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h4 className="mt-2 text-sm font-medium text-gray-900">No clients</h4>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first client.</p>

                    <div className="mt-6">
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            New Client
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {clients.map((info) => (
                        <div
                            key={info.id}
                            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow"
                        >
                            <div className="p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <UserGroupIcon className="h-6 w-6 text-gray-400" />
                                            <div>
                                                <h4 className="text-lg font-medium text-gray-900">
                                                    {info.title || info.name}
                                                </h4>
                                                <div className="mt-1 text-sm text-gray-500 space-y-1">
                                                    {info.clientName && <p>Client/Company: {info.clientName}</p>}
                                                    {info.contactPerson && <p>Contact Person: {info.contactPerson}</p>}
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
                                                    detail: { clientId: info.id, open: newState }
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
                                                            handleDeleteClient(info.id);
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

export default Clients;
