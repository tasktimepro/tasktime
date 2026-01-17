import { toDisplayDate, getTodayString } from '../../utils/dateUtils';
import { getPreferredCurrency } from '../../utils/currencyUtils';
import CustomCheckbox from '../CustomCheckbox';
import Modal from '../Modal';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/ui/notice';
import InvoiceTaskSelector from './InvoiceTaskSelector';
import InvoicePreview from './InvoicePreview';
import InvoiceActions from './InvoiceActions';

const InvoiceModal = ({
    showInvoiceForm,
    editingInvoice,
    handleCancel,
    handleSaveInvoice,
    isProjectContextFixed,
    isClientContextFixed,
    projects,
    selectedProject,
    handleProjectSelection,
    clients,
    selectedClient,
    handleClientSelection,
    invoiceTasks,
    setShowAddTaskForm,
    showAddTaskForm,
    newTaskTitle,
    setNewTaskTitle,
    newTaskUseFlatRate,
    handleToggleNewTaskFlatRate,
    newTaskQuantity,
    setNewTaskQuantity,
    newTaskHours,
    setNewTaskHours,
    newTaskHourlyRate,
    setNewTaskHourlyRate,
    additionalTasks,
    handleAddAdditionalTask,
    handleRemoveAdditionalTask,
    handleTaskSelectionForBilling,
    handleHoursChange,
    handleFlatRateChange,
    handleQuantityChange,
    handleTaskHourlyRateChange,
    handleAdditionalTaskHoursChange,
    handleAdditionalTaskFlatRateChange,
    handleAdditionalTaskQuantityChange,
    handleAdditionalTaskHourlyRateChange,
    handleToggleAdditionalTaskFlatRate,
    calculatePricing,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    shippingAmount,
    setShippingAmount,
    taxOverride,
    setTaxOverride,
    getCurrencySymbol,
    businessInfos,
    selectedBusinessInfo,
    paymentMethods,
    selectedPaymentMethod,
    invoiceNote,
    setInvoiceNote,
    editableHours,
    taskFlatRates,
    useFlatRate,
    taskHourlyRates,
    taskQuantities,
    setNewTaskUseFlatRate,
    selectedTasksForBilling,
    setSelectedTasksForBilling,
    setSelectedPaymentMethod,
    setSelectedBusinessInfo,
    mergedSubtasks,
    handleToggleMergeSubtasks,
    taskInputRef,
    invoiceTemplates,
    selectedTemplate,
    handleTemplateSelection,
    invoiceDateOverride,
    setInvoiceDateOverride,
    useInvoiceDateOverride,
    setUseInvoiceDateOverride,
    // Modal stacking functions
    openClientModal,
    openProjectModal,
    openBusinessModal,
    openPaymentMethodModal,
    openTemplateModal,
    saveFormState,
    getSavedState,
    clearSavedState
}) => {
    // Set default expanded section based on context:
    // - 'projectClient' when opened from Invoices view (standalone mode)
    // - 'tasksTime' when opened from Project Dashboard view
    const getDefaultSection = () => {
        if (isProjectContextFixed) {
            // From Project Dashboard - default to Tasks & Time
            return 'tasksTime';
        } else {
            // From Invoices view (standalone) - default to Client & Project Details
            return 'projectClient';
        }
    };

    // Helper function to get the currency to use (client currency or user preference)
    const getInvoiceCurrency = () => {
        return selectedClient?.defaultCurrency || getPreferredCurrency();
    };

    const [activeSection, setActiveSection] = useState(getDefaultSection());

    // Form state preservation for modal stacking
    const getAllFormData = useCallback(() => {
        return {
            activeSection,
            // Add other form state as needed
        };
    }, [activeSection]);

    // Save form state when opening nested modals
    const saveCurrentFormState = useCallback(() => {
        if (saveFormState) {
            saveFormState(getAllFormData());
        }
    }, [saveFormState, getAllFormData]);

    // Auto-save form state periodically
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            saveCurrentFormState();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [saveCurrentFormState]);

    // Restore form state when modal reopens
    useEffect(() => {
        if (getSavedState) {
            const savedState = getSavedState();
            if (savedState) {
                if (savedState.activeSection) setActiveSection(savedState.activeSection);
                // Restore other form state as needed
            }
        }
    }, [getSavedState]);

    const toggleSection = (section) => {
        setActiveSection((prev) => (prev === section ? '' : section));
    };

    const handleSave = (e) => {
        e.preventDefault();
        // Validation logic to open the relevant section if required inputs are missing
        if (!selectedClient) {
            setActiveSection('projectClient');
            return;
        }
        // Check if there are any tasks to bill (either from project or additional tasks)
        const selectedTasksCount = Object.values(selectedTasksForBilling).filter(Boolean).length;
        const hasAnyTasks = invoiceTasks.length > 0 || additionalTasks.length > 0;
        const hasSelectedTasks = selectedTasksCount > 0 || additionalTasks.length > 0;
        
        if (!hasAnyTasks || !hasSelectedTasks) {
            setActiveSection('tasksTime');
            return;
        }
        
        // Clear saved state on successful submission
        if (clearSavedState) {
            clearSavedState();
        }
        
        handleSaveInvoice(e);
    };

    // Footer content with action buttons
    const footer = (
        <InvoiceActions
            editingInvoice={editingInvoice}
            handleCancel={handleCancel}
        />
    );

    return (
        <Modal 
            isOpen={showInvoiceForm}
            onClose={handleCancel}
            title={editingInvoice ? 'Edit Invoice' : 'New Invoice'}
            size="2xl"
            footer={footer}
        >
            <form id="invoice-form" onSubmit={handleSave} className="space-y-5">
                {/* Client & Project Details */}
                <div className="border border-border rounded-lg">
                    <button
                        type="button"
                        onClick={() => toggleSection('projectClient')}
                        className={`w-full px-4 py-3 text-left bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'projectClient' ? 'rounded-t-lg' : 'rounded-lg'}`}
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">Client & Project Details</h4>
                            <svg
                                className={`w-5 h-5 text-muted-foreground transform transition-transform ${activeSection === 'projectClient' ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>
                    {activeSection === 'projectClient' && (
                        <div className="p-4 space-y-4">
                            {/* Client Info Selection */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-sm font-medium text-foreground">
                                        Client <span className="text-red-500">*</span>
                                    </h4>
                                    {openClientModal && !isClientContextFixed && !editingInvoice && !(selectedProject && selectedProject.preferredClientId) && (
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0"
                                            onClick={() => {
                                                if (openClientModal) {
                                                    // Save current form state before opening nested modal
                                                    saveCurrentFormState();
                                                    openClientModal();
                                                }
                                            }}
                                        >
                                            + New Client
                                        </Button>
                                    )}
                                </div>

                                {clients.length === 0 ? (
                                    <Notice
                                        title="No client information found"
                                        description="Create one to include client details in the invoice."
                                        showIcon={false}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <Select
                                            value={selectedClient?.id || "__none__"}
                                            onValueChange={(value) => handleClientSelection(value === "__none__" ? "" : value)}
                                            disabled={isClientContextFixed || editingInvoice || (selectedProject && selectedProject.preferredClientId)}
                                        >
                                            <SelectTrigger
                                                className={(isClientContextFixed || editingInvoice || (selectedProject && selectedProject.preferredClientId)) ? 'bg-muted' : 'bg-background'}
                                            >
                                                <SelectValue placeholder="Select client info" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">Select client info</SelectItem>
                                                {clients.map(client => (
                                                    <SelectItem key={client.id} value={client.id}>
                                                        {client.title.trim()}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedProject && selectedProject.preferredClientId && (
                                            <Notice
                                                title={`Client cannot be changed because this project is associated with ${clients.find(c => c.id === selectedProject.preferredClientId)?.title || 'a specific client'}.`}
                                                className="py-2 px-3"
                                            />
                                        )}
                                        {selectedClient && (
                                            <Notice
                                                title={`${selectedClient?.title || 'Selected client'} will be included as "Invoice To" in the invoice.`}
                                                className="py-2 px-3"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Project selection */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-sm font-medium text-foreground">
                                        Project
                                    </h4>
                                    {openProjectModal && !(isProjectContextFixed && !isClientContextFixed) && !isClientContextFixed && !editingInvoice && (
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0"
                                            onClick={() => {
                                                if (openProjectModal) {
                                                    // Save current form state before opening nested modal
                                                    saveCurrentFormState();
                                                    openProjectModal();
                                                }
                                            }}
                                        >
                                            + New Project
                                        </Button>
                                    )}
                                </div>

                                {projects.length === 0 ? (
                                    <Notice
                                        title="No projects found"
                                        description="You can create a project or continue without one."
                                        showIcon={false}
                                    />
                                ) : (() => {
                                    // Filter projects based on selected client
                                    const availableProjects = projects.filter(proj => {
                                        // Only show non-personal projects
                                        if (proj.isPersonal) return false;
                                        
                                        // If a client is selected, only show projects for that client
                                        if (selectedClient) {
                                            return proj.preferredClientId === selectedClient.id;
                                        }
                                        
                                        // If no client selected, show all non-personal projects
                                        return true;
                                    });

                                    if (availableProjects.length === 0 && selectedClient) {
                                        return (
                                            <Notice
                                                title={`No projects found for ${selectedClient.title}`}
                                                description="You can create a project for this client or continue without one."
                                                showIcon={false}
                                            />
                                        );
                                    } else if (availableProjects.length === 0) {
                                        return (
                                            <Notice
                                                title="No projects available"
                                                description="Select a client first to see their projects, or create a new project."
                                                showIcon={false}
                                            />
                                        );
                                    }

                                    return (
                                        <div className="space-y-2">
                                            <Select
                                                value={selectedProject?.id || "__none__"}
                                                onValueChange={(value) => handleProjectSelection(value === "__none__" ? "" : value)}
                                                disabled={(isProjectContextFixed && !isClientContextFixed) || editingInvoice}
                                            >
                                                <SelectTrigger
                                                    className={((isProjectContextFixed && !isClientContextFixed) || editingInvoice) ? 'bg-muted' : 'bg-background'}
                                                >
                                                    <SelectValue placeholder="Select project (optional)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">Select project (optional)</SelectItem>
                                                    {projects.filter(proj => {
                                                        // Only show non-personal projects
                                                        if (proj.isPersonal) return false;
                                                        
                                                        // If a client is selected, only show projects for that client
                                                        if (selectedClient) {
                                                            return proj.preferredClientId === selectedClient.id;
                                                        }
                                                        
                                                        // If no client selected, show all non-personal projects
                                                        return true;
                                                    }).map(proj => (
                                                        <SelectItem key={proj.id} value={proj.id}>
                                                            {proj.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {selectedProject && (
                                                <Notice
                                                    title={selectedProject.title}
                                                    description={!selectedProject.flatRate && selectedProject.hourlyRate ? `Rate: ${getCurrencySymbol(getInvoiceCurrency())}${selectedProject.hourlyRate}/hour` : (!selectedProject.flatRate ? 'You can create invoices with custom rates' : undefined)}
                                                    className="py-2 px-3"
                                                />
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                <InvoiceTaskSelector
                    activeSection={activeSection}
                    toggleSection={toggleSection}
                    invoiceTasks={invoiceTasks}
                    selectedTasksForBilling={selectedTasksForBilling}
                    setSelectedTasksForBilling={setSelectedTasksForBilling}
                    setShowAddTaskForm={setShowAddTaskForm}
                    showAddTaskForm={showAddTaskForm}
                    taskInputRef={taskInputRef}
                    newTaskTitle={newTaskTitle}
                    setNewTaskTitle={setNewTaskTitle}
                    newTaskUseFlatRate={newTaskUseFlatRate}
                    handleToggleNewTaskFlatRate={handleToggleNewTaskFlatRate}
                    newTaskQuantity={newTaskQuantity}
                    setNewTaskQuantity={setNewTaskQuantity}
                    newTaskHours={newTaskHours}
                    setNewTaskHours={setNewTaskHours}
                    newTaskHourlyRate={newTaskHourlyRate}
                    setNewTaskHourlyRate={setNewTaskHourlyRate}
                    additionalTasks={additionalTasks}
                    handleAddAdditionalTask={handleAddAdditionalTask}
                    handleRemoveAdditionalTask={handleRemoveAdditionalTask}
                    handleTaskSelectionForBilling={handleTaskSelectionForBilling}
                    handleHoursChange={handleHoursChange}
                    handleFlatRateChange={handleFlatRateChange}
                    handleQuantityChange={handleQuantityChange}
                    handleTaskHourlyRateChange={handleTaskHourlyRateChange}
                    handleAdditionalTaskHoursChange={handleAdditionalTaskHoursChange}
                    handleAdditionalTaskFlatRateChange={handleAdditionalTaskFlatRateChange}
                    handleAdditionalTaskQuantityChange={handleAdditionalTaskQuantityChange}
                    handleAdditionalTaskHourlyRateChange={handleAdditionalTaskHourlyRateChange}
                    handleToggleAdditionalTaskFlatRate={handleToggleAdditionalTaskFlatRate}
                    editableHours={editableHours}
                    taskFlatRates={taskFlatRates}
                    useFlatRate={useFlatRate}
                    taskHourlyRates={taskHourlyRates}
                    taskQuantities={taskQuantities}
                    mergedSubtasks={mergedSubtasks}
                    handleToggleMergeSubtasks={handleToggleMergeSubtasks}
                    selectedProject={selectedProject}
                    selectedClient={selectedClient}
                    getInvoiceCurrency={getInvoiceCurrency}
                    setNewTaskUseFlatRate={setNewTaskUseFlatRate}
                />

                <InvoicePreview
                    activeSection={activeSection}
                    toggleSection={toggleSection}
                    calculatePricing={calculatePricing}
                    discountType={discountType}
                    setDiscountType={setDiscountType}
                    discountValue={discountValue}
                    setDiscountValue={setDiscountValue}
                    shippingAmount={shippingAmount}
                    setShippingAmount={setShippingAmount}
                    taxOverride={taxOverride}
                    setTaxOverride={setTaxOverride}
                    selectedBusinessInfo={selectedBusinessInfo}
                    selectedClient={selectedClient}
                    getInvoiceCurrency={getInvoiceCurrency}
                    getCurrencySymbol={getCurrencySymbol}
                />

                {/* Business & Payment */}
                <div className="border border-border rounded-lg">
                    <button
                        type="button"
                        onClick={() => toggleSection('businessPayment')}
                        className={`w-full px-4 py-3 text-left bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'businessPayment' ? 'rounded-t-lg' : 'rounded-lg'}`}
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">Business & Payment</h4>
                            <svg
                                className={`w-5 h-5 text-muted-foreground transform transition-transform ${activeSection === 'businessPayment' ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>
                    {activeSection === 'businessPayment' && (
                        <div className="p-4 space-y-4">
                            {/* Business information */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-sm font-medium text-foreground">
                                        Business
                                    </h4>
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0"
                                        onClick={() => {
                                            if (openBusinessModal) {
                                                // Save current form state before opening nested modal
                                                saveCurrentFormState();
                                                openBusinessModal();
                                            }
                                        }}
                                    >
                                        + New Business
                                    </Button>
                                </div>

                                {businessInfos.length === 0 ? (
                                    <Notice
                                        title="No businesses found"
                                        description="Create one to include your business details in the invoice."
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <Select
                                            value={selectedBusinessInfo?.id || "__none__"}
                                            onValueChange={(value) => {
                                                if (value === "__none__") {
                                                    setSelectedBusinessInfo(null);
                                                } else {
                                                    const businessInfo = businessInfos.find(bi => bi.id === value);
                                                    if (businessInfo) {
                                                        setSelectedBusinessInfo(businessInfo);
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select business info (optional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">Select business info (optional)</SelectItem>
                                                {businessInfos.map(info => (
                                                    <SelectItem key={info.id} value={info.id}>
                                                        {info.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {selectedBusinessInfo && (
                                            <Notice
                                                title={`${selectedBusinessInfo.title} will be included as "Invoice From" in the invoice.`}
                                                className="py-2 px-3"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Payment method */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-sm font-medium text-foreground">
                                        Payment Method
                                    </h4>
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0"
                                        onClick={() => {
                                            if (openPaymentMethodModal) {
                                                // Save current form state before opening nested modal
                                                saveCurrentFormState();
                                                openPaymentMethodModal();
                                            }
                                        }}
                                    >
                                        + New Payment Method
                                    </Button>
                                </div>

                                {paymentMethods.length === 0 ? (
                                    <Notice
                                        title="No payment methods found"
                                        description="Create one to include payment details in your invoice."
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <Select
                                            value={selectedPaymentMethod?.id || "__none__"}
                                            onValueChange={(value) => {
                                                if (value === "__none__") {
                                                    setSelectedPaymentMethod(null);
                                                } else {
                                                    const paymentMethod = paymentMethods.find(pm => pm.id === value);
                                                    if (paymentMethod) {
                                                        setSelectedPaymentMethod(paymentMethod);
                                                    }
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select payment method (optional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">Select payment method (optional)</SelectItem>
                                                {paymentMethods.map(method => (
                                                    <SelectItem key={method.id} value={method.id}>
                                                        {method.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {selectedPaymentMethod && (
                                            <Notice
                                                title={`${selectedPaymentMethod.title} will be included as "Payment Details" in the invoice.`}
                                                className="py-2 px-3"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Invoice Settings */}
                <div className="border border-border rounded-lg">
                    <button
                        type="button"
                        onClick={() => toggleSection('invoiceSettings')}
                        className={`w-full px-4 py-3 text-left bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'invoiceSettings' ? 'rounded-t-lg' : 'rounded-lg'}`}
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">Invoice Settings</h4>
                            <svg
                                className={`w-5 h-5 text-muted-foreground transform transition-transform ${activeSection === 'invoiceSettings' ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>
                    {activeSection === 'invoiceSettings' && (
                        <div className="p-4 space-y-4">
                            {/* Template selection */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-sm font-medium text-foreground">
                                        Invoice Template <span className="text-red-500">*</span>
                                    </h4>
                                    <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0"
                                        onClick={() => {
                                            if (openTemplateModal) {
                                                // Save current form state before opening nested modal
                                                saveCurrentFormState();
                                                openTemplateModal();
                                            }
                                        }}
                                    >
                                        + New Template
                                    </Button>
                                </div>

                                {invoiceTemplates.length === 0 ? (
                                    <Notice
                                        title="No invoice templates found"
                                        description="Create a template to continue with invoice generation."
                                        showIcon={false}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <Select
                                            value={selectedTemplate?.id || "__none__"}
                                            onValueChange={(value) => handleTemplateSelection(value === "__none__" ? "" : value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">Select template</SelectItem>
                                                {invoiceTemplates.map(template => (
                                                    <SelectItem key={template.id} value={template.id}>
                                                        {template.name} {template.isDefault ? '(Default)' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedTemplate && (
                                            <Notice
                                                title={selectedTemplate.name}
                                                className="py-2 px-3"
                                            >
                                                <div className="text-sm">
                                                    Invoice Format: {selectedTemplate.invoiceNumberFormat}<br />
                                                    Due Date: {(() => {
                                                        switch (selectedTemplate.dueDateType) {
                                                            case 'fixed-days': {
                                                                const days = parseInt(selectedTemplate.dueDateDays) || 0;
                                                                return `${days} ${days === 1 ? 'day' : 'days'} from invoice date`;
                                                            }
                                                            case 'fixed-weeks': {
                                                                const weeks = parseInt(selectedTemplate.dueDateWeeks) || 0;
                                                                return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} from invoice date`;
                                                            }
                                                            case 'precise-date':
                                                                return `Precise date: ${selectedTemplate.dueDatePrecise ? toDisplayDate(selectedTemplate.dueDatePrecise) : 'Not set'}`;
                                                            case 'none':
                                                                return 'Not shown';
                                                            default:
                                                                // Backward compatibility
                                                                return `${selectedTemplate.dueDateDays} days from invoice date`;
                                                        }
                                                    })()}
                                                </div>
                                            </Notice>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Invoice notes */}
                            <div className="mt-2 space-y-2">
                                <Label htmlFor="invoice-note">Invoice Note</Label>
                                <Textarea
                                    id="invoice-note"
                                    value={invoiceNote}
                                    onChange={(e) => setInvoiceNote(e.target.value)}
                                    rows="3"
                                    placeholder="Add any additional notes for the invoice here..."
                                />
                            </div>

                            {/* Invoice Date Override */}
                            <div className="mt-4">
                                <div className="flex items-center space-x-2 mb-2">
                                    <CustomCheckbox
                                        checked={useInvoiceDateOverride}
                                        onChange={(checked) => setUseInvoiceDateOverride(checked)}
                                        label="Override invoice date"
                                        labelClassName="text-sm font-medium text-foreground"
                                    />
                                </div>

                                {useInvoiceDateOverride && (
                                    <div>
                                        <input
                                            type="date"
                                            value={invoiceDateOverride}
                                            onChange={(e) => setInvoiceDateOverride(e.target.value)}
                                            max={getTodayString()}
                                            className="block w-full border border-border rounded-md shadow-sm bg-background text-foreground focus:ring-ring focus:border-ring sm:text-sm px-2.5 py-2"
                                            required={useInvoiceDateOverride}
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            When enabled, this date will be used instead of today's date for the invoice. Future dates are not allowed.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </Modal>
    );
};

export default InvoiceModal;
