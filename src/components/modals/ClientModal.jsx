import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { generateSlugId } from '../../utils/idUtils';
import { useToast } from '../../hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
            id: generateSlugId(formData.title),
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
            <Button
                type="button"
                variant="outline"
                onClick={onClose}
            >
                Cancel
            </Button>

            <Button
                type="submit"
                form="client-form"
            >
                {editingClient ? 'Update' : 'Create'} Client
            </Button>
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
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Client Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            required
                            placeholder="Enter title for this client"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="clientName">
                                Business/Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                id="clientName"
                                name="clientName"
                                value={formData.clientName}
                                onChange={handleInputChange}
                                required
                                placeholder="Business name or personal name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactPerson">
                                Contact Person
                            </Label>
                            <Input
                                type="text"
                                id="contactPerson"
                                name="contactPerson"
                                value={formData.contactPerson}
                                onChange={handleInputChange}
                                placeholder="Primary contact person"
                            />
                        </div>
                    </div>

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
                                        className="hover:bg-accent hover:text-red-600 dark:hover:text-red-400 hover:border-red-300"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {formData.custom.length === 0 && (
                            <p className="text-sm text-muted-foreground italic">
                                No custom fields added. Click "Add Field" to add custom client details.
                            </p>
                        )}
                    </div>
                </div>

                {/* Default Currency */}
                <div className="space-y-4">
                    <div className="border-t pt-6">
                        <Label htmlFor="defaultCurrency" className="mb-2">
                            Default Currency
                        </Label>
                        <select
                            id="defaultCurrency"
                            name="defaultCurrency"
                            value={formData.defaultCurrency}
                            onChange={handleInputChange}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                        >
                            {getCurrencyOptions().map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-muted-foreground">
                            This currency will be used as the default for new projects and invoices for this client.
                        </p>
                    </div>
                </div>

                {/* Pricing & Taxes */}
                <div className="space-y-4">
                    <div className="border-t pt-6">
                        <h4 className="text-sm font-medium text-foreground mb-3">Pricing & Taxes</h4>

                        {/* Rate Section */}
                        <div className="space-y-4 mb-4">
                            <div className="flex items-center space-x-3 mb-4">
                                <CustomCheckbox
                                    checked={formData.flatRate}
                                    onChange={(checked) => setFormData(prev => ({ ...prev, flatRate: checked }))}
                                    label="Flat rate client (non-hourly basis)"
                                    labelClassName="text-sm font-medium text-foreground"
                                    id="flatRate"
                                />
                            </div>

                            <div className={formData.flatRate ? "hidden" : "space-y-2"}>
                                <Label htmlFor="hourlyRate">
                                    Hourly Rate <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="number"
                                    id="hourlyRate"
                                    name="hourlyRate"
                                    value={formData.hourlyRate}
                                    onChange={handleInputChange}
                                    min="0"
                                    step="0.01"
                                    required={!formData.flatRate}
                                    placeholder="0.00"
                                />
                                <p className="text-xs text-muted-foreground">
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
                                labelClassName="text-sm font-medium text-foreground"
                                id="disableTax"
                            />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            When enabled, this client will not have tax applied to their invoices, regardless of business tax settings.
                        </p>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default ClientModal;