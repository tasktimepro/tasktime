import { TrashIcon } from '@/components/ui/icons';
import { formatDurationWithSeconds, hoursToMinutes, toDisplayDate, getTodayString } from '../../utils/dateUtils';
import { getPreferredCurrency } from '../../utils/currencyUtils';
import CustomCheckbox from '../CustomCheckbox';
import Modal from '../Modal';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/ui/notice';

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
        <div className="flex justify-end space-x-3">
            <Button
                type="button"
                variant="secondary"
                onClick={handleCancel}
            >
                Cancel
            </Button>

            <Button
                type="submit"
                form="invoice-form"
            >
                {editingInvoice ? 'Update Invoice' : 'Generate New Invoice'}
            </Button>
        </div>
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

                {/* Tasks & Time */}
                <div className="border border-border rounded-lg">
                    <button
                        type="button"
                        onClick={() => toggleSection('tasksTime')}
                        className={`w-full px-4 py-3 text-left bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'tasksTime' ? 'rounded-t-lg' : 'rounded-lg'}`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-medium text-foreground">Tasks & Time</h4>
                                <div className="relative group flex">
                                    <div
                                        className="text-muted-foreground hover:text-muted-foreground cursor-help focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
                                        tabIndex="0"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="absolute left-0 top-6 w-64 p-2 bg-popover text-popover-foreground border border-border text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
                                        ✓ Select or create the tasks you want to bill. Unchecked tasks will remain unbilled and appear in future invoices.
                                    </div>
                                </div>
                            </div>
                            <svg
                                className={`w-5 h-5 text-muted-foreground transform transition-transform ${activeSection === 'tasksTime' ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>
                    {activeSection === 'tasksTime' && (
                        <div className="p-4 space-y-2">
                            {/* Select All/Deselect All and Add Task buttons */}
                            <div className="flex justify-between items-center">
                                <div className="flex space-x-2">
                                    {invoiceTasks.length > 0 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const allSelected = {};
                                                    invoiceTasks.forEach(task => {
                                                        allSelected[task.id] = true;
                                                    });
                                                    setSelectedTasksForBilling(allSelected);
                                                }}
                                                className="text-xs text-blue-600 hover:text-foreground"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-xs text-muted-foreground">|</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedTasksForBilling({});
                                                }}
                                                className="text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                Deselect All
                                            </button>
                                        </>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0"
                                    onClick={() => {
                                        setShowAddTaskForm(true);
                                        // Use setTimeout to ensure the form is rendered before focusing
                                        setTimeout(() => {
                                            if (taskInputRef && taskInputRef.current) {
                                                taskInputRef.current.focus();
                                            }
                                        }, 50);
                                    }}
                                >
                                    + Add Task
                                </Button>
                            </div>
                            
                            {/* Tasks with Editable Hours */}
                            <div className="space-y-2">
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {/* Removed debug log */}
                                    {invoiceTasks.map((task) => {
                                        const currentHours = editableHours[task.id] !== undefined ? editableHours[task.id] : task.hours;
                                        const currentMinutes = hoursToMinutes(parseFloat(currentHours) || 0);
                                        const currentFlatRate = taskFlatRates[task.id] !== undefined ? taskFlatRates[task.id] : '';
                                        // For existing invoices, calculate originalTimeMs from originalHours if not present
                                        const originalTimeMs = task.originalTimeMs || (task.originalHours * 60 * 60 * 1000);

                                        // Check if this task uses flat rate
                                        const isUsingFlatRate = useFlatRate[task.id] || false;
                                        
                                        // Check if this is a parent task with subtasks in the invoice
                                        // Make sure to check all subtasks, not just selected ones
                                        const hasSubtasksInInvoice = invoiceTasks.some(subtask => subtask.parentTaskId === task.id);
                                        const isSubtask = Boolean(task.parentTaskId);
                                        const isParentMerged = task.parentTaskId && mergedSubtasks[task.parentTaskId];
                                        
                                        // Skip rendering subtasks if their parent is merged
                                        if (isSubtask && isParentMerged) {
                                            return null;
                                        }

                                        return (
                                            <div key={task.id} className="flex items-center justify-between p-3 bg-muted rounded border">
                                                <div className="flex items-center space-x-3 flex-1">
                                                    {/* Task selection checkbox */}
                                                    <CustomCheckbox
                                                        checked={selectedTasksForBilling[task.id] || false}
                                                        onChange={(checked) => handleTaskSelectionForBilling(task.id, checked)}
                                                    />
                                                    <div className="flex-1 pr-4">
                                                        <p className="text-sm font-medium text-foreground overflow-hidden" style={{ 
                                                            display: '-webkit-box', 
                                                            WebkitLineClamp: 2, 
                                                            WebkitBoxOrient: 'vertical' 
                                                        }}>
                                                            {task.title}
                                                            {isSubtask && (
                                                                <span className="ml-2 text-xs text-muted-foreground">
                                                                    (subtask)
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Original: {formatDurationWithSeconds(originalTimeMs)}
                                                            {task.isEdited && (
                                                                <span className="text-blue-600 ml-2">(Modified)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-4">
                                                    {/* Merge subtasks checkbox - only show for parent tasks with subtasks */}
                                                    {hasSubtasksInInvoice && (
                                                        <div className="flex items-center bg-muted px-2 py-2 rounded">
                                                            <CustomCheckbox
                                                                checked={mergedSubtasks[task.id] || false}
                                                                onChange={(checked) => handleToggleMergeSubtasks(task.id, checked)}
                                                                title="Merge subtasks with this parent task"
                                                                label="Merge subtasks"
                                                                labelClassName="text-xs text-blue-700 font-medium"
                                                            />
                                                        </div>
                                                    )}
                                                    
                                                    {/* Add flat rate toggle */}
                                                    <div className="flex items-center">
                                                        <CustomCheckbox
                                                            checked={isUsingFlatRate}
                                                            onChange={(checked) => handleToggleAdditionalTaskFlatRate(task.id, checked)}
                                                            label="Flat rate"
                                                            labelClassName="text-xs text-foreground"
                                                            id={`flat-rate-${task.id}`}
                                                        />
                                                    </div>

                                                    {isUsingFlatRate ? (
                                                        // Flat rate input with quantity
                                                        <div className="flex items-center space-x-2">
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground mb-1 text-left">Quantity</div>
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    min="1"
                                                                    value={taskQuantities[task.id] || 1}
                                                                    onChange={(e) => handleQuantityChange(task.id, e.target.value)}
                                                                    className="w-16 text-sm px-2.5 py-1.5 border border-border rounded-md bg-background text-foreground"
                                                                    placeholder="1"
                                                                />
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground mb-1 text-left">Rate ({getInvoiceCurrency()})</div>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={currentFlatRate}
                                                                    onChange={(e) => handleFlatRateChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-border rounded-md bg-background text-foreground"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Hours input with custom hourly rate
                                                        <div className="flex items-center space-x-2">
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground mb-1 text-left">
                                                                    Hours {(() => {
                                                                        // Ensure currentHours is numeric for calculations
                                                                        const numericCurrentHours = parseFloat(currentHours) || 0;
                                                                        let displayHours = numericCurrentHours;
                                                                        let displayMinutes = currentMinutes;
                                                                        
                                                                        // If this task has merged subtasks, calculate total hours
                                                                        if (mergedSubtasks[task.id]) {
                                                                            const subtaskHours = invoiceTasks
                                                                                .filter(subtask => subtask.parentTaskId === task.id)
                                                                                .reduce((total, subtask) => {
                                                                                    const hours = editableHours[subtask.id] !== undefined ? editableHours[subtask.id] : subtask.hours;
                                                                                    return total + (parseFloat(hours) || 0);
                                                                                }, 0);
                                                                            displayHours = numericCurrentHours + subtaskHours;
                                                                            displayMinutes = hoursToMinutes(displayHours);
                                                                        }
                                                                        
                                                                        return `(${displayMinutes}min)`;
                                                                    })()}
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={(() => {
                                                                        if (currentHours === '') return '';
                                                                        
                                                                        // Ensure currentHours is a number
                                                                        const numericCurrentHours = parseFloat(currentHours) || 0;
                                                                        
                                                                        if (mergedSubtasks[task.id]) {
                                                                            // Calculate combined hours for display purposes
                                                                            const subtaskHours = invoiceTasks
                                                                                .filter(subtask => subtask.parentTaskId === task.id)
                                                                                .reduce((total, subtask) => {
                                                                                    const hours = editableHours[subtask.id] !== undefined ? editableHours[subtask.id] : subtask.hours;
                                                                                    return total + (parseFloat(hours) || 0);
                                                                                }, 0);
                                                                            const totalHours = numericCurrentHours + subtaskHours;
                                                                            return totalHours.toFixed(2);
                                                                        }
                                                                        
                                                                        return numericCurrentHours.toFixed(2);
                                                                    })()}
                                                                    onChange={(e) => handleHoursChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-border rounded-md bg-background text-foreground"
                                                                    title={mergedSubtasks[task.id] ? "This shows the combined hours of parent and subtasks. Editing changes the parent task hours." : ""}
                                                                />
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground mb-1 text-left">Hourly rate</div>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={taskHourlyRates[task.id] !== undefined ? taskHourlyRates[task.id] : (selectedProject?.hourlyRate !== null && selectedProject?.hourlyRate !== undefined ? selectedProject.hourlyRate : (selectedClient?.hourlyRate !== null && selectedClient?.hourlyRate !== undefined ? selectedClient.hourlyRate : ''))}
                                                                    onChange={(e) => handleTaskHourlyRateChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-border rounded-md bg-background text-foreground"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Additional Tasks */}
                                    {additionalTasks.map((task) => {
                                        const currentMinutes = hoursToMinutes(task.hours || 0);
                                        const currentFlatRate = task.flatRate !== undefined ? task.flatRate : '';

                                        // Check if this task uses flat rate (from task object or state)
                                        const isUsingFlatRate = task.useFlatRate || useFlatRate[task.id] || false;

                                        return (
                                            <div key={task.id} className="flex items-center justify-between p-3 bg-muted rounded border">
                                                <div className="flex items-center space-x-3 flex-1">
                                                    {/* Task remove button */}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveAdditionalTask(task.id)}
                                                        className="text-red-600 hover:text-red-800"
                                                        title="Remove task"
                                                        aria-label="Remove task"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </Button>
                                                    <div className="flex-1 pr-4">
                                                        <p className="text-sm font-medium text-foreground overflow-hidden" style={{ 
                                                            display: '-webkit-box', 
                                                            WebkitLineClamp: 2, 
                                                            WebkitBoxOrient: 'vertical' 
                                                        }}>{task.title}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Custom task
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    {/* Add flat rate toggle */}
                                                    <div className="flex items-center ">
                                                        <CustomCheckbox
                                                            checked={isUsingFlatRate}
                                                            onChange={(checked) => handleToggleAdditionalTaskFlatRate(task.id, checked)}
                                                            label="Flat rate"
                                                            labelClassName="text-xs text-foreground"
                                                            id={`flat-rate-${task.id}`}
                                                        />
                                                    </div>

                                                    {isUsingFlatRate ? (
                                                        // Flat rate input with quantity
                                                        <div className="flex items-center space-x-2">
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground mb-1 text-left">Quantity</div>
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    min="1"
                                                                    value={task.quantity || 1}
                                                                    onChange={(e) => handleAdditionalTaskQuantityChange(task.id, e.target.value)}
                                                                    className="w-16 text-sm px-2.5 py-1.5 border border-border rounded-md bg-background text-foreground"
                                                                    placeholder="1"
                                                                />
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground mb-1 text-left">Rate ({getInvoiceCurrency()})</div>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={currentFlatRate}
                                                                    onChange={(e) => handleAdditionalTaskFlatRateChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-border rounded-md bg-background text-foreground"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // Hours input with custom hourly rate
                                                        <div className="flex items-center space-x-2">
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground mb-1 text-left">Hours ({currentMinutes}min)</div>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={task.hours}
                                                                    onChange={(e) => handleAdditionalTaskHoursChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-border rounded-md bg-background text-foreground"
                                                                />
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs text-muted-foreground mb-1 text-left">Hourly rate</div>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={task.hourlyRate !== undefined ? task.hourlyRate : (selectedProject?.hourlyRate !== null && selectedProject?.hourlyRate !== undefined ? selectedProject.hourlyRate : (selectedClient?.hourlyRate !== null && selectedClient?.hourlyRate !== undefined ? selectedClient.hourlyRate : ''))}
                                                                    onChange={(e) => handleAdditionalTaskHourlyRateChange(task.id, e.target.value)}
                                                                    className="w-20 text-sm px-2.5 py-1.5 border border-border rounded-md bg-background text-foreground"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Add Task Form */}
                                {showAddTaskForm && (
                                    <div className="mt-2 mb-2 p-3 bg-muted border border-border rounded-md">
                                        <div className="space-y-3">
                                            <div>
                                                <Input
                                                    ref={taskInputRef}
                                                    type="text"
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                                    placeholder="Task description"
                                                    required
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleAddAdditionalTask();
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <div className="flex justify-between items-end">
                                                {/* Checkbox + Inputs */}
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex items-center space-x-2 mr-1">
                                                        <CustomCheckbox
                                                            checked={newTaskUseFlatRate}
                                                            onChange={handleToggleNewTaskFlatRate}
                                                            label="Flat rate"
                                                            labelClassName="text-xs text-foreground"
                                                            id="new-task-flat-rate"
                                                        />
                                                    </div>

                                                    {newTaskUseFlatRate && (
                                                        <div className="text-right">
                                                            <div className="text-xs text-muted-foreground mb-1 text-left">Quantity</div>
                                                            <Input
                                                                type="number"
                                                                step="1"
                                                                min="1"
                                                                value={newTaskQuantity}
                                                                onChange={(e) => setNewTaskQuantity(e.target.value)}
                                                                className="w-16 h-9"
                                                                placeholder="1"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleAddAdditionalTask();
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="text-right">
                                                        <div className="text-xs text-muted-foreground mb-1 text-left">
                                                            {newTaskUseFlatRate ? `Rate (${getInvoiceCurrency()})` : `Hours ${newTaskHours ? `(${hoursToMinutes(parseFloat(newTaskHours) || 0)}min)` : ''}`}
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={newTaskHours}
                                                            onChange={(e) => setNewTaskHours(e.target.value)}
                                                            placeholder={newTaskUseFlatRate ? "0.00" : "Hours"}
                                                            className="w-24 h-9"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleAddAdditionalTask();
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    {!newTaskUseFlatRate && (
                                                        <div className="text-right">
                                                            <div className="text-xs text-muted-foreground mb-1 text-left">Hourly rate</div>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={newTaskHourlyRate !== '' ? newTaskHourlyRate : (selectedProject?.hourlyRate !== null && selectedProject?.hourlyRate !== undefined ? selectedProject.hourlyRate : (selectedClient?.hourlyRate !== null && selectedClient?.hourlyRate !== undefined ? selectedClient.hourlyRate : ''))}
                                                                onChange={(e) => setNewTaskHourlyRate(e.target.value)}
                                                                placeholder="0.00"
                                                                className="w-20 h-9"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleAddAdditionalTask();
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Buttons */}
                                                <div className="flex space-x-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() => {
                                                            setShowAddTaskForm(false);
                                                            setNewTaskTitle('');
                                                            setNewTaskHours('');
                                                            setNewTaskHourlyRate('');
                                                            setNewTaskUseFlatRate(selectedProject?.flatRate || false);
                                                        }}
                                                    >
                                                        Cancel
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        onClick={handleAddAdditionalTask}
                                                    >
                                                        Add Task
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Warning message for no tasks or no selected tasks */}
                                {(() => {
                                    const selectedTasksCount = Object.values(selectedTasksForBilling).filter(Boolean).length;
                                    const totalAvailableTasks = invoiceTasks.length + additionalTasks.length;

                                    if (totalAvailableTasks === 0) {
                                        return (
                                            <div className="bg-muted border border-border rounded-md p-3">
                                                <p className="text-sm text-foreground">
                                                    Please add a task to continue.
                                                </p>
                                            </div>
                                        );
                                    } else if (selectedTasksCount === 0 && additionalTasks.length === 0) {
                                        return (
                                            <Notice
                                                title="Please select or create at least one task to bill."
                                                className="mt-2"
                                            />
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Pricing & Totals */}
                <div className="border border-border rounded-lg">
                    <button
                        type="button"
                        onClick={() => toggleSection('pricingTotals')}
                        className={`w-full px-4 py-3 text-left bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'pricingTotals' ? 'rounded-t-lg' : 'rounded-lg'}`}
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">Pricing & Totals</h4>
                            <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-blue-600">
                                    {getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.total.toFixed(2)}
                                </span>
                                <svg
                                    className={`w-5 h-5 text-muted-foreground transform transition-transform ${activeSection === 'pricingTotals' ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </button>
                    {activeSection === 'pricingTotals' && (
                        <div className="p-4 space-y-4">
                            {/* Discount Settings */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Discount</label>
                                <div className="flex space-x-2">
                                    <Select
                                        value={discountType}
                                        onValueChange={setDiscountType}
                                    >
                                        <SelectTrigger className="w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">%</SelectItem>
                                            <SelectItem value="fixed">{getCurrencySymbol(getInvoiceCurrency())}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={discountValue === '' ? '' : discountValue}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            if (newValue === '') {
                                                setDiscountValue('');
                                            } else {
                                                setDiscountValue(parseFloat(newValue) || 0);
                                            }
                                        }}
                                        className="flex-1 text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                                        placeholder={discountType === 'percentage' ? '0.00' : '0.00'}
                                    />
                                </div>
                            </div>

                            {/* Shipping */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Shipping</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={shippingAmount === '' ? '' : shippingAmount}
                                    onChange={(e) => {
                                        const newValue = e.target.value;
                                        if (newValue === '') {
                                            setShippingAmount('');
                                        } else {
                                            setShippingAmount(parseFloat(newValue) || 0);
                                        }
                                    }}
                                    className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Tax Override */}
                            <div>
                                <div className="flex items-center space-x-2 mb-2">
                                    <CustomCheckbox
                                        checked={taxOverride.enabled}
                                        onChange={(checked) => setTaxOverride(prev => ({ ...prev, enabled: checked }))}
                                        label={
                                            <>
                                                Override tax settings
                                                {!taxOverride.enabled && (
                                                    <span className="text-muted-foreground font-normal ml-1">
                                                        {selectedBusinessInfo?.taxEnabled && (!selectedClient || !selectedClient.disableTax) && (
                                                            <>({selectedBusinessInfo.taxLabel} {selectedBusinessInfo.taxRate}%)</>
                                                        )}
                                                        {selectedClient?.disableTax && (
                                                            <>(tax disabled for this client)</>
                                                        )}
                                                        {!selectedClient?.disableTax && (!selectedBusinessInfo || !selectedBusinessInfo.taxEnabled) && (
                                                            <>(no tax configured)</>
                                                        )}
                                                    </span>
                                                )}
                                            </>
                                        }
                                        labelClassName="text-sm font-medium text-foreground"
                                        id="taxOverrideEnabled"
                                    />
                                </div>

                                {taxOverride.enabled && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <input
                                                type="text"
                                                value={taxOverride.label}
                                                onChange={(e) => setTaxOverride(prev => ({ ...prev, label: e.target.value }))}
                                                className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                                                placeholder="Tax label"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                                value={taxOverride.rate === '' ? '' : taxOverride.rate}
                                                onChange={(e) => {
                                                    const newValue = e.target.value;
                                                    if (newValue === '') {
                                                        setTaxOverride(prev => ({ ...prev, rate: '' }));
                                                    } else {
                                                        setTaxOverride(prev => ({ ...prev, rate: parseFloat(newValue) || 0 }));
                                                    }
                                                }}
                                                className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                                                placeholder="Rate %"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pricing Breakdown */}
                            <div className="border-t pt-3 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal:</span>
                                    <span>{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.subtotal.toFixed(2)}</span>
                                </div>

                                {calculatePricing.discount > 0 && (
                                    <div className="flex justify-between text-sm text-red-600">
                                        <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : getCurrencySymbol(getInvoiceCurrency()) + discountValue}):</span>
                                        <span>-{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.discount.toFixed(2)}</span>
                                    </div>
                                )}

                                {calculatePricing.shipping > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span>Shipping:</span>
                                        <span>{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.shipping.toFixed(2)}</span>
                                    </div>
                                )}

                                {calculatePricing.tax > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span>{calculatePricing.taxLabel} ({calculatePricing.taxRate}%):</span>
                                        <span>{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.tax.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between text-base font-medium border-t pt-2">
                                    <span>Total:</span>
                                    <span>{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

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
