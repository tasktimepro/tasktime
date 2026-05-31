import React, { useEffect, useRef, useState } from 'react';
import Modal from '../Modal';
import { ImageIcon, PlusIcon, TrashIcon } from '@/components/ui/icons';
import { useYjs } from '@/contexts/YjsContext';
import { collectEntities } from '@/stores/yjs/entityUtils';
import { useToast } from '../../hooks/useToast.ts';
import { useBusinessBrandAssets } from '../../hooks/useBusinessBrandAssets.ts';
import { useBusinessInfos } from '../../hooks/useBusinessInfos.ts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CustomCheckbox from '../CustomCheckbox';
import { parseOptionalNumberInput } from '@/utils/numberInputUtils.ts';
import { normalizeBrandColor, prepareBusinessLogoAsset } from '@/utils/businessBranding.ts';

const createDefaultFormData = () => ({
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
    taxLabel: 'Tax',
    taxRate: 0,
    primaryColor: ''
});

const createInitialFormData = (businessInfo) => {
    if (!businessInfo) {
        return createDefaultFormData();
    }

    return {
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
        taxLabel: businessInfo.taxLabel || 'Tax',
        taxRate: businessInfo.taxRate || 0,
        primaryColor: businessInfo.branding?.primaryColor || ''
    };
};

const createInitialExpandedSections = () => ({
    businessInfo: false,
    branding: false
});

/**
 * BusinessModal - Modal for creating and editing business information
 */
const BusinessModal = ({
    isOpen,
    onClose,
    editingBusinessInfo = null
}) => {
    const { showSuccess, showError } = useToast();
    const { store, loadArchivedInvoices } = useYjs();
    const { createBusinessInfo, updateBusinessInfo, setDefault } = useBusinessInfos();
    const { createBusinessBrandAsset, deleteBusinessBrandAsset, findLogoAssetByHash, getAssetsForBusiness, getBusinessBrandAsset } = useBusinessBrandAssets();
    
    const [formData, setFormData] = useState(() => createInitialFormData(editingBusinessInfo));

    const [expandedSections, setExpandedSections] = useState(() => createInitialExpandedSections());
    const [pendingLogoAsset, setPendingLogoAsset] = useState(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
    const [removeLogo, setRemoveLogo] = useState(false);
    const [isProcessingLogo, setIsProcessingLogo] = useState(false);
    const logoInputRef = useRef(null);

    const currentLogoAsset = editingBusinessInfo?.branding?.logoAssetId
        ? getBusinessBrandAsset(editingBusinessInfo.branding.logoAssetId)
        : null;
    const selectedLogoLabel = removeLogo
        ? 'No file selected'
        : pendingLogoAsset?.fileName || currentLogoAsset?.fileName || 'No file selected';

    useEffect(() => {
        setFormData(createInitialFormData(editingBusinessInfo));
        setExpandedSections(createInitialExpandedSections());
        setPendingLogoAsset(null);
        setRemoveLogo(false);
        setLogoPreviewUrl(currentLogoAsset?.dataUrl || '');
    }, [currentLogoAsset?.dataUrl, editingBusinessInfo, isOpen]);

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

    const handlePrimaryColorChange = (value) => {
        setFormData(prev => ({
            ...prev,
            primaryColor: value
        }));
    };

    const handleLogoFileChange = async (event) => {
        const file = event.target.files?.[0];

        event.target.value = '';

        if (!file) {
            return;
        }

        setIsProcessingLogo(true);

        try {
            const asset = await prepareBusinessLogoAsset(file);
            setPendingLogoAsset(asset);
            setLogoPreviewUrl(asset.dataUrl);
            setRemoveLogo(false);
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Unable to process the selected logo.');
        } finally {
            setIsProcessingLogo(false);
        }
    };

    const handleRemoveLogo = () => {
        setPendingLogoAsset(null);
        setLogoPreviewUrl('');
        setRemoveLogo(true);
    };

    const buildBrandingPayload = (logoAssetId, primaryColor) => {
        if (!logoAssetId && !primaryColor) {
            return undefined;
        }

        return {
            primaryColor,
            logoAssetId: logoAssetId || null,
        };
    };

    const cleanupUnusedLogoAssets = async (businessInfoId, nextLogoAssetId) => {
        if (!businessInfoId) {
            return;
        }

        try {
            await loadArchivedInvoices();

            const activeInvoices = collectEntities(store.invoices);
            const archivedInvoices = store.archivedInvoicesSync
                ? collectEntities(store.archivedInvoicesSync)
                : [];
            const referencedLogoAssetIds = new Set(
                [...activeInvoices, ...archivedInvoices]
                    .map((invoice) => invoice?.brandingSnapshot?.logoAssetId)
                    .filter(Boolean)
            );
            const removableAssets = getAssetsForBusiness(businessInfoId, { includeArchived: true }).filter((asset) => {
                return asset.kind === 'logo'
                    && asset.id !== nextLogoAssetId
                    && !referencedLogoAssetIds.has(asset.id);
            });

            removableAssets.forEach((asset) => {
                deleteBusinessBrandAsset(asset.id);
            });
        } catch {
            // Preserve the retired asset if invoice reference checks are unavailable.
        }
    };

    /**
     * Handle form submission
     */
    const handleSubmit = async (e) => {
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

        const normalizedPrimaryColor = formData.primaryColor
            ? normalizeBrandColor(formData.primaryColor)
            : null;

        if (formData.primaryColor.trim() && !normalizedPrimaryColor) {
            showError('Please enter a valid hex color for the business branding.');
            return;
        }

        const basePayload = {
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
            taxRate: parseOptionalNumberInput(formData.taxRate) ?? 0
        };

        if (editingBusinessInfo) {
            let logoAssetId = removeLogo ? null : editingBusinessInfo.branding?.logoAssetId || null;

            if (pendingLogoAsset) {
                const existingAsset = findLogoAssetByHash(editingBusinessInfo.id, pendingLogoAsset.contentHash);
                const assetRecord = existingAsset || createBusinessBrandAsset({
                    businessInfoId: editingBusinessInfo.id,
                    ...pendingLogoAsset,
                });
                logoAssetId = assetRecord.id;
            }

            updateBusinessInfo(editingBusinessInfo.id, {
                ...basePayload,
                branding: buildBrandingPayload(logoAssetId, normalizedPrimaryColor),
            });

            await cleanupUnusedLogoAssets(editingBusinessInfo.id, logoAssetId);

            // If this business info is set as default, remove default from others
            if (formData.isDefault) {
                setDefault(editingBusinessInfo.id);
            }

            showSuccess('Business info updated successfully');
        } else {
            const newBusinessInfo = createBusinessInfo({
                ...basePayload,
                branding: buildBrandingPayload(null, normalizedPrimaryColor),
            });

            if (pendingLogoAsset) {
                const existingAsset = findLogoAssetByHash(newBusinessInfo.id, pendingLogoAsset.contentHash);
                const assetRecord = existingAsset || createBusinessBrandAsset({
                    businessInfoId: newBusinessInfo.id,
                    ...pendingLogoAsset,
                });

                updateBusinessInfo(newBusinessInfo.id, {
                    branding: buildBrandingPayload(assetRecord.id, normalizedPrimaryColor),
                });
            }

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
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
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

            <div className="flex flex-row flex-wrap justify-end gap-2">
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
                            Business Title <span className="text-destructive-strong">*</span>
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
                            Business/Name <span className="text-destructive-strong">*</span>
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

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
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
                                                className="w-full sm:w-20 sm:flex-shrink-0"
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

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                        <div key={index} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <Input
                                    type="text"
                                    value={field.label}
                                    onChange={(e) => handleCustomFieldChange(index, 'label', e.target.value)}
                                    placeholder="Field label (e.g., Website)"
                                />
                            </div>
                            <div className="flex gap-2">
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
                                    className="shrink-0 hover:bg-accent text-destructive-strong hover-text-destructive-strong"
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

                <div className="border border-border rounded-lg">
                    <button
                        type="button"
                        onClick={() => toggleSection('branding')}
                        className={`w-full px-4 py-3 text-left cursor-pointer bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${expandedSections.branding ? 'rounded-t-lg' : 'rounded-lg'}`}
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">Branding</h4>
                            <svg
                                className={`w-5 h-5 text-muted-foreground transform transition-transform ${expandedSections.branding ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>
                    {expandedSections.branding && (
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="business-logo-upload">
                                    Logo
                                </Label>
                                <input
                                    ref={logoInputRef}
                                    id="business-logo-upload"
                                    type="file"
                                    accept="image/svg+xml,image/png,image/jpeg,image/webp"
                                    onChange={handleLogoFileChange}
                                    disabled={isProcessingLogo}
                                    className="sr-only"
                                />
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        leadingIcon={ImageIcon}
                                        onClick={() => logoInputRef.current?.click()}
                                        disabled={isProcessingLogo}
                                    >
                                        {isProcessingLogo ? 'Processing Logo...' : 'Choose Logo'}
                                    </Button>
                                    <span className="max-w-full truncate text-sm text-muted-foreground">
                                        {selectedLogoLabel}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Upload an SVG, PNG, JPEG, or WebP logo. Logos are processed for invoice headers before saving.
                                </p>
                            </div>

                            {logoPreviewUrl ? (
                                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                                    <div className="rounded-md border border-border bg-white p-4">
                                        <img
                                            src={logoPreviewUrl}
                                            alt="Business logo preview"
                                            className="mx-auto max-h-20 max-w-full object-contain"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            {pendingLogoAsset ? 'New logo will be saved with this business.' : 'This logo is currently attached to the business branding.'}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleRemoveLogo}
                                        >
                                            Remove Logo
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    No logo selected. Invoices can still use the business name without a logo.
                                </p>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="primaryColor">
                                    Primary Color
                                </Label>
                                <div className="flex max-w-full items-center gap-3 sm:max-w-md">
                                    <Input
                                        id="primaryColor"
                                        type="text"
                                        value={formData.primaryColor}
                                        onChange={(e) => handlePrimaryColorChange(e.target.value)}
                                        className="min-w-0 flex-1"
                                        placeholder="#1f2937"
                                    />
                                    <input
                                        id="primaryColorPicker"
                                        aria-label="Primary color swatch"
                                        type="color"
                                        value={normalizeBrandColor(formData.primaryColor) || '#1f2937'}
                                        onChange={(e) => handlePrimaryColorChange(e.target.value)}
                                        className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
                                    />
                                </div>
                            </div>
                        </div>
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
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
