import { useMemo } from 'react';
import { getFiniteInvoiceNumber } from '@/domain/invoices/invoiceNumbers';
import { getClientHourlyRate } from '@/utils/projectPlanningUtils';

type TaskItem = {
    id: string;
    parentTaskId?: string | null;
    hours?: number | string;
    hourlyRate?: number | string;
    flatRate?: number | string;
    quantity?: number | string;
    useFlatRate?: boolean;
};

type AdditionalTask = {
    hours?: number | string;
    hourlyRate?: number | string;
    flatRate?: number | string;
    quantity?: number | string;
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
    defaultHourlyRate?: number;
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
    editableHours: Record<string, number | string>;
    discountType: 'percentage' | 'fixed';
    discountValue: number | string;
    shippingAmount: number | string;
    taxOverride: TaxOverride;
    taskFlatRates: Record<string, number | string>;
    useFlatRate: Record<string, boolean>;
    taskHourlyRates: Record<string, number | string>;
    taskQuantities: Record<string, number | string>;
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
    const selectedClientHourlyRate = getClientHourlyRate(selectedClient);

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

        const getNumber = (value: unknown, fallback = 0) => {
            return getFiniteInvoiceNumber(value) ?? fallback;
        };

        const getTaskHourlyRate = (task: TaskItem) => {
            if (Object.prototype.hasOwnProperty.call(taskHourlyRates, task.id)) {
                const customRate = getFiniteInvoiceNumber(taskHourlyRates[task.id]);

                if (customRate !== null) {
                    return customRate;
                }

                if (taskHourlyRates[task.id] !== '') {
                    return 0;
                }
            }

            return getNumber(task.hourlyRate)
                || getNumber(selectedProject?.hourlyRate)
                || getNumber(selectedClientHourlyRate);
        };

        // Calculate regular project tasks subtotal (only include selected tasks)
        invoiceTasks.forEach(task => {
            // Skip if task is null or id is missing
            if (!task || !task.id) return;

            // Only include selected tasks in pricing calculation
            if (!selectedTasksForBilling[task.id]) return;

            // Skip subtasks if their parent is merged (they're included in parent calculation)
            if (task.parentTaskId && mergedSubtasks[task?.parentTaskId]) return;

            let taskHours = getNumber(editableHours[task.id] ?? task.hours);

            // If this task has merged subtasks, include their hours too
            if (task && task.id && mergedSubtasks[task.id]) {
                const subtasks = invoiceTasks.filter(subtask => subtask && subtask.parentTaskId === task.id);
                const subtaskHours = subtasks.reduce((total, subtask) => {
                    const hours = getNumber(editableHours[subtask.id] ?? subtask.hours);
                    return total + hours;
                }, 0);
                taskHours += subtaskHours;
            }

            const usesTaskFlatRate = Object.prototype.hasOwnProperty.call(useFlatRate, task.id)
                ? useFlatRate[task.id]
                : task.useFlatRate === true;

            if (usesTaskFlatRate) {
                // Use flat rate for this task with quantity
                const quantity = getFiniteInvoiceNumber(taskQuantities[task.id])
                    ?? getFiniteInvoiceNumber(task.quantity)
                    ?? 1;
                const flatRateValue = getNumber(taskFlatRates[task.id] ?? task.flatRate);
                projectSubtotal += flatRateValue * quantity;
            } else {
                // Only count hours for hourly tasks
                totalHours += taskHours;
                // Calculate parent task amount with its own rate
                const parentHours = getNumber(editableHours[task.id] ?? task.hours);
                const parentHourlyRate = getTaskHourlyRate(task);
                let taskAmount = parentHours * parentHourlyRate;

                // If this task has merged subtasks, calculate each subtask's amount with its own rate
                if (task && task.id && mergedSubtasks[task.id]) {
                    const subtasks = invoiceTasks.filter(subtask => subtask && subtask.parentTaskId === task.id);
                    subtasks.forEach(subtask => {
                        const subtaskHours = getNumber(editableHours[subtask.id] ?? subtask.hours);
                        // Use subtask's own hourly rate if set, otherwise fall back
                        const subtaskHourlyRate = getTaskHourlyRate(subtask);
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
                const quantity = getFiniteInvoiceNumber(task.quantity) ?? 1;
                additionalTaskAmount += getNumber(task.flatRate) * quantity;
            } else {
                const hourlyRate = getFiniteInvoiceNumber(task.hourlyRate)
                    ?? (getNumber(selectedProject?.hourlyRate) || getNumber(selectedClientHourlyRate));
                const taskHours = getNumber(task.hours);
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
        selectedClient,
        selectedClientHourlyRate
    ]);

    return pricing;
};

export default useInvoicePricing;
