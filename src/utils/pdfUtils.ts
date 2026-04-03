import html2pdf from 'html2pdf.js';
import { getCurrencySymbol, getPreferredCurrency } from './currencyUtils';

type InvoiceTask = {
    id: string;
    title: string;
    hours?: number | string;
    hourlyRate?: number | string;
    flatRate?: number | string;
    quantity?: number | string;
    useFlatRate?: boolean;
    isMerged?: boolean;
    mergedSubtasks?: InvoiceTask[];
};

type InvoiceExpenseItem = {
    id: string;
    title: string;
    amount: number;
    date?: string;
    supplierName?: string | null;
};

type ProjectInfo = {
    title?: string;
    hourlyRate?: number | string;
};

type ClientInfo = {
    name?: string;
    contactPerson?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
};

type BusinessInfo = {
    businessName?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    email?: string;
    phone?: string;
    registrationNumber?: string;
    vat?: string;
    taxNumber?: string;
    custom?: Array<{ label: string; value: string }>;
};

type PaymentMethodInfo = {
    fullName?: string;
    bank?: string;
    iban?: string;
    swift?: string;
    bankAddress?: string;
    paypal?: string;
    custom?: Array<{ label: string; value: string }>;
};

type InvoiceData = {
    project?: ProjectInfo;
    client: ClientInfo;
    tasks: InvoiceTask[];
    additionalTasks?: InvoiceTask[];
    expenseItems?: InvoiceExpenseItem[];
    note?: string;
    totalHours?: number | string;
    totalAmount: number;
    invoiceNumber?: string;
    date?: string;
    dueDate?: string;
    paymentMethod?: PaymentMethodInfo;
    businessInfo?: BusinessInfo;
    subtotal?: number;
    discount?: number;
    shipping?: number;
    tax?: number;
    taxRate?: number;
    taxLabel?: string;
    taskFlatRates?: Record<string, number | string>;
    taskHourlyRates?: Record<string, number | string>;
    currency?: string;
};

/**
 * Generate and download a PDF from HTML content
 * @param {string} htmlContent - The HTML content to convert to PDF
 * @param {string} filename - The filename for the PDF download
 * @param {Object} options - PDF generation options
 */
export const generatePDF = (
    htmlContent: string,
    filename = 'invoice.pdf',
    options: Record<string, unknown> = {}
): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            if (!htmlContent) {
                reject(new Error('No HTML content provided'));
                return;
            }

            const defaultOptions = {
                margin: [10, 20, 10, 20],  // top, right, bottom, left margins in mm
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: [229, 297], orientation: 'portrait' }
            };

            const finalOptions = { ...defaultOptions, ...options };

            html2pdf()
                .set(finalOptions)
                .from(htmlContent)
                .save()
                .then(() => {
                    resolve();
                })
                .catch((error: unknown) => {
                    console.error('PDF generation failed:', error);
                    reject(error);
                });
        } catch (error) {
            console.error('PDF generation error:', error);
            reject(error);
        }
    });
};

/**
 * Create invoice HTML template
 * @param {Object} invoiceData - Invoice data object
 * @returns {string} HTML string for the invoice
 */
export const createInvoiceHTML = (invoiceData: InvoiceData): string => {
    const {
        project,
        client,
        tasks: originalTasks,
        additionalTasks: originalAdditionalTasks = [],
        expenseItems = [],
        note = '',
        totalHours,
        totalAmount,
        invoiceNumber,
        date,
        dueDate,
        paymentMethod,
        businessInfo,
        subtotal,
        discount,
        shipping,
        tax,
        taxRate,
        taxLabel,
        taskFlatRates = {},
        taskHourlyRates = {},
        currency = getPreferredCurrency()
    } = invoiceData;

    // Filter out subtasks that are already merged into parent tasks
    const mergedTaskIds = new Set<string>();
    originalTasks.forEach(task => {
        if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
            task.mergedSubtasks.forEach(subtask => mergedTaskIds.add(subtask.id));
        }
    });

    const tasks = originalTasks.filter(task => !mergedTaskIds.has(task.id));
    const expenseAdditionalTasks: InvoiceTask[] = expenseItems.map((expense) => ({
        id: `expense-${expense.id}`,
        title: `${expense.title}${expense.supplierName ? ` • ${expense.supplierName}` : ''}`,
        flatRate: expense.amount,
        quantity: 1,
        useFlatRate: true
    }));

    const additionalTasks: InvoiceTask[] = [...originalAdditionalTasks, ...expenseAdditionalTasks].filter(task => !mergedTaskIds.has(task.id));
    const allTasks = [...tasks, ...additionalTasks];
    const usesFlatRateForTask = (task: InvoiceTask) => {
        const hasExplicitFlatRate = task.flatRate !== undefined;
        return task.useFlatRate === true || (task.useFlatRate !== false && hasExplicitFlatRate);
    };
    const hasFlatTasks = allTasks.some((task) => usesFlatRateForTask(task));
    const hasHourlyTasks = allTasks.some((task) => !usesFlatRateForTask(task));
    const hasTotalHoursValue = totalHours !== undefined && totalHours !== null;
    const parsedTotalHours = parseFloat(String(totalHours ?? 0)) || 0;

    return `
        <div style="font-family: Arial, sans-serif; width: 100%; max-width: none; margin: 0; padding: 0; box-sizing: border-box;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #333; margin-bottom: 10px; font-size: 28px; font-weight: bold;">INVOICE</h1>
                <p style="color: #666; margin: 0;">Invoice: #${invoiceNumber}</p>
                <p style="color: #666; margin: 0;">Date: ${date}${dueDate ? ` &nbsp;•&nbsp; Due Date: ${dueDate}` : ''}</p>
                ${project ? `<p style="color: #666; margin: 0;">Project: ${project.title}</p>` : ''}
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div>
                    <h3 style="color: #333; margin-bottom: 10px;"><strong>Invoice To:</strong></h3>
                    <p style="margin: 0; line-height: 1.5;">
                        ${client.name}<br>
                        ${client.contactPerson ? client.contactPerson + '<br>' : ''}
                        ${client.email ? client.email + '<br>' : ''}
                        ${client.address ? client.address + '<br>' : ''}
                        ${client.city ? client.city + ', ' : ''}${client.state ? client.state + ' ' : ''}${client.zip || ''}${(client.city || client.state || client.zip) && client.country ? '<br>' : ''}
                        ${client.country ? client.country : ''}
                    </p>
                </div>
                <div style="text-align: right;">
                    ${businessInfo ? `
                        <h3 style="color: #333; margin-bottom: 10px;"><strong>Invoice From:</strong></h3>
                        <p style="margin: 0; line-height: 1.5;">
                            ${businessInfo.businessName ? businessInfo.businessName + '<br>' : ''}
                            ${businessInfo.address ? businessInfo.address + '<br>' : ''}
                            ${(businessInfo.city || businessInfo.state || businessInfo.zip) ? 
                                `${businessInfo.city ? businessInfo.city + ', ' : ''}${businessInfo.state ? businessInfo.state + ' ' : ''}${businessInfo.zip || ''}<br>` : ''
                            }
                            ${businessInfo.country ? businessInfo.country + '<br>' : ''}
                            ${businessInfo.email ? businessInfo.email + '<br>' : ''}
                            ${businessInfo.phone ? businessInfo.phone + '<br>' : ''}
                            ${businessInfo.registrationNumber ? 'Reg: ' + businessInfo.registrationNumber + '<br>' : ''}
                            ${businessInfo.vat ? 'VAT: ' + businessInfo.vat + '<br>' : ''}
                            ${businessInfo.taxNumber ? 'Tax: ' + businessInfo.taxNumber + '<br>' : ''}
                            ${businessInfo.custom && businessInfo.custom.length > 0 ? 
                                businessInfo.custom.map(field => field.label + ': ' + field.value).join('<br>') + '<br>' : ''
                            }
                        </p>
                    ` : ''}
                </div>
            </div>
            
            ${(() => {
                const invoiceCurrency = currency;

                // Column layout rules:
                // - Hourly only: Description, Hours, Rate, Total
                // - Flat only: Description, Qty, Total
                // - Mixed: Description, Hours, Rate, Qty, Total
                if (hasHourlyTasks || hasFlatTasks) {
                    const showHoursAndRate = hasHourlyTasks;
                    const showQuantity = hasFlatTasks;
                    return `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; vertical-align: middle; border-bottom: 1px solid #ddd;">Description</th>
                        ${showHoursAndRate ? '<th style="padding: 12px; text-align: right; vertical-align: middle; border-bottom: 1px solid #ddd;">Hours</th>' : ''}
                        ${showHoursAndRate ? '<th style="padding: 12px; text-align: right; vertical-align: middle; border-bottom: 1px solid #ddd;">Rate</th>' : ''}
                        ${showQuantity ? '<th style="padding: 12px; text-align: right; vertical-align: middle; border-bottom: 1px solid #ddd;">Qty</th>' : ''}
                        <th style="padding: 12px; text-align: right; vertical-align: middle; border-bottom: 1px solid #ddd;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map((task, index) => {
                        const isLastTask = index === tasks.length - 1 && additionalTasks.length === 0;
                        const borderStyle = isLastTask ? '' : 'border-bottom: 1px solid #eee;';
                        
                        // Check if this task uses flat rate
                        const hasExplicitFlatRate = task.flatRate !== undefined;
                        const usesFlatRate = task.useFlatRate === true || (task.useFlatRate !== false && hasExplicitFlatRate);
                        
                        // Calculate task amount and hours (including merged subtasks)
                        let displayHours = parseFloat(String(task.hours)) || 0;
                        const taskTitle = task.title;
                        
                        // Handle merged subtasks display
                        if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
                            const subtaskHours = task.mergedSubtasks.reduce((total, subtask) => total + (parseFloat(String(subtask.hours)) || 0), 0);
                            displayHours = displayHours + subtaskHours;
                            // Don't add "including X subtasks" text to the title
                        }
                        
                        // Calculate based on whether it's a flat rate task or hourly
                        let taskAmount;
                        if (usesFlatRate) {
                            const quantity = parseFloat(String(task.quantity)) || 1;
                            const flatRateValue = taskFlatRates && taskFlatRates[task.id] !== undefined ? 
                                parseFloat(String(taskFlatRates[task.id])) || 0 : 
                                (parseFloat(String(task.flatRate)) || 0);
                            taskAmount = flatRateValue * quantity;
                        } else {
                            // For hourly tasks, calculate parent's amount
                            const parentHours = parseFloat(String(task.hours)) || 0;
                            const parentHourlyRate = parseFloat(String(task.hourlyRate)) || parseFloat(String(taskHourlyRates[task.id])) || parseFloat(String(project?.hourlyRate)) || 0;
                            taskAmount = parentHours * parentHourlyRate;
                            
                            // For merged subtasks, calculate each subtask's amount with its own rate
                            if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
                                task.mergedSubtasks.forEach(subtask => {
                                    const subtaskHours = parseFloat(String(subtask.hours)) || 0;
                                    const subtaskHourlyRate = parseFloat(String(subtask.hourlyRate)) || parseFloat(String(taskHourlyRates[subtask.id])) || parseFloat(String(project?.hourlyRate)) || 0;
                                    taskAmount += subtaskHours * subtaskHourlyRate;
                                });
                            }
                        }
                        
                        const hours = showHoursAndRate ? (usesFlatRate ? '—' : displayHours.toFixed(2)) : '—';
                        const quantity = showQuantity ? (usesFlatRate ? (parseFloat(String(task.quantity)) || 1).toFixed(0) : '—') : '—';
                        // For merged tasks with different rates, show "Mixed" instead of a single rate
                        let rateDisplay;
                        if (!showHoursAndRate || usesFlatRate) {
                            rateDisplay = '—';
                        } else if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
                            // Check if all rates are the same
                            const parentRate = parseFloat(String(task.hourlyRate)) || parseFloat(String(taskHourlyRates[task.id])) || parseFloat(String(project?.hourlyRate)) || 0;
                            const allRatesSame = task.mergedSubtasks.every(subtask => {
                                const subtaskRate = parseFloat(String(subtask.hourlyRate)) || parseFloat(String(taskHourlyRates[subtask.id])) || parseFloat(String(project?.hourlyRate)) || 0;
                                return subtaskRate === parentRate;
                            });
                            rateDisplay = allRatesSame 
                                ? getCurrencySymbol(invoiceCurrency) + parentRate.toFixed(2)
                                : 'Mixed';
                        } else {
                            rateDisplay = getCurrencySymbol(invoiceCurrency) + (parseFloat(String(task.hourlyRate)) || parseFloat(String(taskHourlyRates[task.id])) || parseFloat(String(project?.hourlyRate)) || 0).toFixed(2);
                        }
                        
                        return `
                        <tr>
                            <td style="padding: 8px; vertical-align: middle; ${borderStyle}">${taskTitle}</td>
                            ${showHoursAndRate ? `<td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${hours}</td>` : ''}
                            ${showHoursAndRate ? `<td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${rateDisplay}</td>` : ''}
                            ${showQuantity ? `<td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${quantity}</td>` : ''}
                            <td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                    }).join('')}
                    ${additionalTasks.map((task, index) => {
                        const isLastTask = index === additionalTasks.length - 1;
                        const borderStyle = isLastTask ? '' : 'border-bottom: 1px solid #eee;';
                        
                        // Check if this additional task uses flat rate
                        const usesFlatRate = task.useFlatRate === true || (task.useFlatRate !== false && task.flatRate !== undefined);
                        const displayHours = parseFloat(String(task.hours)) || 0;
                        
                        // Calculate based on whether it's a flat rate task or hourly
                        let taskAmount;
                        if (usesFlatRate) {
                            taskAmount = (parseFloat(String(task.flatRate)) || 0) * (parseFloat(String(task.quantity)) || 1);
                        } else {
                            // For hourly tasks, always multiply hours by rate
                            const hourlyRate = parseFloat(String(task.hourlyRate)) || parseFloat(String(project?.hourlyRate)) || 0;
                            taskAmount = displayHours * hourlyRate;
                        }
                        
                        // Show hours if we have tracked time, even for flat rate tasks
                        const hours = showHoursAndRate ? (usesFlatRate ? '—' : displayHours.toFixed(2)) : '—';
                        const rate = showHoursAndRate && !usesFlatRate ? getCurrencySymbol(invoiceCurrency) + (parseFloat(String(task.hourlyRate)) || parseFloat(String(project?.hourlyRate)) || 0).toFixed(2) : '—';
                        const quantity = showQuantity ? (usesFlatRate ? (parseFloat(String(task.quantity)) || 1).toFixed(0) : '—') : '—';
                        // Don't show hours in title when we have Hours column
                        const taskTitle = task.title;
                        
                        return `
                        <tr>
                            <td style="padding: 8px; vertical-align: middle; ${borderStyle}">${taskTitle}</td>
                            ${showHoursAndRate ? `<td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${hours}</td>` : ''}
                            ${showHoursAndRate ? `<td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${rate}</td>` : ''}
                            ${showQuantity ? `<td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${quantity}</td>` : ''}
                            <td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>`;
                } else {
                    // No tasks
                    return `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; vertical-align: middle; border-bottom: 1px solid #ddd;">Description</th>
                        <th style="padding: 12px; text-align: right; vertical-align: middle; border-bottom: 1px solid #ddd;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map((task, index) => {
                        const isLastTask = index === tasks.length - 1 && additionalTasks.length === 0;
                        const borderStyle = isLastTask ? '' : 'border-bottom: 1px solid #eee;';
                        
                        // Check if this task uses flat rate
                        const hasExplicitFlatRate = task.flatRate !== undefined;
                        const usesFlatRate = task.useFlatRate === true || (task.useFlatRate !== false && hasExplicitFlatRate);
                                           
                        // Handle merged subtasks display
                        let displayHours = parseFloat(String(task.hours)) || 0;
                        const taskTitle = task.title;
                        
                        // Calculate task amount - consider hours for hourly tasks even in simplified table
                        let taskAmount;
                        
                        if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
                            const subtaskHours = task.mergedSubtasks.reduce((total, subtask) => total + (parseFloat(String(subtask.hours)) || 0), 0);
                            displayHours = displayHours + subtaskHours;
                            // Don't add "including X subtasks" text to the title
                        }
                        
                        // Calculate the task amount based on whether it's flat rate or hourly
                        if (usesFlatRate) {
                            const quantity = parseFloat(String(task.quantity)) || 1;
                            const flatRateValue = taskFlatRates && taskFlatRates[task.id] !== undefined ? 
                                parseFloat(String(taskFlatRates[task.id])) || 0 : 
                                (parseFloat(String(task.flatRate)) || 0);
                            taskAmount = flatRateValue * quantity;
                        } else {
                            // For hourly tasks, calculate parent's amount
                            const parentHours = parseFloat(String(task.hours)) || 0;
                            const parentHourlyRate = parseFloat(String(task.hourlyRate)) || parseFloat(String(taskHourlyRates[task.id])) || parseFloat(String(project?.hourlyRate)) || 0;
                            taskAmount = parentHours * parentHourlyRate;
                            
                            // For merged subtasks, calculate each subtask's amount with its own rate
                            if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
                                task.mergedSubtasks.forEach(subtask => {
                                    const subtaskHours = parseFloat(String(subtask.hours)) || 0;
                                    const subtaskHourlyRate = parseFloat(String(subtask.hourlyRate)) || parseFloat(String(taskHourlyRates[subtask.id])) || parseFloat(String(project?.hourlyRate)) || 0;
                                    taskAmount += subtaskHours * subtaskHourlyRate;
                                });
                            }
                        }
                        
                        // Always show hours when they exist, even for flat rate tasks
                        const finalTitle = displayHours > 0 ? `${taskTitle} (${displayHours.toFixed(2)}h)` : taskTitle;
                        
                        return `
                        <tr>
                            <td style="padding: 8px; vertical-align: middle; ${borderStyle}">${finalTitle}</td>
                            <td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                    }).join('')}
                    ${additionalTasks.map((task, index) => {
                        const isLastTask = index === additionalTasks.length - 1;
                        const borderStyle = isLastTask ? '' : 'border-bottom: 1px solid #eee;';
                        
                        const displayHours = parseFloat(String(task.hours)) || 0;
                        // Check if this additional task uses flat rate
                        const usesFlatRate = task.useFlatRate === true || task.flatRate !== undefined;
                        
                        // Calculate based on whether it's a flat rate task or hourly
                        let taskAmount;
                        if (usesFlatRate) {
                            taskAmount = (parseFloat(String(task.flatRate)) || 0) * (parseFloat(String(task.quantity)) || 1);
                        } else {
                            // For hourly tasks, multiply hours by rate
                            const hourlyRate = parseFloat(String(task.hourlyRate)) || parseFloat(String(project?.hourlyRate)) || 0;
                            taskAmount = displayHours * hourlyRate;
                        }
                        
                        // Always show hours when they exist, even for flat rate tasks
                        const taskTitle = displayHours > 0 ? `${task.title} (${displayHours.toFixed(2)}h)` : task.title;
                        
                        return `
                        <tr>
                            <td style="padding: 8px; vertical-align: middle; ${borderStyle}">${taskTitle}</td>
                            <td style="padding: 8px; text-align: right; vertical-align: middle; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>`;
                }
            })()}
            
            <div style="text-align: right; margin-bottom: 10px;">
                <div style="border-top: 1px solid #ddd; padding-top: 8px;">
                    ${subtotal ? `
                        ${hasHourlyTasks && hasTotalHoursValue ? `
                            <div style="display: flex; justify-content: flex-end; align-items: baseline; gap: 24px; margin: 5px 0; font-size: 16px;">
                                <span>Total hours: <strong>${parsedTotalHours.toFixed(2)}</strong></span>
                                <span>Subtotal: <strong>${getCurrencySymbol(currency)}${subtotal.toFixed(2)}</strong></span>
                            </div>
                        ` : `
                            <p style="margin: 5px 0; font-size: 16px;">Subtotal: <strong>${getCurrencySymbol(currency)}${subtotal.toFixed(2)}</strong></p>
                        `}
                        
                        ${discount && discount > 0 ? `
                            <p style="margin: 5px 0; font-size: 16px; color: #dc2626;">Discount: <strong>-${getCurrencySymbol(currency)}${discount.toFixed(2)}</strong></p>
                        ` : ''}
                        
                        ${shipping && shipping > 0 ? `
                            <p style="margin: 5px 0; font-size: 16px;">Shipping: <strong>${getCurrencySymbol(currency)}${shipping.toFixed(2)}</strong></p>
                        ` : ''}
                        
                        ${tax && tax > 0 ? `
                            <p style="margin: 5px 0; font-size: 16px;">${taxLabel || 'Tax'} (${(taxRate || 0).toFixed(1)}%): <strong>${getCurrencySymbol(currency)}${tax.toFixed(2)}</strong></p>
                        ` : ''}
                        
                        <p style="margin: 10px 0 0 0; font-size: 24px; color: #333; border-top: 1px solid #ddd; padding-top: 10px;"><strong>Total: ${getCurrencySymbol(currency)}${totalAmount.toFixed(2)}</strong></p>
                    ` : `
                        <p style="margin: 10px 0 0 0; font-size: 24px; color: #333;"><strong>Total${totalHours && parseFloat(String(totalHours)) > 0 ? ` (${parseFloat(String(totalHours)).toFixed(2)} hours)` : ''}: ${getCurrencySymbol(currency)}${totalAmount.toFixed(2)}</strong></p>
                    `}
                </div>
            </div>
            
            ${note ? `
            <div style="width: 60%; margin-top: 10px; text-align: left;">
                <p style="font-style: italic; color: #666; font-size: 14px; margin: 5px 0;">${note}</p>
            </div>
            ` : ''}
            
            ${paymentMethod ? `
            <div style="margin-top: 10px; padding-top: 30px; border-top: 1px solid #ddd;">
                <h3 style="color: #333; margin-bottom: 15px;"><strong>Payment Details:</strong></h3>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; padding-top: 15px; padding-bottom: 15px;">
                    
                    ${paymentMethod.fullName ? `<p style="margin: 0; line-height: 1.4;"><strong>Account Holder:</strong> ${paymentMethod.fullName}</p>` : ''}
                    ${paymentMethod.bank ? `<p style="margin: 0; line-height: 1.4;"><strong>Bank:</strong> ${paymentMethod.bank}</p>` : ''}
                    ${paymentMethod.iban ? `<p style="margin: 0; line-height: 1.4;"><strong>IBAN:</strong> ${paymentMethod.iban}</p>` : ''}
                    ${paymentMethod.swift ? `<p style="margin: 0; line-height: 1.4;"><strong>SWIFT/BIC:</strong> ${paymentMethod.swift}</p>` : ''}
                    ${paymentMethod.bankAddress ? `<p style="margin: 0; line-height: 1.4;"><strong>Bank Address:</strong> ${paymentMethod.bankAddress}</p>` : ''}
                    ${paymentMethod.paypal ? `<p style="margin: 0; line-height: 1.4;"><strong>PayPal:</strong> ${paymentMethod.paypal}</p>` : ''}
                    
                    ${paymentMethod.custom && paymentMethod.custom.length > 0 ? 
                        paymentMethod.custom.map(field => 
                            `<p style="margin: 0; line-height: 1.4;"><strong>${field.label}:</strong> ${field.value}</p>`
                        ).join('') : ''
                    }
                </div>
            </div>
            ` : ''}
        </div>
    `;
};
