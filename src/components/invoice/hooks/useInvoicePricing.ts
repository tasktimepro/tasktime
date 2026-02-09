import { useMemo } from 'react';

type TaskItem = {
    id: string;
    parentTaskId?: string | null;
    hours?: number;
    hourlyRate?: number;
};

type AdditionalTask = {
    hours?: number;
    hourlyRate?: number;
    flatRate?: number;
    quantity?: number;
    useFlatRate?: boolean;
};

type ExpenseItem = {
    id: string;
    amount?: number;
};

type InvoiceOnlyExpenseItem = {
    amount?: number;
};

type BusinessInfo = {
    taxEnabled?: boolean;
    taxRate?: number;
    taxLabel?: string;
};

type ClientInfo = {
    hourlyRate?: number;
    disableTax?: boolean;
};

type ProjectInfo = {
    hourlyRate?: number;
};

type TaxOverride = {
    enabled: boolean;
    rate: string | number;
    label?: string;
};

type InvoicePricingParams = {
    invoiceTasks: TaskItem[];
    additionalTasks: AdditionalTask[];
    expenseItems: ExpenseItem[];
    invoiceOnlyExpenses?: InvoiceOnlyExpenseItem[];
    editableHours: Record<string, number>;
    discountType: 'percentage' | 'fixed';
    discountValue: number | string;
    shippingAmount: number | string;
    taxOverride: TaxOverride;
    taskFlatRates: Record<string, number>;
    useFlatRate: Record<string, boolean>;
    taskHourlyRates: Record<string, number>;
    taskQuantities: Record<string, number>;
    selectedTasksForBilling: Record<string, boolean>;
    selectedExpensesForBilling: Record<string, boolean>;
    mergedSubtasks: Record<string, boolean>;
    selectedBusinessInfo?: BusinessInfo | null;
    selectedClient?: ClientInfo | null;
    selectedProject?: ProjectInfo | null;
};

/**
 * useInvoicePricing - Calculates pricing breakdown for invoice.
 */
const useInvoicePricing = ({
    invoiceTasks,
    additionalTasks,
    expenseItems = [],
    invoiceOnlyExpenses = [],
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
    selectedExpensesForBilling = {},
    mergedSubtasks,
    selectedBusinessInfo,
    selectedClient,
    selectedProject
}: InvoicePricingParams) => {

    const pricing = useMemo(() => {
        if (invoiceTasks.length === 0 && additionalTasks.length === 0 && expenseItems.length === 0 && invoiceOnlyExpenses.length === 0) {
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
        let expenseAmount = 0;

        // Calculate regular project tasks subtotal (only include selected tasks)
        invoiceTasks.forEach(task => {
            // Skip if task is null or id is missing
            if (!task || !task.id) return;

            // Only include selected tasks in pricing calculation
            if (!selectedTasksForBilling[task.id]) return;

            // Skip subtasks if their parent is merged (they're included in parent calculation)
            if (task.parentTaskId && mergedSubtasks[task?.parentTaskId]) return;

            let taskHours = parseFloat(String(editableHours[task.id] ?? task.hours ?? 0)) || 0;

            // If this task has merged subtasks, include their hours too
            if (task && task.id && mergedSubtasks[task.id]) {
                const subtasks = invoiceTasks.filter(subtask => subtask && subtask.parentTaskId === task.id);
                const subtaskHours = subtasks.reduce((total, subtask) => {
                    const hours = parseFloat(String(editableHours[subtask.id] ?? subtask.hours ?? 0)) || 0;
                    return total + hours;
                }, 0);
                taskHours += subtaskHours;
            }

            if (useFlatRate[task.id]) {
                // Use flat rate for this task with quantity
                const quantity = taskQuantities[task.id] || 1;
                projectSubtotal += (taskFlatRates[task.id] || 0) * quantity;
            } else {
                // Only count hours for hourly tasks
                totalHours += taskHours;
                // Calculate parent task amount with its own rate
                const parentHours = parseFloat(String(editableHours[task.id] ?? task.hours ?? 0)) || 0;
                const parentHourlyRate = taskHourlyRates[task.id] || task.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0;
                let taskAmount = parentHours * parentHourlyRate;

                // If this task has merged subtasks, calculate each subtask's amount with its own rate
                if (task && task.id && mergedSubtasks[task.id]) {
                    const subtasks = invoiceTasks.filter(subtask => subtask && subtask.parentTaskId === task.id);
                    subtasks.forEach(subtask => {
                        const subtaskHours = parseFloat(String(editableHours[subtask.id] ?? subtask.hours ?? 0)) || 0;
                        // Use subtask's own hourly rate if set, otherwise fall back
                        const subtaskHourlyRate = taskHourlyRates[subtask.id] || subtask.hourlyRate || selectedProject?.hourlyRate || selectedClient?.hourlyRate || 0;
                        taskAmount += subtaskHours * subtaskHourlyRate;
                    });
                }

                projectSubtotal += taskAmount;
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
                const taskHours = parseFloat(String(task.hours ?? 0)) || 0;
                additionalTaskAmount += taskHours * hourlyRate;
                // Add hours to total for hourly tasks
                totalHours += taskHours;
            }
        });

        expenseItems.forEach(expense => {
            if (!expense || !expense.id) return;
            if (!selectedExpensesForBilling[expense.id]) return;
            expenseAmount += expense.amount || 0;
        });

        invoiceOnlyExpenses.forEach((expense) => {
            if (!expense) return;
            expenseAmount += expense.amount || 0;
        });

        const subtotal = projectSubtotal + additionalTaskAmount + expenseAmount;

        // Calculate discount
        const discountVal = discountValue === '' ? 0 : discountValue;
        const discount = discountType === 'percentage'
            ? (subtotal * (Number(discountVal) / 100))
            : Number(discountVal);

        // Subtotal after discount
        const afterDiscount = subtotal - discount;

        // Add shipping
        const shipping = shippingAmount === '' ? 0 : parseFloat(String(shippingAmount)) || 0;
        const afterShipping = afterDiscount + shipping;

        // Calculate tax
        let taxRate = 0;
        let taxLabel = 'VAT';

        if (taxOverride.enabled) {
            taxRate = taxOverride.rate === '' ? 0 : parseFloat(String(taxOverride.rate)) || 0;
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
        expenseItems,
        invoiceOnlyExpenses,
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
        selectedExpensesForBilling,
        mergedSubtasks,
        selectedBusinessInfo,
        selectedClient
    ]);

    return pricing;
};

export default useInvoicePricing;
