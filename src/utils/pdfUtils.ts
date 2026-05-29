import html2pdf from 'html2pdf.js';
import DOMPurify from 'dompurify';
import { getCurrencySymbol, getPreferredCurrency } from './currencyUtils';
import { formatBillingPeriodLabel } from './billingPeriodUtils';
import type {
    InvoiceBrandingSnapshot,
    InvoiceTemplateBrandingOptions,
    InvoiceTemplateLayoutStyle,
    InvoiceTemplateLogoPlacement,
} from '@/stores/yjs/types';
import {
    DEFAULT_INVOICE_LAYOUT_STYLE,
    DEFAULT_INVOICE_LOGO_PLACEMENT,
    normalizeInvoiceLayoutStyle,
    normalizeInvoiceLogoPlacement,
} from '@/utils/invoiceBranding';

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
    branding?: {
        primaryColor?: string | null;
        logoAssetId?: string | null;
    };
};

type InvoiceTemplateInfo = {
    id?: string | null;
    brandingOptions?: InvoiceTemplateBrandingOptions;
    layoutStyle?: InvoiceTemplateLayoutStyle;
    logoPlacement?: InvoiceTemplateLogoPlacement;
    showBillingPeriod?: boolean;
    showProjectTitle?: boolean;
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
    documentMode?: 'invoice' | 'quote';
    project?: ProjectInfo;
    client: ClientInfo;
    tasks: InvoiceTask[];
    additionalTasks?: InvoiceTask[];
    expenseItems?: InvoiceExpenseItem[];
    note?: string;
    totalHours?: number | string;
    total?: number;
    totalAmount?: number;
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
    billingPeriodPreset?: string | null;
    billingPeriodStart?: string | null;
    billingPeriodEnd?: string | null;
    currency?: string;
    template?: InvoiceTemplateInfo | null;
    templateId?: string | null;
    brandingSnapshot?: InvoiceBrandingSnapshot | null;
    brandingLogoDataUrl?: string | null;
};

type StoredInvoice = InvoiceData & {
    clientId?: string | null;
    invoiceNumber?: string;
    htmlContent?: string | null;
};

type StoredBusinessBrandAsset = {
    id: string;
    dataUrl: string;
    archivedAt?: number | null;
};

type StoredClient = {
    id: string;
    clientName?: string;
    contactPerson?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
};

type PdfMargin = number | [number, number] | [number, number, number, number];

type PdfOptions = {
    margin?: PdfMargin;
    filename?: string;
    image?: {
        type: 'jpeg' | 'png' | 'webp';
        quality: number;
    };
    html2canvas?: {
        scale: number;
        onclone?: (doc: Document) => void;
    };
    pagebreak?: {
        mode?: Array<'avoid-all' | 'css' | 'legacy'>;
        avoid?: string[];
    };
    jsPDF?: {
        unit: string;
        format: [number, number];
        orientation: 'portrait' | 'landscape';
    };
};

/** Force the cloned html2canvas document into light mode so PDFs are never
 *  rendered with the app's dark-mode colours. */
const forceLightModeOnClone = (doc: Document): void => {
    doc.documentElement.style.colorScheme = 'light';
    doc.documentElement.style.backgroundColor = '#ffffff';
    doc.documentElement.style.color = '#111827';
    doc.body.style.backgroundColor = '#ffffff';
    doc.body.style.color = '#111827';
};

/**
 * Build sanitized PDF generator options once so all PDF flows stay aligned.
 */
const buildPdfContext = (
    htmlContent: string,
    filename?: string,
    options: PdfOptions = {}
) => {
    if (!htmlContent) {
        throw new Error('No HTML content provided');
    }

    const defaultOptions: PdfOptions = {
        margin: [10, 20, 10, 20],  // top, right, bottom, left margins in mm
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, onclone: forceLightModeOnClone },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.invoice-totals', '.invoice-note', '.invoice-payment-section', '.invoice-task-table tr'] },
        jsPDF: { unit: 'mm', format: [229, 297], orientation: 'portrait' }
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        html2canvas: { ...defaultOptions.html2canvas, ...(options.html2canvas || {}) },
        pagebreak: { ...defaultOptions.pagebreak, ...(options.pagebreak || {}) },
    };

    const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['style'],
    });

    return {
        finalOptions,
        sanitizedHtml,
    };
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
    options: PdfOptions = {}
): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            const { finalOptions, sanitizedHtml } = buildPdfContext(htmlContent, filename, options);

            html2pdf()
                .set(finalOptions)
                .from(sanitizedHtml)
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
 * Generate a PDF blob from HTML content without downloading it.
 */
export const generatePDFBlob = (
    htmlContent: string,
    options: PdfOptions = {}
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        try {
            const { finalOptions, sanitizedHtml } = buildPdfContext(htmlContent, undefined, options);

            html2pdf()
                .set(finalOptions)
                .from(sanitizedHtml)
                .outputPdf('blob')
                .then((blob: Blob) => {
                    resolve(blob);
                })
                .catch((error: unknown) => {
                    reject(error);
                });
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Generate a PDF as a base64 string (for email attachment)
 */
export const generatePDFBase64 = (htmlContent: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        generatePDFBlob(htmlContent)
            .then((blob: Blob) => {
                const reader = new FileReader();

                reader.onload = () => {
                    const dataUrl = reader.result as string;
                    // Strip data:application/pdf;base64, prefix
                    const base64 = dataUrl.split(',')[1];
                    resolve(base64);
                };

                reader.onerror = () => reject(new Error('Failed to convert PDF to base64'));
                reader.readAsDataURL(blob);
            })
            .catch((error: unknown) => {
                reject(error);
            });
    });
};

const DEFAULT_INVOICE_ACCENT_COLOR = '#374151';

const resolveInvoiceBranding = (invoiceData: InvoiceData) => {
    const templateBranding = invoiceData.template?.brandingOptions;
    const existingSnapshot = invoiceData.brandingSnapshot;
    const primaryColor = existingSnapshot?.primaryColor
        ?? invoiceData.businessInfo?.branding?.primaryColor
        ?? null;
    const logoAssetId = existingSnapshot?.logoAssetId
        ?? invoiceData.businessInfo?.branding?.logoAssetId
        ?? null;

    return {
        layoutStyle: normalizeInvoiceLayoutStyle(existingSnapshot?.layoutStyle || invoiceData.template?.layoutStyle || DEFAULT_INVOICE_LAYOUT_STYLE),
        logoPlacement: normalizeInvoiceLogoPlacement(existingSnapshot?.logoPlacement || invoiceData.template?.logoPlacement || DEFAULT_INVOICE_LOGO_PLACEMENT),
        showBusinessLogo: existingSnapshot?.showBusinessLogo ?? templateBranding?.showBusinessLogo ?? true,
        useBusinessPrimaryColor: existingSnapshot?.useBusinessPrimaryColor ?? templateBranding?.useBusinessPrimaryColor ?? true,
        primaryColor,
        logoAssetId,
    };
};

const getLayoutTokens = (layoutStyle: InvoiceTemplateLayoutStyle) => {
    if (layoutStyle === 'neutral') {
        return {
            tableHeaderBackground: 'transparent',
            tableHeaderTextColor: '#9ca3af',
            tableHeaderBorderBottom: '1px solid #ddd',
            tableHeaderTypographyStyle: 'font-size: 13px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.12em;',
            rowBorderColor: null,
            totalsContainerStyle: 'border-top: 1px solid #ddd; padding-top: 8px;',
            totalDividerStyle: 'padding-top: 10px;',
            paymentSectionStyle: 'margin-top: 10px; padding-top: 30px;',
            paymentCardStyle: 'padding: 0; display: flex; flex-direction: column; gap: 6px;',
        };
    }

    return {
        tableHeaderBackground: '#f8f9fa',
        tableHeaderTextColor: '#111827',
        tableHeaderBorderBottom: '1px solid #ddd',
        tableHeaderTypographyStyle: '',
        rowBorderColor: null,
        totalsContainerStyle: 'border-top: 1px solid #ddd; padding-top: 8px;',
        totalDividerStyle: 'padding-top: 10px;',
        paymentSectionStyle: 'margin-top: 10px; padding-top: 30px;',
        paymentCardStyle: 'background-color: #f8f9fa; padding: 15px; border-radius: 5px; display: flex; flex-direction: column; gap: 0;',
    };
};

const getHeaderPlacement = (logoPlacement: InvoiceTemplateLogoPlacement) => {
    const normalizedPlacement = normalizeInvoiceLogoPlacement(logoPlacement);

    if (normalizedPlacement === 'invoice-left-logo-right') {
        return {
            invoiceAlign: 'left',
            justifyContent: 'space-between',
            logoFirst: false,
        };
    }

    if (normalizedPlacement === 'invoice-center-logo-center') {
        return {
            invoiceAlign: 'center',
            justifyContent: 'center',
            logoFirst: true,
        };
    }

    return {
        invoiceAlign: 'right',
        justifyContent: 'space-between',
        logoFirst: true,
    };
};

/**
 * Create invoice HTML template
 * @param {Object} invoiceData - Invoice data object
 * @returns {string} HTML string for the invoice
 */
export const createInvoiceHTML = (invoiceData: InvoiceData): string => {
    const {
        documentMode = 'invoice',
        project,
        client,
        tasks: originalTasks,
        additionalTasks: originalAdditionalTasks = [],
        expenseItems = [],
        note = '',
        totalHours,
        total,
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
        billingPeriodPreset,
        billingPeriodStart,
        billingPeriodEnd,
        currency = getPreferredCurrency(),
        brandingLogoDataUrl = null,
    } = invoiceData;
    const resolvedTotal = typeof total === 'number' ? total : (typeof totalAmount === 'number' ? totalAmount : 0);
    const isQuoteDocument = documentMode === 'quote';
    const documentTitle = isQuoteDocument ? 'QUOTE' : 'INVOICE';
    const documentLabel = isQuoteDocument ? 'Quote' : 'Invoice';

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
    const branding = resolveInvoiceBranding(invoiceData);
    const layoutTokens = getLayoutTokens(branding.layoutStyle);
    const headerPlacement = getHeaderPlacement(branding.logoPlacement);
    const isCenteredHeader = headerPlacement.justifyContent === 'center';
    const isMinimalLayout = branding.layoutStyle === 'neutral';
    const showBillingPeriod = isQuoteDocument ? false : (invoiceData.template?.showBillingPeriod ?? true);
    const showProjectTitle = invoiceData.template?.showProjectTitle ?? true;
    const billingPeriodLabel = showBillingPeriod
        ? formatBillingPeriodLabel({
            preset: billingPeriodPreset || undefined,
            startDate: billingPeriodStart || '',
            endDate: billingPeriodEnd || '',
        })
        : '';
    const minimalLabelStyle = 'color: #9ca3af; font-size: 13px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.12em;';
    const invoiceTitleStyle = isMinimalLayout
        ? 'color: #111827; margin-bottom: 10px; font-size: 25px; font-weight: 400; letter-spacing: 0.12em;'
        : 'color: #333; margin-bottom: 10px; font-size: 28px; font-weight: bold;';
    const topAccentBarMarkup = branding.useBusinessPrimaryColor && branding.primaryColor
        ? `<div style="width: 100%; height: 3px; background-color: ${branding.primaryColor}; margin-bottom: 28px;"></div>`
        : '';
    const logoMarkup = branding.showBusinessLogo && brandingLogoDataUrl
        ? `<img src="${brandingLogoDataUrl}" alt="Business logo" style="max-width: 220px; max-height: 72px; object-fit: contain; display: inline-block;" />`
        : '';
    const dateMetaParts = [
        date ? `Date: ${date}` : '',
        !isQuoteDocument && dueDate ? `Due Date: ${dueDate}` : '',
    ].filter(Boolean);
    const dateMetaMarkup = isCenteredHeader && dateMetaParts.length > 0
        ? `<p style="color: #666; margin: 0;">${dateMetaParts.join(' &bull; ')}</p>`
        : `
            ${date ? `<p style="color: #666; margin: 0;">Date: ${date}</p>` : ''}
            ${!isQuoteDocument && dueDate ? `<p style="color: #666; margin: 0;">Due Date: ${dueDate}</p>` : ''}
        `;
    const billingPeriodMarkup = billingPeriodLabel
        ? `<p style="color: #666; margin: 0;">Billing Period: ${billingPeriodLabel}</p>`
        : '';
    const projectMarkup = showProjectTitle && project?.title
        ? `<p style="color: #666; margin: 0;">Project: ${project.title}</p>`
        : '';
    const invoiceMetaMarkup = `
        <div style="text-align: ${headerPlacement.invoiceAlign};">
            <h1 style="${invoiceTitleStyle}">${documentTitle}</h1>
            ${invoiceNumber ? `<p style="color: #666; margin: 0;">${documentLabel}: #${invoiceNumber}</p>` : ''}
            ${dateMetaMarkup}
            ${billingPeriodMarkup}
            ${projectMarkup}
        </div>
    `;

    const renderHeaderRow = () => {
        const logoBlock = logoMarkup
            ? `<div style="flex: 0 1 auto; text-align: center;">${logoMarkup}</div>`
            : '';
        const invoiceBlock = `<div style="flex: 0 1 auto;${isCenteredHeader ? '' : ' min-width: 240px;'}">${invoiceMetaMarkup}</div>`;
        const rowContent = headerPlacement.logoFirst
            ? `${logoBlock}${invoiceBlock}`
            : `${invoiceBlock}${logoBlock}`;

        if (isCenteredHeader) {
            return `
                <div style="display: flex; justify-content: center; align-items: center;">
                    <div style="display: inline-flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; max-width: 100%;">
                        ${rowContent}
                    </div>
                </div>
            `;
        }

        return `
            <div style="display: flex; justify-content: ${headerPlacement.justifyContent}; align-items: flex-end; gap: 24px;">
                ${rowContent}
            </div>
        `;
    };

    const renderHeader = () => {
        return `
            <div style="margin-bottom: 40px;">
                ${renderHeaderRow()}
            </div>
        `;
    };

    const partySectionStyle = '';
    const sectionHeadingStyle = isMinimalLayout
        ? `${minimalLabelStyle} margin-bottom: 10px;`
        : 'color: #333; margin-bottom: 10px;';
    const tableHeaderBackground = layoutTokens.tableHeaderBackground;
    const tableHeaderTextColor = layoutTokens.tableHeaderTextColor;
    const tableHeaderBorderBottom = layoutTokens.tableHeaderBorderBottom;
    const tableHeaderTypographyStyle = layoutTokens.tableHeaderTypographyStyle;
    const tableStyle = 'width: 100%; border-collapse: collapse; margin-bottom: 20px;';
    const tableHeaderCellPadding = '12px 8px';
    const tableBodyCellPadding = '8px';
    const tableHeaderCellLineHeight = '1.25';
    const tableBodyCellLineHeight = '1.25';
    const noteLineHeight = '1.3';
    const paymentDetailLineHeight = '1.4';
    const rowBorderColor = layoutTokens.rowBorderColor;
    const totalsContainerStyle = layoutTokens.totalsContainerStyle;
    const totalDividerStyle = layoutTokens.totalDividerStyle;
    const noteContainerStyle = 'width: 60%; margin-top: 10px; text-align: left;';
    const paymentSectionStyle = branding.layoutStyle === 'classic' && note.trim().length > 0
        ? 'margin-top: 10px; padding-top: 30px;'
        : layoutTokens.paymentSectionStyle;
    const paymentCardStyle = layoutTokens.paymentCardStyle;
    const paymentHeadingStyle = isMinimalLayout
        ? `${minimalLabelStyle} margin-bottom: 15px;`
        : 'color: #333; margin-bottom: 15px;';
    const minimalPaymentLabelStyle = 'color: inherit; font-weight: 400;';
    const totalTextColor = DEFAULT_INVOICE_ACCENT_COLOR;
    const invoiceDocumentFontFamily = 'Arial, sans-serif';
    const invoiceDocumentPadding = '0 0 12px 0';
    const renderPaymentDetailLine = (label: string, value?: string) => {
        if (!value) {
            return '';
        }

        return `<p style="margin: 0; line-height: ${paymentDetailLineHeight};">${isMinimalLayout ? `<span style="${minimalPaymentLabelStyle}">${label}:</span> ${value}` : `<strong>${label}:</strong> ${value}`}</p>`;
    };

    return `
        <style>
            .invoice-document,
            .invoice-document * {
                box-sizing: border-box;
            }

            .invoice-document {
                width: 100%;
                max-width: none;
                margin: 0;
                padding: ${invoiceDocumentPadding};
                font-size: 16px;
                line-height: 1.35;
                background-color: #ffffff;
                color: #111827;
                color-scheme: light;
                -webkit-text-fill-color: #111827;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                forced-color-adjust: none;
            }

            .invoice-document p,
            .invoice-document td,
            .invoice-document th,
            .invoice-document table,
            .invoice-document span,
            .invoice-document div,
            .invoice-document strong,
            .invoice-document h1,
            .invoice-document h2,
            .invoice-document h3,
            .invoice-document h4 {
                color: inherit;
                -webkit-text-fill-color: inherit;
            }

            .invoice-task-table tr,
            .invoice-totals,
            .invoice-note,
            .invoice-payment-section {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        </style>
        <div class="invoice-document" style="font-family: ${invoiceDocumentFontFamily}; width: 100%; max-width: none; margin: 0; padding: ${invoiceDocumentPadding}; box-sizing: border-box; background-color: #ffffff; color: #111827; color-scheme: light; -webkit-text-fill-color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; forced-color-adjust: none;">
            ${topAccentBarMarkup}
            ${renderHeader()}
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div style="${partySectionStyle}">
                    <h3 style="${sectionHeadingStyle}">${isMinimalLayout ? 'Invoice To:' : '<strong>Invoice To:</strong>'}</h3>
                    <p style="margin: 0; line-height: 1.5;">
                        ${client.name}<br>
                        ${client.address ? client.address + '<br>' : ''}
                        ${client.city ? client.city + ', ' : ''}${client.state ? client.state + ' ' : ''}${client.zip || ''}${(client.city || client.state || client.zip) && client.country ? '<br>' : ''}
                        ${client.country ? client.country : ''}
                    </p>
                </div>
                <div style="text-align: right; ${partySectionStyle}">
                    ${businessInfo ? `
                        <h3 style="${sectionHeadingStyle}">${isMinimalLayout ? 'Invoice From:' : '<strong>Invoice From:</strong>'}</h3>
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
            <table class="invoice-task-table" style="${tableStyle}">
                <thead>
                    <tr style="color: ${tableHeaderTextColor};">
                        <th style="padding: ${tableHeaderCellPadding}; text-align: left; vertical-align: middle; line-height: ${tableHeaderCellLineHeight}; border-bottom: ${tableHeaderBorderBottom}; background-color: ${tableHeaderBackground}; color: ${tableHeaderTextColor}; ${tableHeaderTypographyStyle}">Description</th>
                        ${showHoursAndRate ? `<th style="padding: ${tableHeaderCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableHeaderCellLineHeight}; border-bottom: ${tableHeaderBorderBottom}; background-color: ${tableHeaderBackground}; color: ${tableHeaderTextColor}; ${tableHeaderTypographyStyle}">Hours</th>` : ''}
                        ${showHoursAndRate ? `<th style="padding: ${tableHeaderCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableHeaderCellLineHeight}; border-bottom: ${tableHeaderBorderBottom}; background-color: ${tableHeaderBackground}; color: ${tableHeaderTextColor}; ${tableHeaderTypographyStyle}">Rate</th>` : ''}
                        ${showQuantity ? `<th style="padding: ${tableHeaderCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableHeaderCellLineHeight}; border-bottom: ${tableHeaderBorderBottom}; background-color: ${tableHeaderBackground}; color: ${tableHeaderTextColor}; ${tableHeaderTypographyStyle}">Qty</th>` : ''}
                        <th style="padding: ${tableHeaderCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableHeaderCellLineHeight}; border-bottom: ${tableHeaderBorderBottom}; background-color: ${tableHeaderBackground}; color: ${tableHeaderTextColor}; ${tableHeaderTypographyStyle}">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map((task, index) => {
                        const isLastTask = index === tasks.length - 1 && additionalTasks.length === 0;
                        const borderStyle = isLastTask || !rowBorderColor ? '' : `border-bottom: 1px solid ${rowBorderColor};`;
                        
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
                        let taskAmount: number;
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
                            <td style="padding: ${tableBodyCellPadding}; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${taskTitle}</td>
                            ${showHoursAndRate ? `<td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${hours}</td>` : ''}
                            ${showHoursAndRate ? `<td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${rateDisplay}</td>` : ''}
                            ${showQuantity ? `<td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${quantity}</td>` : ''}
                            <td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                }).join('')}
                ${additionalTasks.map((task, index) => {
                        const isLastTask = index === additionalTasks.length - 1;
                        const borderStyle = isLastTask || !rowBorderColor ? '' : `border-bottom: 1px solid ${rowBorderColor};`;
                        
                        // Check if this additional task uses flat rate
                        const usesFlatRate = task.useFlatRate === true || (task.useFlatRate !== false && task.flatRate !== undefined);
                        const displayHours = parseFloat(String(task.hours)) || 0;
                        
                        // Calculate based on whether it's a flat rate task or hourly
                        let taskAmount: number;
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
                            <td style="padding: ${tableBodyCellPadding}; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${taskTitle}</td>
                            ${showHoursAndRate ? `<td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${hours}</td>` : ''}
                            ${showHoursAndRate ? `<td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${rate}</td>` : ''}
                            ${showQuantity ? `<td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${quantity}</td>` : ''}
                            <td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                }).join('')}
                </tbody>
            </table>`;
                } else {
                    // No tasks
                    return `
            <table class="invoice-task-table" style="${tableStyle}">
                <thead>
                    <tr style="color: ${tableHeaderTextColor};">
                        <th style="padding: ${tableHeaderCellPadding}; text-align: left; vertical-align: middle; line-height: ${tableHeaderCellLineHeight}; border-bottom: ${tableHeaderBorderBottom}; background-color: ${tableHeaderBackground}; color: ${tableHeaderTextColor}; ${tableHeaderTypographyStyle}">Description</th>
                        <th style="padding: ${tableHeaderCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableHeaderCellLineHeight}; border-bottom: ${tableHeaderBorderBottom}; background-color: ${tableHeaderBackground}; color: ${tableHeaderTextColor}; ${tableHeaderTypographyStyle}">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${tasks.map((task, index) => {
                        const isLastTask = index === tasks.length - 1 && additionalTasks.length === 0;
                        const borderStyle = isLastTask || !rowBorderColor ? '' : `border-bottom: 1px solid ${rowBorderColor};`;
                        
                        // Check if this task uses flat rate
                        const hasExplicitFlatRate = task.flatRate !== undefined;
                        const usesFlatRate = task.useFlatRate === true || (task.useFlatRate !== false && hasExplicitFlatRate);
                                           
                        // Handle merged subtasks display
                        let displayHours = parseFloat(String(task.hours)) || 0;
                        const taskTitle = task.title;
                        
                        // Calculate task amount - consider hours for hourly tasks even in simplified table
                        let taskAmount: number;
                        
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
                            <td style="padding: ${tableBodyCellPadding}; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${finalTitle}</td>
                            <td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                }).join('')}
                    ${additionalTasks.map((task, index) => {
                        const isLastTask = index === additionalTasks.length - 1;
                        const borderStyle = isLastTask || !rowBorderColor ? '' : `border-bottom: 1px solid ${rowBorderColor};`;
                        
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
                            <td style="padding: ${tableBodyCellPadding}; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${taskTitle}</td>
                            <td style="padding: ${tableBodyCellPadding}; text-align: right; vertical-align: middle; line-height: ${tableBodyCellLineHeight}; ${borderStyle}">${getCurrencySymbol(invoiceCurrency)}${taskAmount.toFixed(2)}</td>
                        </tr>
                    `;
                }).join('')}
                </tbody>
            </table>`;
                }
            })()}
            
            <div class="invoice-totals" style="text-align: right; margin-bottom: 10px;">
                <div style="${totalsContainerStyle}">
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
                        
                        <p style="margin: 10px 0 0 0; font-size: 24px; color: ${totalTextColor}; ${totalDividerStyle}"><strong>Total: ${getCurrencySymbol(currency)}${resolvedTotal.toFixed(2)}</strong></p>
                    ` : `
                        <p style="margin: 10px 0 0 0; font-size: 24px; color: ${totalTextColor};"><strong>Total${totalHours && parseFloat(String(totalHours)) > 0 ? ` (${parseFloat(String(totalHours)).toFixed(2)} hours)` : ''}: ${getCurrencySymbol(currency)}${resolvedTotal.toFixed(2)}</strong></p>
                    `}
                </div>
            </div>
            
            ${note ? `
            <div class="invoice-note" style="${noteContainerStyle}">
                <p style="font-style: italic; color: #666; font-size: 14px; line-height: ${noteLineHeight}; margin: 5px 0;">${note}</p>
            </div>
            ` : ''}
            
            ${paymentMethod ? `
            <div class="invoice-payment-section" style="${paymentSectionStyle}">
                <h3 style="${paymentHeadingStyle}">${isMinimalLayout ? 'Payment Details:' : '<strong>Payment Details:</strong>'}</h3>
                <div style="${paymentCardStyle}">

                    ${renderPaymentDetailLine('Account Holder', paymentMethod.fullName)}
                    ${renderPaymentDetailLine('Bank', paymentMethod.bank)}
                    ${renderPaymentDetailLine('IBAN', paymentMethod.iban)}
                    ${renderPaymentDetailLine('SWIFT/BIC', paymentMethod.swift)}
                    ${renderPaymentDetailLine('Bank Address', paymentMethod.bankAddress)}
                    ${renderPaymentDetailLine('PayPal', paymentMethod.paypal)}

                    ${paymentMethod.custom && paymentMethod.custom.length > 0 ? 
                        paymentMethod.custom.map(field => 
                            renderPaymentDetailLine(field.label, field.value)
                        ).join('') : ''
                    }
                </div>
            </div>
            ` : ''}
        </div>
    `;
};

const resolveStoredBrandLogoDataUrl = (
    invoice: StoredInvoice,
    businessBrandAssets: StoredBusinessBrandAsset[] = []
): string | null => {
    const logoAssetId = invoice.brandingSnapshot?.logoAssetId
        ?? invoice.businessInfo?.branding?.logoAssetId
        ?? null;

    if (!logoAssetId) {
        return null;
    }

    const asset = businessBrandAssets.find((candidate) => candidate.id === logoAssetId && !candidate.archivedAt);
    return asset?.dataUrl || null;
};

/**
 * Build invoice HTML from the current structured invoice data.
 */
export const buildInvoiceHtmlContent = (
    invoice: StoredInvoice,
    clients: StoredClient[] = [],
    businessBrandAssets: StoredBusinessBrandAsset[] = []
): string => {
    const foundClient = invoice.clientId
        ? clients.find((client) => client.id === invoice.clientId)
        : null;

    const clientData = foundClient ? {
        name: foundClient.clientName || '',
        contactPerson: foundClient.contactPerson || '',
        email: foundClient.email || '',
        address: foundClient.address || '',
        city: foundClient.city || '',
        state: foundClient.state || '',
        zip: foundClient.zip || '',
        country: foundClient.country || ''
    } : (invoice.client || { name: '' });

    return createInvoiceHTML({
        documentMode: invoice.documentMode,
        project: invoice.project,
        client: clientData,
        tasks: invoice.tasks || [],
        additionalTasks: invoice.additionalTasks || [],
        expenseItems: invoice.expenseItems || [],
        note: invoice.note,
        totalHours: invoice.totalHours,
        total: invoice.total,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        dueDate: invoice.dueDate,
        paymentMethod: invoice.paymentMethod,
        businessInfo: invoice.businessInfo,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        shipping: invoice.shipping,
        tax: invoice.tax,
        taxRate: invoice.taxRate,
        taxLabel: invoice.taxLabel,
        taskFlatRates: invoice.taskFlatRates,
        taskHourlyRates: invoice.taskHourlyRates,
        billingPeriodPreset: invoice.billingPeriodPreset,
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        currency: invoice.currency,
        template: invoice.template,
        templateId: invoice.templateId,
        brandingSnapshot: invoice.brandingSnapshot,
        brandingLogoDataUrl: resolveStoredBrandLogoDataUrl(invoice, businessBrandAssets),
    });
};

/**
 * Return stored invoice HTML when it matches the current invoice number, otherwise regenerate it.
 */
export const getCurrentInvoiceHtmlContent = (
    invoice: StoredInvoice,
    clients: StoredClient[] = [],
    businessBrandAssets: StoredBusinessBrandAsset[] = []
): string => {
    const storedHtml = invoice?.htmlContent;
    if (storedHtml && (!invoice?.invoiceNumber || storedHtml.includes(invoice.invoiceNumber))) {
        return storedHtml;
    }

    return buildInvoiceHtmlContent(invoice, clients, businessBrandAssets);
};
