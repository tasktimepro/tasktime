import html2pdf from 'html2pdf.js';
import { getCurrencySymbol } from './currencyUtils';

/**
 * Generate and download a PDF from HTML content
 * @param {string} htmlContent - The HTML content to convert to PDF
 * @param {string} filename - The filename for the PDF download
 * @param {Object} options - PDF generation options
 */
export const generatePDF = (htmlContent, filename = 'invoice.pdf', options = {}) => {
    return new Promise((resolve, reject) => {
        try {
            if (!htmlContent) {
                reject(new Error('No HTML content provided'));
                return;
            }

            const defaultOptions = {
                margin: [5, 20, 10, 20],  // top, right, bottom, left margins in mm
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const finalOptions = { ...defaultOptions, ...options };

            console.log('Generating PDF with options:', finalOptions);
            console.log('HTML content length:', htmlContent.length);

            html2pdf()
                .set(finalOptions)
                .from(htmlContent)
                .save()
                .then(() => {
                    console.log('PDF generated successfully');
                    resolve();
                })
                .catch((error) => {
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
export const createInvoiceHTML = (invoiceData) => {
    const {
        project,
        client,
        tasks: originalTasks,
        additionalTasks: originalAdditionalTasks = [],
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
        currency = 'USD'
    } = invoiceData;
    
    // Filter out subtasks that are already merged into parent tasks
    const mergedTaskIds = new Set();
    originalTasks.forEach(task => {
        if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
            task.mergedSubtasks.forEach(subtask => mergedTaskIds.add(subtask.id));
        }
    });
    
    const tasks = originalTasks.filter(task => !mergedTaskIds.has(task.id));
    const additionalTasks = originalAdditionalTasks.filter(task => !mergedTaskIds.has(task.id));

    return `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
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
                // Determine if we have any hourly tasks
                const allTasks = [...tasks, ...additionalTasks];
                const invoiceCurrency = project?.currency || currency;
                
                // We'll show the hours and rate columns as long as any task has hours > 0
                // This includes both hourly rate tasks and flat rate tasks with tracked hours
                const hasHourlyTasks = allTasks.some(task => task.hours > 0);
                
                // If we have hourly tasks, show all 4 columns, otherwise just Description and Total
                if (hasHourlyTasks) {
                    return `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd;">Description</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">Hours</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">Rate</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map((task, index) => {
                        const isLastTask = index === tasks.length - 1 && additionalTasks.length === 0;
                        const borderStyle = isLastTask ? '' : 'border-bottom: 1px solid #eee;';
                        
                        // Check if this task uses flat rate
                        const usesFlatRate = task.useFlatRate === true || 
                                           (taskFlatRates && taskFlatRates[task.id] !== undefined) || 
                                           task.flatRate !== undefined;
                        
                        // Calculate task amount and hours (including merged subtasks)
                        let displayHours = task.hours || 0;
                        let taskTitle = task.title;
                        
                        // Handle merged subtasks display
                        if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
                            const subtaskHours = task.mergedSubtasks.reduce((total, subtask) => total + (subtask.hours || 0), 0);
                            displayHours = displayHours + subtaskHours;
                            // Don't add "including X subtasks" text to the title
                        }
                        
                        // Determine if we should show hours and rate
                        // Only use dash if it's a flat rate AND there are no tracked hours
                        const hasTrackedHours = displayHours > 0;
                        const showHoursAndRate = !usesFlatRate || hasTrackedHours;
                        
                        // Calculate based on whether it's a flat rate task or hourly
                        let taskAmount;
                        if (usesFlatRate) {
                            taskAmount = taskFlatRates && taskFlatRates[task.id] !== undefined ? 
                                taskFlatRates[task.id] : 
                                (task.flatRate || 0);
                        } else {
                            // For hourly tasks, always multiply hours by rate
                            const hourlyRate = task.hourlyRate || project?.hourlyRate || 0;
                            taskAmount = displayHours * hourlyRate;
                        }
                        
                        // Show hours if we have tracked time, even for flat rate tasks
                        const hours = showHoursAndRate ? displayHours.toFixed(2) : '—';
                        const rate = showHoursAndRate ? getCurrencySymbol(invoiceCurrency) + (task.hourlyRate || project?.hourlyRate || 0).toFixed(2) : '—';
                        
                        return `
                        <tr>
                            <td style="padding: 8px; ${borderStyle}">${taskTitle}</td>
                            <td style="padding: 8px; text-align: right; ${borderStyle}">${hours}</td>
                            <td style="padding: 8px; text-align: right; ${borderStyle}">${rate}</td>
                            <td style="padding: 8px; text-align: right; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                    }).join('')}
                    ${additionalTasks.map((task, index) => {
                        const isLastTask = index === additionalTasks.length - 1;
                        const borderStyle = isLastTask ? '' : 'border-bottom: 1px solid #eee;';
                        
                        // Check if this additional task uses flat rate
                        const usesFlatRate = task.useFlatRate === true || task.flatRate !== undefined;
                        const displayHours = task.hours || 0;
                        
                        // Determine if we should show hours and rate
                        const hasTrackedHours = displayHours > 0;
                        const showHoursAndRate = !usesFlatRate || hasTrackedHours;
                        
                        // Calculate based on whether it's a flat rate task or hourly
                        let taskAmount;
                        if (usesFlatRate) {
                            taskAmount = (task.flatRate || 0) * (task.quantity || 1);
                        } else {
                            // For hourly tasks, always multiply hours by rate
                            const hourlyRate = task.hourlyRate || project?.hourlyRate || 0;
                            taskAmount = displayHours * hourlyRate;
                        }
                        
                        // Show hours if we have tracked time, even for flat rate tasks
                        const hours = showHoursAndRate ? displayHours.toFixed(2) : '—';
                        const rate = showHoursAndRate ? getCurrencySymbol(invoiceCurrency) + (task.hourlyRate || project?.hourlyRate || 0).toFixed(2) : '—';
                        // Don't show hours in title when we have Hours column
                        const taskTitle = task.title;
                        
                        return `
                        <tr>
                            <td style="padding: 8px; ${borderStyle}">${taskTitle}</td>
                            <td style="padding: 8px; text-align: right; ${borderStyle}">${hours}</td>
                            <td style="padding: 8px; text-align: right; ${borderStyle}">${rate}</td>
                            <td style="padding: 8px; text-align: right; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>`;
                } else {
                    // Only flat rate tasks, show simplified table with just Description and Total
                    return `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd;">Description</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map((task, index) => {
                        const isLastTask = index === tasks.length - 1 && additionalTasks.length === 0;
                        const borderStyle = isLastTask ? '' : 'border-bottom: 1px solid #eee;';
                        
                        // Check if this task uses flat rate
                        const usesFlatRate = task.useFlatRate === true || 
                                           (taskFlatRates && taskFlatRates[task.id] !== undefined) || 
                                           task.flatRate !== undefined;
                                           
                        // Handle merged subtasks display
                        let displayHours = task.hours || 0;
                        let taskTitle = task.title;
                        
                        // Calculate task amount - consider hours for hourly tasks even in simplified table
                        let taskAmount;
                        
                        if (task.isMerged && task.mergedSubtasks && task.mergedSubtasks.length > 0) {
                            const subtaskHours = task.mergedSubtasks.reduce((total, subtask) => total + (subtask.hours || 0), 0);
                            displayHours = displayHours + subtaskHours;
                            // Don't add "including X subtasks" text to the title
                        }
                        
                        // Calculate the task amount based on whether it's flat rate or hourly
                        if (usesFlatRate) {
                            taskAmount = taskFlatRates && taskFlatRates[task.id] !== undefined ? 
                                taskFlatRates[task.id] : 
                                (task.flatRate || 0);
                        } else {
                            // For hourly tasks, multiply hours by rate
                            const hourlyRate = task.hourlyRate || project?.hourlyRate || 0;
                            taskAmount = displayHours * hourlyRate;
                        }
                        
                        // Always show hours when they exist, even for flat rate tasks
                        const finalTitle = displayHours > 0 ? `${taskTitle} (${displayHours.toFixed(2)}h)` : taskTitle;
                        
                        return `
                        <tr>
                            <td style="padding: 8px; ${borderStyle}">${finalTitle}</td>
                            <td style="padding: 8px; text-align: right; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                    }).join('')}
                    ${additionalTasks.map((task, index) => {
                        const isLastTask = index === additionalTasks.length - 1;
                        const borderStyle = isLastTask ? '' : 'border-bottom: 1px solid #eee;';
                        
                        const displayHours = task.hours || 0;
                        // Check if this additional task uses flat rate
                        const usesFlatRate = task.useFlatRate === true || task.flatRate !== undefined;
                        
                        // Calculate based on whether it's a flat rate task or hourly
                        let taskAmount;
                        if (usesFlatRate) {
                            taskAmount = (task.flatRate || 0) * (task.quantity || 1);
                        } else {
                            // For hourly tasks, multiply hours by rate
                            const hourlyRate = task.hourlyRate || project?.hourlyRate || 0;
                            taskAmount = displayHours * hourlyRate;
                        }
                        
                        // Always show hours when they exist, even for flat rate tasks
                        const taskTitle = displayHours > 0 ? `${task.title} (${displayHours.toFixed(2)}h)` : task.title;
                        
                        return `
                        <tr>
                            <td style="padding: 8px; ${borderStyle}">${taskTitle}</td>
                            <td style="padding: 8px; text-align: right; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
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
                        <p style="margin: 5px 0; font-size: 16px;">Subtotal: <strong>${getCurrencySymbol(project?.currency || currency)}${subtotal.toFixed(2)}</strong></p>
                        
                        ${discount && discount > 0 ? `
                            <p style="margin: 5px 0; font-size: 16px; color: #dc2626;">Discount: <strong>-${getCurrencySymbol(project?.currency || currency)}${discount.toFixed(2)}</strong></p>
                        ` : ''}
                        
                        ${shipping && shipping > 0 ? `
                            <p style="margin: 5px 0; font-size: 16px;">Shipping: <strong>${getCurrencySymbol(project?.currency || currency)}${shipping.toFixed(2)}</strong></p>
                        ` : ''}
                        
                        ${tax && tax > 0 ? `
                            <p style="margin: 5px 0; font-size: 16px;">${taxLabel || 'Tax'} (${(taxRate || 0).toFixed(1)}%): <strong>${getCurrencySymbol(project?.currency || currency)}${tax.toFixed(2)}</strong></p>
                        ` : ''}
                        
                        <p style="margin: 10px 0 0 0; font-size: 24px; color: #333; border-top: 1px solid #ddd; padding-top: 10px;"><strong>Total: ${getCurrencySymbol(project?.currency || currency)}${totalAmount.toFixed(2)}</strong></p>
                    ` : `
                        <p style="margin: 10px 0 0 0; font-size: 24px; color: #333;"><strong>Total${totalHours && totalHours > 0 ? ` (${totalHours.toFixed(2)} hours)` : ''}: ${getCurrencySymbol(project?.currency || currency)}${totalAmount.toFixed(2)}</strong></p>
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
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
                    
                    ${paymentMethod.fullName ? `<p style="margin: 5px 0;"><strong>Account Holder:</strong> ${paymentMethod.fullName}</p>` : ''}
                    ${paymentMethod.bank ? `<p style="margin: 5px 0;"><strong>Bank:</strong> ${paymentMethod.bank}</p>` : ''}
                    ${paymentMethod.iban ? `<p style="margin: 5px 0;"><strong>IBAN:</strong> ${paymentMethod.iban}</p>` : ''}
                    ${paymentMethod.swift ? `<p style="margin: 5px 0;"><strong>SWIFT/BIC:</strong> ${paymentMethod.swift}</p>` : ''}
                    ${paymentMethod.bankAddress ? `<p style="margin: 5px 0;"><strong>Bank Address:</strong> ${paymentMethod.bankAddress}</p>` : ''}
                    ${paymentMethod.paypal ? `<p style="margin: 5px 0;"><strong>PayPal:</strong> ${paymentMethod.paypal}</p>` : ''}
                    
                    ${paymentMethod.custom && paymentMethod.custom.length > 0 ? 
                        paymentMethod.custom.map(field => 
                            `<p style="margin: 5px 0;"><strong>${field.label}:</strong> ${field.value}</p>`
                        ).join('') : ''
                    }
                </div>
            </div>
            ` : ''}
        </div>
    `;
};
