import { toDisplayDate, getTodayString } from '../../utils/dateUtils.ts';
import { getPreferredCurrency } from '../../utils/currencyUtils.ts';
import CustomCheckbox from '../CustomCheckbox';
import Modal from '../Modal';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { InlineFieldHeader } from '@/components/ui/inline-field-header';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/ui/notice';
import PeriodRangePicker from '@/components/ui/period-range-picker';
import InvoiceTaskSelector from './InvoiceTaskSelector';
import InvoiceExpenseSelector from './InvoiceExpenseSelector';
import InvoicePreview from './InvoicePreview';
import InvoiceActions from './InvoiceActions';

const InvoiceModal = ({
    showInvoiceForm,
    editingInvoice,
    handleClose,
    handleSaveInvoice,
    handlePreviewInvoice,
    handleSendQuote,
    handleDownloadQuote,
    canUndoInvoice = false,
    handleUndoInvoice = null,
    mode = 'invoice',
    openedFromProjectContext = false,
    allowAdditionalProjectsSelection = false,
    isProjectContextFixed,
    isClientContextFixed,
    projects,
    selectedProject,
    selectedAdditionalProjectIds,
    setSelectedAdditionalProjectIds,
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
    handleToggleFlatRate,
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
    availableExpenses,
    selectedExpensesForBilling,
    setSelectedExpensesForBilling,
    additionalExpenses,
    showAddExpenseForm,
    setShowAddExpenseForm,
    newExpenseTitle,
    setNewExpenseTitle,
    newExpenseAmount,
    setNewExpenseAmount,
    newExpenseCurrency,
    setNewExpenseCurrency,
    newExpenseSupplierName,
    setNewExpenseSupplierName,
    handleAddAdditionalExpense,
    handleRemoveAdditionalExpense,
    conversionUnavailableCount,
    exchangeRatesError,
    exchangeRatesLoading,
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
    billingPeriodPreset,
    setBillingPeriodPreset,
    billingPeriodStart,
    setBillingPeriodStart,
    billingPeriodEnd,
    setBillingPeriodEnd,
    billingPeriodOptions,
    // Modal stacking functions
    openClientModal,
    openProjectModal,
    openBusinessModal,
    openPaymentMethodModal,
    openTemplateModal,
    saveFormState,
    getSavedState
}) => {
    const isQuoteMode = mode === 'quote';

    // Set default expanded section based on context:
    // - 'projectClient' when opened from Invoices view (standalone mode)
    // - 'tasksTime' when opened from Project Dashboard view
    const getDefaultSection = () => {
        if (openedFromProjectContext) {
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
    const availableProjects = projects.filter((proj) => {
        if (proj.isPersonal) return false;

        if (selectedClient) {
            return proj.preferredClientId === selectedClient.id;
        }

        return true;
    });

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

    const handleCloseWithState = useCallback(() => {
        saveCurrentFormState();
        handleClose();
    }, [handleClose, saveCurrentFormState]);

    const handleSave = (e) => {
        e.preventDefault();

        if (isQuoteMode) {
            return;
        }

        // Validation logic to open the relevant section if required inputs are missing
        if (!selectedClient) {
            setActiveSection('projectClient');
            return;
        }
        // Check if there are any tasks to bill (either from project or additional tasks)
        const selectedTasksCount = Object.values(selectedTasksForBilling).filter(Boolean).length;
        const selectedExpensesCount = Object.values(selectedExpensesForBilling).filter(Boolean).length;
        const hasAnyTasks = invoiceTasks.length > 0 || additionalTasks.length > 0;
        const hasAnyExpenses = availableExpenses.length > 0 || additionalExpenses.length > 0;
        const hasSelectedTasks = selectedTasksCount > 0 || additionalTasks.length > 0 || selectedExpensesCount > 0 || additionalExpenses.length > 0;
        
        if ((!hasAnyTasks && !hasAnyExpenses) || !hasSelectedTasks) {
            setActiveSection('tasksTime');
            return;
        }
        
        handleSaveInvoice(e);
    };

    // Footer content with action buttons
    const footer = (
        <InvoiceActions
            editingInvoice={editingInvoice}
            handleClose={handleCloseWithState}
            onPreview={handlePreviewInvoice}
            mode={mode}
            onSend={handleSendQuote}
            onDownload={handleDownloadQuote}
            canUndoInvoice={canUndoInvoice}
            onUndoInvoice={handleUndoInvoice}
        />
    );

    const headerActions = isQuoteMode ? null : (
        <PeriodRangePicker
            value={billingPeriodPreset}
            onValueChange={setBillingPeriodPreset}
            options={billingPeriodOptions}
            customStart={billingPeriodStart}
            customEnd={billingPeriodEnd}
            onCustomStartChange={setBillingPeriodStart}
            onCustomEndChange={setBillingPeriodEnd}
            className="max-w-[calc(100vw-7rem)]"
            triggerClassName="bg-background"
            ariaLabel="Invoice billing period"
            contentAlign="end"
            triggerTabIndex={-1}
        />
    );

    return (
        <Modal 
            isOpen={showInvoiceForm}
            onClose={handleCloseWithState}
            title={isQuoteMode ? 'Quote' : (editingInvoice ? 'Edit Invoice' : 'New Invoice')}
            size="2xl"
            headerActions={headerActions}
            footer={footer}
        >
            <form id="invoice-form" onSubmit={handleSave} className="space-y-5">
                {/* Client & Project Details */}
                <div className="border border-border rounded-lg">
                    <button
                        type="button"
                        {...(!openedFromProjectContext ? { 'data-autofocus': true } : {})}
                        onClick={() => toggleSection('projectClient')}
                        className={`w-full px-4 py-3 text-left cursor-pointer bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'projectClient' ? 'rounded-t-lg' : 'rounded-lg'}`}
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
                                <InlineFieldHeader
                                    action={openClientModal && !isClientContextFixed && !editingInvoice && !(selectedProject && selectedProject.preferredClientId) ? (
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
                                    ) : null}
                                >
                                    <h4 className="text-sm font-medium text-foreground">
                                        Client <span className="text-destructive-strong">*</span>
                                    </h4>
                                </InlineFieldHeader>

                                {clients.length === 0 ? (
                                    <Notice
                                        title="No client information found"
                                        description="Create one to include client details in the invoice."
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <Select
                                            value={selectedClient?.id || "__none__"}
                                            onValueChange={(value) => handleClientSelection(value === "__none__" ? "" : value)}
                                            disabled={isClientContextFixed || editingInvoice || (selectedProject && selectedProject.preferredClientId)}
                                        >
                                            <SelectTrigger>
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
                                        {selectedClient && (
                                            <Notice
                                                title={`${selectedClient?.title || 'Selected client'} will be included as "${isQuoteMode ? 'Quote To' : 'Invoice To'}" in the ${isQuoteMode ? 'quote' : 'invoice'}.`}
                                                description={
                                                    !isClientContextFixed && !isProjectContextFixed && selectedProject?.preferredClientId
                                                        ? `Client cannot be changed because this project is associated with ${clients.find(c => c.id === selectedProject.preferredClientId)?.title || 'a specific client'}.`
                                                        : undefined
                                                }
                                                className="py-2 px-3"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Project selection */}
                            <div className="mb-6">
                                <InlineFieldHeader
                                    action={openProjectModal && !(isProjectContextFixed && !isClientContextFixed) && !editingInvoice ? (
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0"
                                            onClick={() => {
                                                if (openProjectModal) {
                                                    // Save current form state before opening nested modal
                                                    saveCurrentFormState();
                                                    if (isClientContextFixed && selectedClient?.id) {
                                                        openProjectModal(null, { preselectedClientId: selectedClient.id });
                                                    } else {
                                                        openProjectModal();
                                                    }
                                                }
                                            }}
                                        >
                                            + New Project
                                        </Button>
                                    ) : null}
                                >
                                    <h4 className="text-sm font-medium text-foreground">
                                        Project
                                    </h4>
                                </InlineFieldHeader>

                                {projects.length === 0 ? (
                                    <Notice
                                        title="No projects found"
                                        description="You can create a project or continue without one."
                                    />
                                ) : (() => {
                                    if (availableProjects.length === 0 && selectedClient) {
                                        return (
                                            <Notice
                                                title={`No projects found for ${selectedClient.title}`}
                                                description="You can create a project for this client or continue without one."
                                            />
                                        );
                                    } else if (availableProjects.length === 0) {
                                        return (
                                            <Notice
                                                title="No projects available"
                                                description="Select a client first to see their projects, or create a new project."
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
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select project (optional)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">Select project (optional)</SelectItem>
                                                    {availableProjects.map(proj => (
                                                        <SelectItem key={proj.id} value={proj.id}>
                                                            {proj.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {selectedProject && !openedFromProjectContext && (
                                                <Notice
                                                    title={selectedProject.title}
                                                    description={!selectedProject.flatRate && selectedProject.hourlyRate ? (
                                                        <span className="sensitive-data">Rate: {getCurrencySymbol(getInvoiceCurrency())}{selectedProject.hourlyRate}/hour</span>
                                                    ) : (!selectedProject.flatRate ? 'You can create invoices with custom rates' : undefined)}
                                                    className="py-2 px-3"
                                                />
                                            )}

                                            {!isQuoteMode && openedFromProjectContext && !editingInvoice && (
                                                <Notice
                                                    title="Single-project invoice"
                                                    description="To include multiple projects, create the invoice from the client page."
                                                    className="py-2 px-3"
                                                />
                                            )}

                                            {!isQuoteMode && allowAdditionalProjectsSelection && selectedClient && availableProjects.length > 1 && selectedProject && (
                                                <div className="rounded-md border border-border bg-card p-3">
                                                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                                                        Additional Projects
                                                    </div>
                                                    <div className="space-y-2">
                                                        {availableProjects
                                                            .filter((proj) => proj.id !== selectedProject.id)
                                                            .map((proj) => (
                                                                <CustomCheckbox
                                                                    key={proj.id}
                                                                    checked={selectedAdditionalProjectIds.includes(proj.id)}
                                                                    onChange={(checked) => {
                                                                        setSelectedAdditionalProjectIds((prev) => {
                                                                            if (checked) {
                                                                                return prev.includes(proj.id) ? prev : [...prev, proj.id];
                                                                            }

                                                                            return prev.filter((projectId) => projectId !== proj.id);
                                                                        });
                                                                    }}
                                                                    label={proj.title}
                                                                    labelClassName="text-sm text-foreground"
                                                                    id={`additional-project-${proj.id}`}
                                                                />
                                                            ))}
                                                    </div>
                                                </div>
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
                    autoFocusToggle={openedFromProjectContext}
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
                    handleToggleFlatRate={handleToggleFlatRate}
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

                {!isQuoteMode && (
                    <InvoiceExpenseSelector
                        activeSection={activeSection}
                        toggleSection={toggleSection}
                        expenses={availableExpenses}
                        selectedExpensesForBilling={selectedExpensesForBilling}
                        setSelectedExpensesForBilling={setSelectedExpensesForBilling}
                        additionalExpenses={additionalExpenses}
                        showAddExpenseForm={showAddExpenseForm}
                        setShowAddExpenseForm={setShowAddExpenseForm}
                        newExpenseTitle={newExpenseTitle}
                        setNewExpenseTitle={setNewExpenseTitle}
                        newExpenseAmount={newExpenseAmount}
                        setNewExpenseAmount={setNewExpenseAmount}
                        newExpenseCurrency={newExpenseCurrency}
                        setNewExpenseCurrency={setNewExpenseCurrency}
                        newExpenseSupplierName={newExpenseSupplierName}
                        setNewExpenseSupplierName={setNewExpenseSupplierName}
                        handleAddAdditionalExpense={handleAddAdditionalExpense}
                        handleRemoveAdditionalExpense={handleRemoveAdditionalExpense}
                        getInvoiceCurrency={getInvoiceCurrency}
                        conversionUnavailableCount={conversionUnavailableCount}
                        exchangeRatesError={exchangeRatesError}
                        exchangeRatesLoading={exchangeRatesLoading}
                    />
                )}

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
                        className={`w-full px-4 py-3 text-left cursor-pointer bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'businessPayment' ? 'rounded-t-lg' : 'rounded-lg'}`}
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
                                <InlineFieldHeader
                                    action={(
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
                                    )}
                                >
                                    <h4 className="text-sm font-medium text-foreground">
                                        Business
                                    </h4>
                                </InlineFieldHeader>

                                {businessInfos.length === 0 ? (
                                    <Notice
                                        title="No businesses found"
                                        description={`Create one to include your business details in the ${isQuoteMode ? 'quote' : 'invoice'}.`}
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
                                                title={`${selectedBusinessInfo.title} will be included as "${isQuoteMode ? 'Quote From' : 'Invoice From'}" in the ${isQuoteMode ? 'quote' : 'invoice'}.`}
                                                className="py-2 px-3"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Payment method */}
                            <div className="mb-6">
                                <InlineFieldHeader
                                    action={(
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
                                    )}
                                >
                                    <h4 className="text-sm font-medium text-foreground">
                                        Payment Method
                                    </h4>
                                </InlineFieldHeader>

                                {paymentMethods.length === 0 ? (
                                    <Notice
                                        title="No payment methods found"
                                        description={`Create one to include payment details in your ${isQuoteMode ? 'quote' : 'invoice'}.`}
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
                                                title={`${selectedPaymentMethod.title} will be included as "Payment Details" in the ${isQuoteMode ? 'quote' : 'invoice'}.`}
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
                        className={`w-full px-4 py-3 text-left cursor-pointer bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'invoiceSettings' ? 'rounded-t-lg' : 'rounded-lg'}`}
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">{isQuoteMode ? 'Quote Settings' : 'Invoice Settings'}</h4>
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
                                <InlineFieldHeader
                                    action={(
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
                                    )}
                                >
                                    <h4 className="text-sm font-medium text-foreground">
                                        {isQuoteMode ? 'Document Template' : 'Invoice Template'} {!isQuoteMode && <span className="text-destructive-strong">*</span>}
                                    </h4>
                                </InlineFieldHeader>

                                {invoiceTemplates.length === 0 ? (
                                    <Notice
                                        title={isQuoteMode ? 'No document templates found' : 'No invoice templates found'}
                                        description={isQuoteMode ? 'You can still continue with the default quote layout.' : 'Create a template to continue with invoice generation.'}
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
                                                {isQuoteMode ? (
                                                    <div className="text-sm">
                                                        Quote layout and branding will use this template.
                                                    </div>
                                                ) : (
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
                                                                    return 'Not shown';
                                                            }
                                                        })()}
                                                    </div>
                                                )}
                                            </Notice>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Invoice notes */}
                            <div className="mt-2 space-y-2">
                                <Label htmlFor="invoice-note">{isQuoteMode ? 'Quote Note' : 'Invoice Note'}</Label>
                                <Textarea
                                    id="invoice-note"
                                    value={invoiceNote}
                                    onChange={(e) => setInvoiceNote(e.target.value)}
                                    rows="3"
                                    placeholder={`Add any additional notes for the ${isQuoteMode ? 'quote' : 'invoice'} here...`}
                                />
                            </div>

                            {/* Invoice Date Override */}
                            <div className="mt-4">
                                <div className="flex items-center space-x-2 mb-2">
                                    <CustomCheckbox
                                        checked={useInvoiceDateOverride}
                                        onChange={(checked) => setUseInvoiceDateOverride(checked)}
                                        label={isQuoteMode ? 'Override quote date' : 'Override invoice date'}
                                        labelClassName="text-sm font-medium text-foreground"
                                    />
                                </div>

                                {useInvoiceDateOverride && (
                                    <div>
                                        <NativeDateInput
                                            value={invoiceDateOverride}
                                            onChange={(e) => setInvoiceDateOverride(e.target.value)}
                                            max={getTodayString()}
                                            className="block w-full border border-border rounded-md shadow-sm text-foreground focus:ring-ring focus:border-ring sm:text-sm px-2.5 py-2"
                                            required={useInvoiceDateOverride}
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            When enabled, this date will be used instead of today's date for the {isQuoteMode ? 'quote' : 'invoice'}. Future dates are not allowed.
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
