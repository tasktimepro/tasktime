import html2pdf from 'html2pdf.js';

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
                margin: 1,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
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
        date
    } = invoiceData;

    return `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #333; margin-bottom: 10px;">INVOICE</h1>
                <p style="color: #666; margin: 0;">Invoice #${invoiceNumber}</p>
                <p style="color: #666; margin: 0;">Date: ${date}</p>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div>
                    <h3 style="color: #333; margin-bottom: 10px;">Bill To:</h3>
                    <p style="margin: 0; line-height: 1.5;">
                        ${client.name}<br>
                        ${client.email ? client.email + '<br>' : ''}
                        ${client.address ? client.address + '<br>' : ''}
                        ${client.city ? client.city + ', ' : ''}${client.state ? client.state + ' ' : ''}${client.zip || ''}
                    </p>
                </div>
                <div style="text-align: right;">
                    <h3 style="color: #333; margin-bottom: 10px;">Project:</h3>
                    <p style="margin: 0; font-weight: bold;">${project.title}</p>
                    <p style="margin: 0; color: #666;">Rate: $${project.hourlyRate}/${project.currency || 'USD'} per hour</p>
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Task</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Hours</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Rate</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map(task => `
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #eee;">${task.title}</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${task.hours.toFixed(2)}</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${project.hourlyRate}</td>
                            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${(task.hours * project.hourlyRate).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="text-align: right; margin-bottom: 30px;">
                <p style="margin: 0; font-size: 18px;"><strong>Total Hours: ${totalHours.toFixed(2)}</strong></p>
                <p style="margin: 0; font-size: 24px; color: #333;"><strong>Total Amount: $${totalAmount.toFixed(2)}</strong></p>
            </div>
            
            <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
                <p style="margin: 0;">Thank you for your business!</p>
            </div>
        </div>
    `;
};
