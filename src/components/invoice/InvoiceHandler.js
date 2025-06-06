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
        const parsedHours = parseFloat(newHours) || 0;
        const roundedHours = Math.round(parsedHours * 100) / 100;
        setEditableHours(prev => ({
            ...prev,
            [taskId]: roundedHours
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
        const parsedRate = parseFloat(newRate) || 0;
        const roundedRate = Math.round(parsedRate * 100) / 100;
        setTaskFlatRates(prev => ({
            ...prev,
            [taskId]: roundedRate
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
        const parsedQuantity = parseFloat(newQuantity) || 1;
        const roundedQuantity = Math.max(1, Math.round(parsedQuantity * 100) / 100);
        setTaskQuantities(prev => ({
            ...prev,
            [taskId]: roundedQuantity
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
        const parsedRate = parseFloat(newRate) || 0;
        const roundedRate = Math.round(parsedRate * 100) / 100;
        setTaskHourlyRates(prev => ({
            ...prev,
            [taskId]: roundedRate
        }));
    }
};

// Toggle task between flat rate and hourly pricing
export const handleToggleFlatRate = (setUseFlatRate, setTaskFlatRates, setTaskQuantities, invoiceTasks, editableHours, selectedProject, taskFlatRates, taskQuantities, handleFlatRateChange) => (taskId, value) => {
    setUseFlatRate(prev => ({
        ...prev,
        [taskId]: value
    }));
    if (value && !taskFlatRates[taskId]) {
        const task = invoiceTasks.find(t => t.id === taskId);
        if (task) {
            const hourlyAmount = (editableHours[taskId] || task.hours) * (selectedProject?.hourlyRate || 0);
            handleFlatRateChange(taskId, hourlyAmount);
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
export const handleAddAdditionalTask = (setAdditionalTasks, setUseFlatRate, newTaskTitle, newTaskHours, newTaskUseFlatRate, newTaskHourlyRate, selectedProject, newTaskQuantity, setNewTaskTitle, setNewTaskHours, setNewTaskHourlyRate, setNewTaskUseFlatRate, setNewTaskQuantity, setShowAddTaskForm) => () => {
    if (!newTaskTitle.trim()) return;
    const parsedValue = parseFloat(newTaskHours) || 0;
    const roundedValue = Math.round(parsedValue * 100) / 100;
    const newTask = {
        id: `custom-${Date.now()}`,
        title: newTaskTitle.trim(),
        hours: newTaskUseFlatRate ? 0 : roundedValue,
        flatRate: newTaskUseFlatRate ? roundedValue : 0,
        hourlyRate: newTaskUseFlatRate ? 0 : (parseFloat(newTaskHourlyRate) || selectedProject?.hourlyRate || 0),
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
        const parsedHours = parseFloat(newHours) || 0;
        const roundedHours = Math.round(parsedHours * 100) / 100;
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, hours: roundedHours } : task
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
        const parsedRate = parseFloat(newRate) || 0;
        const roundedRate = Math.round(parsedRate * 100) / 100;
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, flatRate: roundedRate } : task
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
        const parsedQuantity = parseFloat(newQuantity) || 1;
        const roundedQuantity = Math.max(1, Math.round(parsedQuantity * 100) / 100);
        setAdditionalTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, quantity: roundedQuantity } : task
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
        const parsedRate = parseFloat(newRate) || 0;
        const roundedRate = Math.round(parsedRate * 100) / 100;
        setAdditionalTasks(prev => prev.map(task =>
            task.id === taskId ? { ...task, hourlyRate: roundedRate } : task
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
    setNewTaskQuantity
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
    prepareInvoiceData
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
            }
            
            const tasksData = prepareInvoiceData(selectedProj);
            
            setInvoiceTasks([]);
            setEditableHours({});
            
            if (tasksData && tasksData.length > 0) {
                setInvoiceTasks(tasksData);
                const initialHours = {};
                const initialTaskSelection = {};
                tasksData.forEach(task => {
                    initialHours[task.id] = task.originalHours;
                    initialTaskSelection[task.id] = true;
                });
                setEditableHours(initialHours);
                setSelectedTasksForBilling(initialTaskSelection);
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
