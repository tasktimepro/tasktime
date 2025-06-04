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
                margin: [15, 20, 15, 20],  // top, right, bottom, left margins in mm
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
        tasks,
        totalHours,
        totalAmount,
        invoiceNumber,
        date,
        paymentMethod,
        businessInfo
    } = invoiceData;

    return `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #333; margin-bottom: 10px; font-size: 28px; font-weight: bold;">INVOICE</h1>
                <p style="color: #666; margin: 0;">Invoice: #${invoiceNumber}</p>
                <p style="color: #666; margin: 0;">Project: ${project.title}</p>
                <p style="color: #666; margin: 0;">Date: ${date}</p>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div>
                    <h3 style="color: #333; margin-bottom: 10px;"><strong>Invoice To:</strong></h3>
                    <p style="margin: 0; line-height: 1.5;">
                        ${client.name}<br>
                        ${client.email ? client.email + '<br>' : ''}
                        ${client.address ? client.address + '<br>' : ''}
                        ${client.city ? client.city + ', ' : ''}${client.state ? client.state + ' ' : ''}${client.zip || ''}
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
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Task</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Hours</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map(task => `
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${task.title}</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${task.hours.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${getCurrencySymbol(project.currency)}${(task.hours * project.hourlyRate).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="text-align: right; margin-bottom: 30px;">
                <p style="margin: 0; font-size: 18px;"><strong>Total Hours: ${totalHours.toFixed(2)}</strong></p>
                <p style="margin: 0; font-size: 24px; color: #333;"><strong>Total Amount: ${getCurrencySymbol(project.currency)}${totalAmount.toFixed(2)}</strong></p>
            </div>
            
            ${paymentMethod ? `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
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
