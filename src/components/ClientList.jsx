import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import Modal from './Modal';
import { PlusIcon, PencilIcon, TrashIcon, EllipsisHorizontalIcon, ArchiveBoxIcon, ChevronDownIcon, ChevronRightIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { generateId } from '../utils/idUtils';
import { useToast } from '../hooks/useToast';
import CustomCheckbox from './CustomCheckbox';
import { getPreferredCurrency, getCurrencyOptions } from '../utils/currencyUtils';

// Event name for dropdown coordination
const DROPDOWN_TOGGLE_EVENT = 'dropdown-toggle';

/**
 * ClientList component - Displays and manages the list of clients
 */
const ClientList = ({ 
    clients, 
    setClients, 
    projects = [],
    setProjects,
    tasks = [], 
    setTasks, 
    timeEntries = [], 
    setTimeEntries, 
    invoices = [],
    setInvoices,
    onSelectClient,
    showCreateForm: initialShowCreateForm = false
}) => {
    const [showCreateForm, setShowCreateForm] = useState(initialShowCreateForm);
    const [editingClient, setEditingClient] = useState(null);
    const [showDropdown, setShowDropdown] = useState({}); // Track dropdown states by client ID
    const [showArchivedClients, setShowArchivedClients] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [clientToDelete, setClientToDelete] = useState(null);
    const [showArchiveProjectsModal, setShowArchiveProjectsModal] = useState(false);
    const [relatedProjects, setRelatedProjects] = useState([]);
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

    // Update showCreateForm when the prop changes
    useEffect(() => {
        // If initialShowCreateForm becomes true, show the form
        if (initialShowCreateForm) {
            setShowCreateForm(true);
        }
    }, [initialShowCreateForm]);
    
    // Close dropdown when clicking outside or when another dropdown opens
    useEffect(() => {
        const handleDropdownToggle = (event) => {
            const { taskId, open } = event.detail;
            if (!open) {
                // Close all dropdowns when any dropdown is closed
                setShowDropdown({});
            } else {
                // Close other dropdowns when a new one opens
                setShowDropdown({ [taskId]: true });
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

        setShowCreateForm(false);
        showSuccess('Client created successfully!');
    };

    /**
     * Update an existing client
     */
    const handleUpdateClient = (e) => {
        e.preventDefault();

        if (!formData.title) {
            return; // Title is required
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
            custom: [],
            disableTax: false,
            defaultCurrency: getPreferredCurrency(),
            hourlyRate: '',
            flatRate: false
        });

        showSuccess('Client updated successfully!');
    };

    /**
     * Get related projects for a client
     */
    const getRelatedProjects = (clientId) => {
        return projects.filter(project => project.preferredClientId === clientId);
    };

    /**
     * Handle client deletion - check for projects first
     */
    const handleDeleteClient = (clientId) => {
        const related = getRelatedProjects(clientId);
        if (related.length > 0) {
            setRelatedProjects(related);
            setClientToDelete(clients.find(c => c.id === clientId));
            setShowDeleteModal(true);
        } else {
            // No related projects, can delete directly
            performClientDeletion(clientId, false);
        }
    };

    /**
     * Handle archive client
     */
    const handleArchiveClient = (clientId) => {
        const related = getRelatedProjects(clientId);
        if (related.length > 0) {
            setRelatedProjects(related);
            setClientToDelete(clients.find(c => c.id === clientId));
            setShowArchiveProjectsModal(true);
        } else {
            // No related projects, can archive directly
            performClientArchive(clientId, false);
        }
    };

    /**
     * Perform actual client deletion
     */
    const performClientDeletion = (clientId, alsoDeleteProjects) => {
        if (alsoDeleteProjects) {
            // Get related projects and their task/time entry IDs
            const relatedProjectIds = getRelatedProjects(clientId).map(p => p.id);
            
            // Delete related projects
            setProjects(projects.filter(project => !relatedProjectIds.includes(project.id)));
            
            // Delete tasks for related projects
            const relatedTaskIds = tasks.filter(task => relatedProjectIds.includes(task.projectId)).map(t => t.id);
            setTasks(tasks.filter(task => !relatedTaskIds.includes(task.id)));
            
            // Delete time entries for related tasks
            setTimeEntries(timeEntries.filter(entry => !relatedTaskIds.includes(entry.taskId)));
            
            // Delete invoices for related projects
            setInvoices(invoices.filter(invoice => !relatedProjectIds.includes(invoice.projectId)));
        } else {
            // Remove client reference from projects
            setProjects(projects.map(project => 
                project.preferredClientId === clientId 
                    ? { ...project, preferredClientId: null }
                    : project
            ));
        }

        // Remove the client
        setClients(clients.filter(client => client.id !== clientId));
        
        // Close the edit form if the deleted client was being edited
        if (editingClient && editingClient.id === clientId) {
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
                custom: [],
                disableTax: false,
                defaultCurrency: getPreferredCurrency(),
                hourlyRate: '',
                flatRate: false
            });
        }

        // Show appropriate success message
        const message = alsoDeleteProjects 
            ? `Client and ${relatedProjects.length} related project(s) deleted successfully.`
            : 'Client deleted successfully.';
        showSuccess(message);
    };

    /**
     * Perform actual client archive
     */
    const performClientArchive = (clientId, alsoArchiveProjects) => {
        if (alsoArchiveProjects) {
            // Archive related projects
            const relatedProjectIds = getRelatedProjects(clientId).map(p => p.id);
            setProjects(projects.map(project => 
                relatedProjectIds.includes(project.id)
                    ? { ...project, archived: true }
                    : project
            ));
        }

        // Archive the client
        const updatedClients = clients.map(client =>
            client.id === clientId ? { ...client, archived: true } : client
        );
        setClients(updatedClients);

        // Show appropriate success message
        const message = alsoArchiveProjects 
            ? `Client and ${relatedProjects.length} related project(s) archived successfully.`
            : 'Client archived successfully.';
        showSuccess(message);
    };

    /**
     * Start editing a client
     */
    const startEditing = (client) => {
        setEditingClient(client);

        setFormData({
            title: client.title,
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
            custom: client.custom || [],
            disableTax: client.disableTax || false,
            defaultCurrency: client.defaultCurrency || getPreferredCurrency(),
            hourlyRate: client.hourlyRate ? client.hourlyRate.toString() : '',
            flatRate: client.flatRate || false
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
            custom: [],
            disableTax: false,
            defaultCurrency: getPreferredCurrency(),
            hourlyRate: '',
            flatRate: false
        });
    };

    /**
     * Unarchive a client
     */
    const handleUnarchiveClient = (clientId) => {
        const updatedClients = clients.map(client =>
            client.id === clientId ? { ...client, archived: false } : client
        );
        setClients(updatedClients);
        showSuccess('Client unarchived successfully!');
    };

    /**
     * Confirm client deletion (for direct deletion without projects)
     */
    const confirmDeleteClient = () => {
        if (clientToDelete) {
            performClientDeletion(clientToDelete.id, false);
            setClientToDelete(null);
        }
        setShowDeleteModal(false);
    };

    /**
     * Handle force delete client with projects
     */
    const handleForceDelete = () => {
        if (clientToDelete) {
            performClientDeletion(clientToDelete.id, true);
            setShowDeleteModal(false);
            setClientToDelete(null);
            setRelatedProjects([]);
        }
    };

    /**
     * Handle archive client from modal
     */
    const handleArchiveFromModal = () => {
        if (clientToDelete) {
            performClientArchive(clientToDelete.id, false);
            setShowArchiveProjectsModal(false);
            setClientToDelete(null);
            setRelatedProjects([]);
        }
    };

    /**
     * Handle archive client with projects
     */
    const handleArchiveWithProjects = () => {
        if (clientToDelete) {
            performClientArchive(clientToDelete.id, true);
            setShowArchiveProjectsModal(false);
            setClientToDelete(null);
            setRelatedProjects([]);
        }
    };

    /**
     * Handle cancel delete modal
     */
    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setShowArchiveProjectsModal(false);
        setClientToDelete(null);
        setRelatedProjects([]);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                    Clients {clients.filter(c => !c.archived).length > 0 && (
                        <span>
                            ({clients.filter(c => !c.archived).length})
                        </span>
                    )}
                </h2>

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
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {editingClient ? 'Edit Client' : 'Create New Client'}
                    </h3>

                    <form onSubmit={editingClient ? handleUpdateClient : handleCreateClient} className="space-y-6">
                        
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
                                    placeholder="Enter client title"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
                                        Client Name/Business Name
                                    </label>
                                    <input
                                        type="text"
                                        id="clientName"
                                        name="clientName"
                                        value={formData.clientName}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                        placeholder="Company/Organization name"
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
                                <textarea
                                    id="address"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    rows={2}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    placeholder="Street address"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                    />
                                </div>

                                <div>
                                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                                        State/Province
                                    </label>
                                    <input
                                        type="text"
                                        id="state"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="zip" className="block text-sm font-medium text-gray-700">
                                        ZIP/Postal Code
                                    </label>
                                    <input
                                        type="text"
                                        id="zip"
                                        name="zip"
                                        value={formData.zip}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    />
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
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700">
                                        Registration Number
                                    </label>
                                    <input
                                        type="text"
                                        id="registrationNumber"
                                        name="registrationNumber"
                                        value={formData.registrationNumber}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="vat" className="block text-sm font-medium text-gray-700">
                                        VAT Number
                                    </label>
                                    <input
                                        type="text"
                                        id="vat"
                                        name="vat"
                                        value={formData.vat}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
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
                                    />
                                </div>
                            </div>

                            {/* Custom Fields */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-gray-700">Custom Fields</h4>
                                    <button
                                        type="button"
                                        onClick={addCustomField}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        + Add Field
                                    </button>
                                </div>

                                {formData.custom.map((field, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Field Label
                                            </label>
                                            <input
                                                type="text"
                                                value={field.label}
                                                onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                                placeholder="Field name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Field Value
                                            </label>
                                            <div className="flex space-x-2">
                                                <input
                                                    type="text"
                                                    value={field.value}
                                                    onChange={(e) => handleCustomFieldChange(index, 'value', e.target.value)}
                                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                                    placeholder="Field value"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomField(index)}
                                                    className="mt-1 px-3 py-1.5 text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
                                            onChange={() => setFormData(prev => ({ ...prev, flatRate: !prev.flatRate }))}
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

            {/* Clients Grid */}
            {clients.filter(c => !c.archived).length === 0 && clients.filter(c => c.archived).length === 0 ? (
                <div className="text-center py-12">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                        <UserGroupIcon className="h-12 w-12" />
                    </div>

                    <h3 className="mt-2 text-sm font-medium text-gray-900">No clients</h3>

                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new client.</p>

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
                <>
                    {/* Active Clients */}
                    {clients.filter(c => !c.archived).length > 0 && (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {clients.filter(c => !c.archived).map((client) => (
                                <div
                                    key={client.id}
                                    className="bg-white shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer relative"
                                    onClick={() => onSelectClient(client)}
                                >
                                    <div className="p-5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-medium text-gray-900 truncate">
                                                {client.title}
                                            </h3>

                                            {/* Three-dot dropdown menu for Edit and Delete */}
                                            <div className="relative dropdown-container" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => {
                                                        const newState = !showDropdown[client.id];
                                                        setShowDropdown(newState ? { [client.id]: true } : {});

                                                        // Dispatch a custom event to close other dropdowns
                                                        const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                            detail: { taskId: client.id, open: newState }
                                                        });
                                                        document.dispatchEvent(event);
                                                    }}
                                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                                    title="More actions"
                                                >
                                                    <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                                </button>

                                                {showDropdown[client.id] && (
                                                    <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                        <div className="py-1">
                                                            <button
                                                                onClick={() => {
                                                                    startEditing(client);
                                                                    setShowDropdown({});
                                                                }}
                                                                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors space-x-2"
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                                <span>Edit</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleArchiveClient(client.id);
                                                                    setShowDropdown({});
                                                                }}
                                                                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors space-x-2"
                                                            >
                                                                <ArchiveBoxIcon className="h-4 w-4" />
                                                                <span>Archive</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleDeleteClient(client.id);
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

                                        {client.clientName && (
                                            <p className="mt-2 text-sm text-gray-600">
                                                {client.clientName}
                                            </p>
                                        )}

                                        {client.contactPerson && (
                                            <p className="mt-1 text-sm text-gray-500">
                                                Contact: {client.contactPerson}
                                            </p>
                                        )}

                                        <p className="mt-1 text-xs text-gray-400">
                                            Created {new Date(client.createdAt).toLocaleDateString()}
                                        </p>

                                        {/* Show related projects count */}
                                        {(() => {
                                            const relatedProjectsCount = getRelatedProjects(client.id).length;
                                            return relatedProjectsCount > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <div className="text-xs text-gray-500">
                                                        {relatedProjectsCount} project{relatedProjectsCount !== 1 ? 's' : ''}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Archived Clients Section */}
                    {clients.filter(c => c.archived).length > 0 && (
                        <div className="border-t pt-6">
                            <button
                                onClick={() => setShowArchivedClients(!showArchivedClients)}
                                className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
                            >
                                {showArchivedClients ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Archived Clients ({clients.filter(c => c.archived).length})
                            </button>

                            {showArchivedClients && (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 opacity-75 scrollable-container">
                                    {clients.filter(c => c.archived).map((client) => (
                                        <div
                                            key={client.id}
                                            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer relative"
                                            onClick={() => onSelectClient(client)}
                                        >
                                            <div className="p-5">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-medium text-gray-900 truncate">
                                                        {client.title}
                                                    </h3>

                                                    {/* Three-dot dropdown menu for Unarchive and Delete */}
                                                    <div className="relative dropdown-container" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => {
                                                                const newState = !showDropdown[client.id];
                                                                setShowDropdown(newState ? { [client.id]: true } : {});

                                                                // Dispatch a custom event to close other dropdowns
                                                                const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                                    detail: { taskId: client.id, open: newState }
                                                                });
                                                                document.dispatchEvent(event);
                                                            }}
                                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors group"
                                                            title="More actions"
                                                        >
                                                            <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                                        </button>

                                                        {showDropdown[client.id] && (
                                                            <div className="absolute right-0 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                                <div className="py-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleUnarchiveClient(client.id);
                                                                            setShowDropdown({});
                                                                        }}
                                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors space-x-2"
                                                                    >
                                                                        <ArchiveBoxIcon className="h-4 w-4" />
                                                                        <span>Unarchive</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDeleteClient(client.id);
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

                                                {client.clientName && (
                                                    <p className="mt-2 text-sm text-gray-600">
                                                        {client.clientName}
                                                    </p>
                                                )}

                                                {client.contactPerson && (
                                                    <p className="mt-1 text-sm text-gray-500">
                                                        Contact: {client.contactPerson}
                                                    </p>
                                                )}

                                                <p className="mt-1 text-xs text-gray-400">
                                                    Created {new Date(client.createdAt).toLocaleDateString()}
                                                </p>

                                                {/* Show related projects count */}
                                                {(() => {
                                                    const relatedProjectsCount = getRelatedProjects(client.id).length;
                                                    return relatedProjectsCount > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                                            <div className="text-xs text-gray-500">
                                                                {relatedProjectsCount} project{relatedProjectsCount !== 1 ? 's' : ''}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && clientToDelete && (
                <Modal
                    isOpen={showDeleteModal}
                    onClose={handleCancelDelete}
                    title="⚠️ Client Has Related Projects"
                    size="md"
                    footer={
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={handleCancelDelete}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteClient}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                                Remove Client Reference
                            </button>
                            <button
                                onClick={handleForceDelete}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                Delete Client & Projects
                            </button>
                        </div>
                    }
                >
                    <div>
                        <p className="text-sm text-gray-700 mb-4">
                            The client "<span className="font-semibold">{clientToDelete.title}</span>" has {relatedProjects.length} related project(s):
                        </p>
                        <ul className="text-sm text-gray-600 mb-4 list-disc list-inside">
                            {relatedProjects.slice(0, 5).map(project => (
                                <li key={project.id}>{project.title}</li>
                            ))}
                            {relatedProjects.length > 5 && (
                                <li>...and {relatedProjects.length - 5} more</li>
                            )}
                        </ul>
                        <p className="text-sm text-gray-700">
                            You can remove the client reference from projects, or delete everything including the projects.
                        </p>
                    </div>
                </Modal>
            )}

            {/* Archive with Projects Modal */}
            {showArchiveProjectsModal && clientToDelete && (
                <Modal
                    isOpen={showArchiveProjectsModal}
                    onClose={handleCancelDelete}
                    title="Archive Client with Related Projects?"
                    size="md"
                    footer={
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={handleCancelDelete}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleArchiveFromModal}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Archive Client Only
                            </button>
                            <button
                                onClick={handleArchiveWithProjects}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                            >
                                Archive Client & Projects
                            </button>
                        </div>
                    }
                >
                    <div>
                        <p className="text-sm text-gray-700 mb-4">
                            The client "<span className="font-semibold">{clientToDelete.title}</span>" has {relatedProjects.length} related project(s):
                        </p>
                        <ul className="text-sm text-gray-600 mb-4 list-disc list-inside">
                            {relatedProjects.slice(0, 5).map(project => (
                                <li key={project.id}>{project.title}</li>
                            ))}
                            {relatedProjects.length > 5 && (
                                <li>...and {relatedProjects.length - 5} more</li>
                            )}
                        </ul>
                        <p className="text-sm text-gray-700">
                            Would you like to archive the related projects as well?
                        </p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

ClientList.propTypes = {
    clients: PropTypes.array.isRequired,
    setClients: PropTypes.func.isRequired,
    projects: PropTypes.array,
    setProjects: PropTypes.func,
    tasks: PropTypes.array,
    setTasks: PropTypes.func,
    timeEntries: PropTypes.array,
    setTimeEntries: PropTypes.func,
    invoices: PropTypes.array,
    setInvoices: PropTypes.func,
    onSelectClient: PropTypes.func.isRequired,
    showCreateForm: PropTypes.bool
};

export default ClientList;
