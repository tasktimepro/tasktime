import { useMemo } from 'react';

/**
 * useInvoicePricing - Calculates pricing breakdown for invoice.
 */
const useInvoicePricing = ({
    invoiceTasks,
    additionalTasks,
    editableHours,
    discountType,
    discountValue,
    shippingAmount,
    taxOverride,
    taskFlatRates,
    useFlatRate,
    taskHourlyRates,
    taskQuantities,
    selectedTasksForBilling,
    mergedSubtasks,
    selectedBusinessInfo,
    selectedClient,
    selectedProject
}) => {

    const pricing = useMemo(() => {
        if (invoiceTasks.length === 0 && additionalTasks.length === 0) {
            return {
                subtotal: 0,
                discount: 0,
                shipping: 0,
                tax: 0,
                total: 0,
                totalHours: 0,
                taxRate: 0,
                taxLabel: 'VAT'
            };
        }

        // Calculate project subtotal by adding up task amounts
        let projectSubtotal = 0;
        let additionalTaskAmount = 0;
        let totalHours = 0;

        // Calculate regular project tasks subtotal (only include selected tasks)
        invoiceTasks.forEach(task => {
            // Skip if task is null or id is missing
            if (!task || !task.id) return;

            // Only include selected tasks in pricing calculation
            if (!selectedTasksForBilling[task.id]) return;

            // Skip subtasks if their parent is merged (they're included in parent calculation)
            if (task.parentTaskId && mergedSubtasks[task?.parentTaskId]) return;

            let taskHours = editableHours[task.id] || task.hours || 0;

            // If this task has merged subtasks, include their hours too
            if (task && task.id && mergedSubtasks[task.id]) {
                const subtasks = invoiceTasks.filter(subtask => subtask && subtask.parentTaskId === task.id);
                const subtaskHours = subtasks.reduce((total, subtask) => {
                    const hours = editableHours[subtask.id] !== undefined ? editableHours[subtask.id] : subtask.hours;
                    return total + hours;
                }, 0);
                taskHours += subtaskHours;
            }

            // Always add task hours to total hours, even for flat rate tasks
            totalHours += taskHours;

            if (useFlatRate[task.id]) {
                // Use flat rate for this task with quantity
                const quantity = taskQuantities[task.id] || 1;
                projectSubtotal += (taskFlatRates[task.id] || 0) * quantity;
            } else {
                // Use task-specific hourly rate if available, otherwise fall back to project rate, then client rate
                const hourlyRate = taskHourlyRates[task.id] || task.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0;
                projectSubtotal += taskHours * hourlyRate;
            }
        });

        // Calculate additional tasks subtotal
        additionalTasks.forEach(task => {
            if (task.useFlatRate) {
                // Use flat rate with quantity
                const quantity = task.quantity || 1;
                additionalTaskAmount += (task.flatRate || 0) * quantity;
            } else {
                const hourlyRate = task.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0;
                const taskHours = task.hours || 0;
                additionalTaskAmount += taskHours * hourlyRate;
                // Add hours to total for hourly tasks
                totalHours += taskHours;
            }
        });

        const subtotal = projectSubtotal + additionalTaskAmount;

        // Calculate discount
        const discountVal = discountValue === '' ? 0 : discountValue;
        const discount = discountType === 'percentage'
            ? (subtotal * (discountVal / 100))
            : discountVal;

        // Subtotal after discount
        const afterDiscount = subtotal - discount;

        // Add shipping
        const shipping = shippingAmount === '' ? 0 : parseFloat(shippingAmount) || 0;
        const afterShipping = afterDiscount + shipping;

        // Calculate tax
        let taxRate = 0;
        let taxLabel = 'VAT';

        if (taxOverride.enabled) {
            taxRate = taxOverride.rate === '' ? 0 : parseFloat(taxOverride.rate) || 0;
            taxLabel = taxOverride.label || 'Tax';
        } else if (selectedBusinessInfo && selectedBusinessInfo.taxEnabled && (!selectedClient || !selectedClient.disableTax)) {
            // Use business tax settings if enabled and client doesn't have tax disabled
            taxRate = selectedBusinessInfo.taxRate || 0;
            taxLabel = selectedBusinessInfo.taxLabel || 'VAT';
        }

        const tax = (afterShipping * (taxRate / 100));
        const total = afterShipping + tax;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            discount: Math.round(discount * 100) / 100,
            shipping: Math.round(shipping * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total: Math.round(total * 100) / 100,
            totalHours: Math.round(totalHours * 100) / 100,
            taxRate,
            taxLabel
        };
    }, [
        selectedProject,
        invoiceTasks,
        additionalTasks,
        editableHours,
        discountType,
        discountValue,
        shippingAmount,
        taxOverride,
        taskFlatRates,
        useFlatRate,
        taskHourlyRates,
        taskQuantities,
        selectedTasksForBilling,
        mergedSubtasks,
        selectedBusinessInfo,
        selectedClient
    ]);

    return pricing;
};

export default useInvoicePricing;
