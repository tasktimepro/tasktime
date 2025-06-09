// InvoiceHandler.js
// Extracted handler functions from InvoiceGenerator for use in InvoiceModal and related invoice logic

// Handles selecting/deselecting tasks for billing
export const handleTaskSelectionForBilling = (setSelectedTasksForBilling) => (taskId, selected) => {
    setSelectedTasksForBilling(prev => ({
        ...prev,
        [taskId]: selected
    }));
};

// Handles hours modification for invoice tasks
export const handleHoursChange = (setEditableHours) => (taskId, newHours) => {
    if (newHours === '') {
        setEditableHours(prev => ({
            ...prev,
            [taskId]: ''
        }));
    } else {
        // Allow direct input without immediate formatting
        setEditableHours(prev => ({
            ...prev,
            [taskId]: newHours
        }));
    }
};

// Handles flat rate modification for invoice tasks
export const handleFlatRateChange = (setTaskFlatRates) => (taskId, newRate) => {
    if (newRate === '') {
        setTaskFlatRates(prev => ({
            ...prev,
            [taskId]: ''
        }));
    } else {
        // Allow direct input without immediate formatting
        setTaskFlatRates(prev => ({
            ...prev,
            [taskId]: newRate
        }));
    }
};

// Handles quantity modification for flat rate tasks
export const handleQuantityChange = (setTaskQuantities) => (taskId, newQuantity) => {
    if (newQuantity === '') {
        setTaskQuantities(prev => ({
            ...prev,
            [taskId]: ''
        }));
    } else {
        // Allow direct input without immediate formatting
        setTaskQuantities(prev => ({
            ...prev,
            [taskId]: newQuantity
        }));
    }
};

// Handles hourly rate modification for invoice tasks
export const handleTaskHourlyRateChange = (setTaskHourlyRates) => (taskId, newRate) => {
    if (newRate === '') {
        setTaskHourlyRates(prev => ({
            ...prev,
            [taskId]: ''
        }));
    } else {
        // Allow direct input without immediate formatting
        setTaskHourlyRates(prev => ({
            ...prev,
            [taskId]: newRate
        }));
    }
};

// Toggle task between flat rate and hourly pricing
export const handleToggleFlatRate = (setUseFlatRate, setTaskFlatRates, setTaskQuantities, invoiceTasks, editableHours, selectedProject, taskFlatRates, taskQuantities, handleFlatRateChange) => (taskId, value) => {
    setUseFlatRate(prev => ({
        ...prev,
        [taskId]: value
    }));

    if (value && taskFlatRates[taskId] === undefined) {
        // Only set a flat rate if one doesn't exist, and only if we have a valid hourly rate
        const task = invoiceTasks.find(t => t.id === taskId);
        if (task && selectedProject?.hourlyRate) {
            const hourlyAmount = (editableHours[taskId] || task.hours) * selectedProject.hourlyRate;
            handleFlatRateChange(taskId, hourlyAmount || '');
        } else {
            // Don't set any default value, leave it empty
            handleFlatRateChange(taskId, '');
        }
    }

    if (value && !taskQuantities[taskId]) {
        setTaskQuantities(prev => ({
            ...prev,
            [taskId]: 1
        }));
    }
};

// Toggle new task between flat rate and hourly pricing
export const handleToggleNewTaskFlatRate = (setNewTaskUseFlatRate) => () => {
    setNewTaskUseFlatRate(prev => !prev);
};

// Handle adding additional custom task
export const handleAddAdditionalTask = (setAdditionalTasks, setUseFlatRate, newTaskTitle, newTaskHours, newTaskUseFlatRate, newTaskHourlyRate, selectedProject, newTaskQuantity, setNewTaskTitle, setNewTaskHours, setNewTaskHourlyRate, setNewTaskUseFlatRate, setNewTaskQuantity, setShowAddTaskForm, showError, focusTaskInput) => () => {
    if (!newTaskTitle.trim()) {
        showError('Task description is required');
        if (focusTaskInput) {
            focusTaskInput();
        }
        return;
    }
    const parsedValue = parseFloat(newTaskHours) || 0;
    const roundedValue = Math.round(parsedValue * 100) / 100;
    const newTask = {
        id: `custom-${Date.now()}`,
        title: newTaskTitle.trim(),
        hours: newTaskUseFlatRate ? 0 : roundedValue,
        flatRate: newTaskUseFlatRate ? roundedValue : 0,
        hourlyRate: newTaskUseFlatRate ? 0 : (newTaskHourlyRate !== '' ? parseFloat(newTaskHourlyRate) : (selectedProject?.hourlyRate !== undefined && selectedProject?.hourlyRate !== null ? selectedProject.hourlyRate : 0)),
        quantity: newTaskUseFlatRate ? newTaskQuantity : 1,
        isCustom: true,
        useFlatRate: newTaskUseFlatRate
    };
    setAdditionalTasks(prev => [...prev, newTask]);
    if (newTaskUseFlatRate) {
        setUseFlatRate(prev => ({
            ...prev,
            [newTask.id]: true
        }));
    }
    setNewTaskTitle('');
    setNewTaskHours('');
    setNewTaskHourlyRate('');
    setNewTaskUseFlatRate(false);
    setNewTaskQuantity(1);
    setShowAddTaskForm(false);
};

// Handle removing additional task
export const handleRemoveAdditionalTask = (setAdditionalTasks) => (taskId) => {
    setAdditionalTasks(prev => prev.filter(task => task.id !== taskId));
};

// Handle editing additional task hours
export const handleAdditionalTaskHoursChange = (setAdditionalTasks) => (taskId, newHours) => {
    if (newHours === '') {
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, hours: '' } : task
        ));
    } else {
        // Allow direct input without immediate formatting
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, hours: newHours } : task
        ));
    }
};

// Handle editing additional task flat rate
export const handleAdditionalTaskFlatRateChange = (setAdditionalTasks) => (taskId, newRate) => {
    if (newRate === '') {
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, flatRate: '' } : task
        ));
    } else {
        // Allow direct input without immediate formatting
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, flatRate: newRate } : task
        ));
    }
};

// Handle editing additional task quantity
export const handleAdditionalTaskQuantityChange = (setAdditionalTasks) => (taskId, newQuantity) => {
    if (newQuantity === '') {
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, quantity: '' } : task
        ));
    } else {
        // Allow direct input without immediate formatting
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, quantity: newQuantity } : task
        ));
    }
};

// Handle editing additional task hourly rate
export const handleAdditionalTaskHourlyRateChange = (setAdditionalTasks) => (taskId, newRate) => {
    if (newRate === '') {
        setAdditionalTasks(prev => prev.map(task =>
            task.id === taskId ? { ...task, hourlyRate: '' } : task
        ));
    } else {
        // Allow direct input without immediate formatting
        setAdditionalTasks(prev => prev.map(task =>
            task.id === taskId ? { ...task, hourlyRate: newRate } : task
        ));
    }
};

// Handle client info selection from dropdown
export const handleClientInfoSelection = (setSelectedClientInfo, clientInfos) => (clientInfoId) => {
    if (clientInfoId === "") {
        setSelectedClientInfo(null);
    } else {
        const clientInfo = clientInfos.find(ci => ci.id === clientInfoId);
        if (clientInfo) {
            setSelectedClientInfo(clientInfo);
        }
    }
};

// Complete form reset - clears all invoice form data
export const handleResetInvoiceForm = (
    setInvoiceTasks,
    setEditableHours,
    setTaskFlatRates,
    setUseFlatRate,
    setTaskHourlyRates,
    setTaskQuantities,
    setAdditionalTasks,
    setInvoiceNote,
    setDiscountType,
    setDiscountValue,
    setShippingAmount,
    setTaxOverride,
    setSelectedTasksForBilling,
    setNewTaskQuantity,
    setMergedSubtasks,
    setInvoiceDateOverride,
    setUseInvoiceDateOverride
) => () => {
    setInvoiceTasks([]);
    setEditableHours({});
    setTaskFlatRates({});
    setUseFlatRate({});
    setTaskHourlyRates({});
    setTaskQuantities({});
    setAdditionalTasks([]);
    setInvoiceNote('');
    setDiscountType('percentage');
    setDiscountValue(0);
    setShippingAmount(0);
    setTaxOverride({
        enabled: false,
        label: '',
        rate: 0
    });
    setSelectedTasksForBilling({});
    setNewTaskQuantity(1);
    setMergedSubtasks({});
    setInvoiceDateOverride('');
    setUseInvoiceDateOverride(false);
};

// Handle project selection from dropdown
export const handleProjectSelection = (
    setSelectedProject,
    setProjectManuallyChanged,
    resetInvoiceForm,
    setSelectedClientInfo,
    setSelectedBusinessInfo,
    setSelectedPaymentMethod,
    setInvoiceTasks,
    setEditableHours,
    setSelectedTasksForBilling,
    projects,
    invoices,
    clientInfos,
    businessInfos,
    paymentMethods,
    prepareInvoiceData,
    setSelectedTemplate,
    invoiceTemplates,
    setUseFlatRate,
    setTaskQuantities
) => (projectId) => {
    if (projectId === "") {
        setSelectedProject(null);
        resetInvoiceForm();
        setSelectedClientInfo(null);
        setSelectedBusinessInfo(null);
        setSelectedPaymentMethod(null);
    } else {
        const selectedProj = projects.find(p => p.id === projectId);
        if (selectedProj) {
            setSelectedProject(selectedProj);
            setProjectManuallyChanged(true);
            
            resetInvoiceForm();
            
            setSelectedClientInfo(null);
            setSelectedBusinessInfo(null);
            setSelectedPaymentMethod(null);
            
            // Pre-populate based on last invoice for this project
            const projectInvoicesForSelection = invoices.filter(invoice => 
                (selectedProj.invoiceIds || []).includes(invoice.id)
            );
            
            if (projectInvoicesForSelection.length > 0) {
                const lastInvoice = projectInvoicesForSelection[projectInvoicesForSelection.length - 1];
                
                if (lastInvoice.clientInfoId) {
                    const clientInfo = clientInfos.find(ci => ci.id === lastInvoice.clientInfoId);
                    if (clientInfo) {
                        setSelectedClientInfo(clientInfo);
                    }
                }
                
                if (lastInvoice.businessInfoId) {
                    const businessInfo = businessInfos.find(bi => bi.id === lastInvoice.businessInfoId);
                    if (businessInfo) {
                        setSelectedBusinessInfo(businessInfo);
                    }
                }
                
                if (lastInvoice.paymentMethodId) {
                    const paymentMethod = paymentMethods.find(pm => pm.id === lastInvoice.paymentMethodId);
                    if (paymentMethod) {
                        setSelectedPaymentMethod(paymentMethod);
                    }
                }
                
                // Set the previously used template for this project if available
                if (lastInvoice.templateId && setSelectedTemplate && invoiceTemplates) {
                    const template = invoiceTemplates.find(t => t.id === lastInvoice.templateId);
                    if (template) {
                        setSelectedTemplate(template);
                        console.log(`Pre-selected template "${template.name}" based on previous invoice for project ${selectedProj.title}`);
                    }
                }
            }
            
            const tasksData = prepareInvoiceData(selectedProj);
            
            setInvoiceTasks([]);
            setEditableHours({});
            
            if (tasksData && tasksData.length > 0) {
                setInvoiceTasks(tasksData);
                const initialHours = {};
                const initialTaskSelection = {};
                const initialFlatRateToggles = {};
                const initialTaskQuantities = {};
                
                tasksData.forEach(task => {
                    initialHours[task.id] = task.originalHours;
                    initialTaskSelection[task.id] = true;
                    
                    // For flat rate projects, pre-toggle all tasks to flat rate
                    if (selectedProj.flatRate) {
                        initialFlatRateToggles[task.id] = true;
                        initialTaskQuantities[task.id] = 1;
                    }
                });
                
                setEditableHours(initialHours);
                setSelectedTasksForBilling(initialTaskSelection);
                
                // Apply flat rate toggles if project is flat rate
                if (selectedProj.flatRate && setUseFlatRate) {
                    setUseFlatRate(initialFlatRateToggles);
                    if (setTaskQuantities) {
                        setTaskQuantities(initialTaskQuantities);
                    }
                }
            }
        }
    }
};

// Handle canceling the form
export const handleCancel = (
    setShowInvoiceForm,
    resetInvoiceForm,
    setProjectManuallyChanged,
    onInvoiceSaved
) => () => {
    setShowInvoiceForm(false);
    resetInvoiceForm();
    setProjectManuallyChanged(false);
    
    if (onInvoiceSaved) {
        onInvoiceSaved();
    }
};

// Handle merging subtasks with parent task
export const handleToggleMergeSubtasks = (
    setMergedSubtasks,
    setSelectedTasksForBilling,
    invoiceTasks,
    taskHourlyRates,
    projectHourlyRate,
    showWarning = null
) => (parentTaskId, shouldMerge) => {
    // Check for hourly rate mismatch when merging
    if (shouldMerge && showWarning) {
        const hasMismatch = checkHourlyRateMismatch(parentTaskId, invoiceTasks, taskHourlyRates, projectHourlyRate);
        
        if (hasMismatch) {
            // Find the subtasks to show specific rate details
            const subtasks = invoiceTasks.filter(task => task.parentTaskId === parentTaskId);
            
            // Determine parent's hourly rate
            const parentRate = taskHourlyRates[parentTaskId] !== undefined ? 
                parseFloat(taskHourlyRates[parentTaskId]) : 
                projectHourlyRate || 0;
            
            // Find the differing subtask rates
            const differentRateSubtasks = subtasks.filter(subtask => {
                const subtaskRate = taskHourlyRates[subtask.id] !== undefined ?
                    parseFloat(taskHourlyRates[subtask.id]) :
                    projectHourlyRate || 0;
                
                return Math.abs(parentRate - subtaskRate) > 0.01;
            });
            
            if (differentRateSubtasks.length > 0) {
                // Show a more specific warning message
                showWarning(`Warning: ${differentRateSubtasks.length} subtask(s) have different hourly rates than the parent task. When merged, the parent task's hourly rate (${parentRate}) will be used for all hours.`);
            }
        }
    }
    
    setMergedSubtasks(prev => ({
        ...prev,
        [parentTaskId]: shouldMerge
    }));
    
    if (shouldMerge) {
        // When merging, hide subtasks from billing selection by deselecting them
        const subtasks = invoiceTasks.filter(task => task.parentTaskId === parentTaskId);
        const updatedSelection = {};
        
        subtasks.forEach(subtask => {
            updatedSelection[subtask.id] = false;
        });
        
        setSelectedTasksForBilling(prev => ({
            ...prev,
            ...updatedSelection
        }));
    } else {
        // When unmerging, make subtasks available for selection again
        const subtasks = invoiceTasks.filter(task => task.parentTaskId === parentTaskId);
        const updatedSelection = {};
        
        subtasks.forEach(subtask => {
            updatedSelection[subtask.id] = true; // Default to selected
        });
        
        setSelectedTasksForBilling(prev => ({
            ...prev,
            ...updatedSelection
        }));
    }
};

// Check if a parent task has subtasks in the current invoice task list
export const hasSubtasksInInvoice = (parentTaskId, invoiceTasks) => {
    return invoiceTasks.some(task => task.parentTaskId === parentTaskId);
};

// Check if there's an hourly rate mismatch between parent and subtasks
export const checkHourlyRateMismatch = (parentTaskId, invoiceTasks, taskHourlyRates, projectHourlyRate) => {
    const parent = invoiceTasks.find(task => task.id === parentTaskId);
    if (!parent) return false;
    
    const subtasks = invoiceTasks.filter(task => task.parentTaskId === parentTaskId);
    if (subtasks.length === 0) return false;
    
    // Determine parent's hourly rate (explicit or from project)
    const parentRate = taskHourlyRates[parentTaskId] !== undefined ? 
        parseFloat(taskHourlyRates[parentTaskId]) : 
        projectHourlyRate || 0;
    
    // Check if any subtask has a different hourly rate
    return subtasks.some(subtask => {
        const subtaskRate = taskHourlyRates[subtask.id] !== undefined ?
            parseFloat(taskHourlyRates[subtask.id]) :
            projectHourlyRate || 0;
        
        // Consider a difference of more than 0.01 as a mismatch to account for floating point imprecision
        return Math.abs(parentRate - subtaskRate) > 0.01;
    });
};

// Get subtasks for a parent task from the invoice task list
export const getSubtasksFromInvoice = (parentTaskId, invoiceTasks) => {
    return invoiceTasks.filter(task => task.parentTaskId === parentTaskId);
};

// Calculate merged task data (combining parent task with its subtasks)
export const getMergedTaskData = (parentTask, subtasks, editableHours) => {
    if (!subtasks.length) return parentTask;
    
    // Calculate total hours from parent and all subtasks
    const parentHours = editableHours[parentTask.id] !== undefined ? editableHours[parentTask.id] : parentTask.hours;
    const subtaskHours = subtasks.reduce((total, subtask) => {
        const hours = editableHours[subtask.id] !== undefined ? editableHours[subtask.id] : subtask.hours;
        return total + hours;
    }, 0);
    
    const totalHours = parentHours + subtaskHours;
    
    // Return merged task data
    return {
        ...parentTask,
        hours: totalHours,
        mergedSubtasks: subtasks,
        isMerged: true,
        title: `${parentTask.title} (including ${subtasks.length} subtask${subtasks.length > 1 ? 's' : ''})`
    };
};

// Get all task IDs that should be billed (including merged subtasks)
export const getAllBilledTaskIds = (invoiceTasks, selectedTasksForBilling, mergedSubtasks) => {
    const billedTaskIds = [];
    
    invoiceTasks.forEach(task => {
        // If task is selected for billing
        if (selectedTasksForBilling[task.id]) {
            billedTaskIds.push(task.id);
            
            // If this is a parent task with merged subtasks, include the subtask IDs too
            if (mergedSubtasks[task.id]) {
                const subtasks = getSubtasksFromInvoice(task.id, invoiceTasks);
                subtasks.forEach(subtask => {
                    billedTaskIds.push(subtask.id);
                });
            }
        }
    });
    
    return billedTaskIds;
};

// Handle template selection from dropdown
export const handleTemplateSelection = (setSelectedTemplate, invoiceTemplates) => (templateId) => {
    if (templateId === "") {
        setSelectedTemplate(null);
    } else {
        const template = invoiceTemplates.find(t => t.id === templateId);
        if (template) {
            setSelectedTemplate(template);
        }
    }
};
