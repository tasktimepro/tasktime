import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useInvoicePricing from '../components/invoice/hooks/useInvoicePricing'
import {
    buildInvoiceHtmlContent,
    createInvoiceHTML,
    generatePDF,
    generatePDFBlob,
    generatePDFBase64,
    getCurrentInvoiceHtmlContent,
} from './pdfUtils'

const html2pdfMocks = vi.hoisted(() => {

    return {
        html2pdf: vi.fn(),
        set: vi.fn(),
        from: vi.fn(),
        save: vi.fn(),
        outputPdf: vi.fn(),
    }
})

vi.mock('html2pdf.js', () => ({

    default: html2pdfMocks.html2pdf
}))

beforeEach(() => {

    vi.clearAllMocks()

    html2pdfMocks.save.mockResolvedValue(undefined)
    html2pdfMocks.outputPdf.mockResolvedValue(new Blob(['%PDF-mock'], { type: 'application/pdf' }))
    html2pdfMocks.from.mockReturnValue({ save: html2pdfMocks.save, outputPdf: html2pdfMocks.outputPdf })
    html2pdfMocks.set.mockReturnValue({ from: html2pdfMocks.from })
    html2pdfMocks.html2pdf.mockReturnValue({ set: html2pdfMocks.set })
})

describe('createInvoiceHTML', () => {

    it('renders totals with subtotal breakdown', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 209,
            subtotal: 200,
            discount: 20,
            shipping: 10,
            tax: 19,
            taxRate: 10,
            taxLabel: 'Tax',
            currency: 'USD'
        })

        expect(html).toContain('Subtotal: <strong>$200.00</strong>')
        expect(html).toContain('Discount: <strong>-$20.00</strong>')
        expect(html).toContain('Shipping: <strong>$10.00</strong>')
        expect(html).toContain('Tax (10.0%): <strong>$19.00</strong>')
        expect(html).toContain('Total: $209.00')
        expect(html).toContain('margin: 6px 0 0 0; font-size: 24px; color: #111827;')
    })

    it('renders total hours beside subtotal when hourly columns exist', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task', title: 'Hourly', hours: 5.25, hourlyRate: 50 }],
            totalHours: 5.25,
            totalAmount: 262.5,
            subtotal: 262.5,
            currency: 'CHF'
        })

        expect(html).toContain('Hours</th>')
        expect(html).toContain('Total hours: <strong>5.25</strong>')
        expect(html).toContain('Subtotal: <strong>CHF262.50</strong>')
    })

    it('does not render total hours beside subtotal for flat-only invoices', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task', title: 'Flat', flatRate: 100, quantity: 2, useFlatRate: true }],
            totalAmount: 200,
            subtotal: 200,
            currency: 'USD'
        })

        expect(html).not.toContain('Hours</th>')
        expect(html).not.toContain('Total hours: <strong>')
        expect(html).toContain('Subtotal: <strong>$200.00</strong>')
    })

    it('uses full-width document container layout', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD'
        })

        expect(html).toContain('width: 100%')
        expect(html).toContain('max-width: none')
        expect(html).toContain('padding: 0')
    })

    it('forces a self-contained light document color model for mobile rendering', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD'
        })

        expect(html).toContain('.invoice-document')
        expect(html).toContain('background-color: #ffffff')
        expect(html).toContain('color: #111827')
        expect(html).toContain('color-scheme: light')
        expect(html).toContain('-webkit-text-fill-color: #111827')
        expect(html).toContain('forced-color-adjust: none')
    })

    it('renders flat rate additional task totals with quantity', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            additionalTasks: [{ title: 'Flat Task', flatRate: 50, quantity: 3, useFlatRate: true }],
            totalAmount: 150,
            currency: 'USD'
        })

        expect(html).toContain('Flat Task')
        expect(html).toContain('$150.00')
    })

    it('renders flat rate project task totals with quantity', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'flat', title: 'Flat Project Task', flatRate: 75, quantity: 2, useFlatRate: true }],
            totalAmount: 150,
            currency: 'USD'
        })

        expect(html).toContain('Flat Project Task')
        expect(html).toContain('$150.00')
    })

    it('renders multi-project invoices as repeated project sections with separate additional expenses', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            projectBreakdowns: [
                {
                    projectId: 'project-1',
                    projectTitle: 'Website Redesign',
                    clientId: 'client-1',
                    pricingMode: 'hourly',
                    totalHours: 4,
                    subtotal: 450,
                    tasks: [{ id: 'task-1', title: 'UX audit', hours: 4, hourlyRate: 100 }],
                    expenseItems: [{ id: 'expense-1', title: 'Stock assets', amount: 50, supplierName: 'Envato' }],
                },
                {
                    projectId: 'project-2',
                    projectTitle: 'Maintenance',
                    clientId: 'client-1',
                    pricingMode: 'flat',
                    totalHours: 0,
                    subtotal: 300,
                    tasks: [{ id: 'task-2', title: 'Monthly retainer', flatRate: 300, quantity: 1, useFlatRate: true }],
                    expenseItems: [],
                },
            ],
            clientExpenseItems: [{ id: 'expense-2', title: 'Travel', amount: 75 }],
            totalAmount: 825,
            subtotal: 825,
            currency: 'EUR'
        })

        expect(html).toContain('Website Redesign')
        expect(html).toContain('Maintenance')
        expect(html).toContain('Additional Expenses')
        expect((html.match(/Project subtotal:/g) || []).length).toBe(1)
        expect(html).toContain('Project subtotal: <strong>€450.00</strong>')
        expect(html).not.toContain('Project subtotal: <strong>€300.00</strong>')
        expect(html).toContain('Additional expenses subtotal: <strong>€75.00</strong>')
        expect(html).toContain('Travel')
        expect(html).toContain('Stock assets')
    })

    it('moves grouped project hours into each project section and hides the document total hours for mixed pricing', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            projectBreakdowns: [
                {
                    projectId: 'project-1',
                    projectTitle: 'Hourly Project',
                    clientId: 'client-1',
                    pricingMode: 'hourly',
                    totalHours: 4,
                    subtotal: 400,
                    tasks: [{ id: 'task-1', title: 'Implementation', hours: 4, hourlyRate: 100 }],
                    expenseItems: [],
                },
                {
                    projectId: 'project-2',
                    projectTitle: 'Flat Project',
                    clientId: 'client-1',
                    pricingMode: 'flat',
                    totalHours: 0,
                    subtotal: 300,
                    tasks: [{ id: 'task-2', title: 'Retainer', flatRate: 300, quantity: 1, useFlatRate: true }],
                    expenseItems: [],
                },
            ],
            clientExpenseItems: [{ id: 'expense-2', title: 'Travel', amount: 75 }],
            totalHours: 4,
            totalAmount: 775,
            subtotal: 775,
            currency: 'USD'
        })

        expect(html).not.toContain('Project total hours:')
        expect(html).not.toContain('Project subtotal:')
        expect(html).toMatch(/<div class="invoice-project-section" style="margin-bottom: 36px;">\s*<h3[^>]*>Hourly Project<\/h3>/)
        expect(html).toMatch(/<div class="invoice-project-section" style="margin-bottom: 24px;">\s*<h3[^>]*>Flat Project<\/h3>/)
        expect(html).toContain('Additional expenses subtotal: <strong>$75.00</strong>')
        expect(html).not.toContain('Total hours: <strong>4.00</strong>')
        expect(html).toContain('Subtotal: <strong>$775.00</strong>')
    })

    it('uses hourly totals when flat rate is disabled', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'hourly', title: 'Hourly Task', hours: 2, hourlyRate: 50, useFlatRate: false }],
            taskFlatRates: { hourly: 0 },
            totalAmount: 100,
            currency: 'USD'
        })

        expect(html).toContain('Hourly Task')
        expect(html).toContain('$100.00')
    })

    it('calculates merged subtask totals with hourly rates', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            project: { hourlyRate: 0 },
            tasks: [{
                id: 'parent',
                title: 'Parent Task',
                hours: 1,
                hourlyRate: 100,
                isMerged: true,
                mergedSubtasks: [{ id: 'child', title: 'Child Task', hours: 2, hourlyRate: 50 }]
            }],
            totalAmount: 200,
            currency: 'USD'
        })

        expect(html).toContain('Parent Task')
        expect(html).toContain('$200.00')
        expect(html).toContain('Mixed')
    })

    it('renders merged rate when all subtask rates match', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            project: { hourlyRate: 0 },
            tasks: [{
                id: 'parent',
                title: 'Parent Task',
                hours: 1,
                hourlyRate: 50,
                isMerged: true,
                mergedSubtasks: [{ id: 'child', title: 'Child Task', hours: 2, hourlyRate: 50 }]
            }],
            totalAmount: 150,
            currency: 'USD'
        })

        expect(html).toContain('Parent Task')
        expect(html).toContain('$50.00')
        expect(html).not.toContain('Mixed')
    })

    it('renders simplified table when no tracked hours', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'flat', title: 'Flat', flatRate: 100 }],
            totalAmount: 100,
            currency: 'USD'
        })

        expect(html).toContain('Description')
        expect(html).toContain('Total')
        expect(html).not.toContain('Hours</th>')
    })

    it('shows quantity column for flat-only invoices', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'flat', title: 'Flat', flatRate: 100, quantity: 2, useFlatRate: true }],
            totalAmount: 200,
            currency: 'USD'
        })

        expect(html).toContain('Qty</th>')
        expect(html).not.toContain('Rate</th>')
    })

    it('renders hourly table with rate and hours columns', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task', title: 'Hourly', hours: 2, hourlyRate: 50 }],
            totalAmount: 100,
            currency: 'USD'
        })

        expect(html).toContain('Hours</th>')
        expect(html).toContain('Rate</th>')
        expect(html).toContain('Hourly')
    })

    it('renders total line with hours when subtotal missing', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task', title: 'Hourly', hours: 1.5, hourlyRate: 80 }],
            totalHours: 1.5,
            totalAmount: 120,
            currency: 'USD'
        })

        expect(html).toContain('Total (1.50 hours): $120.00')
    })

    it('includes due date when provided', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            date: '2026-01-19',
            dueDate: '2026-02-01',
            currency: 'USD'
        })

        expect(html).toContain('Due Date: 2026-02-01')
    })

    it('shows the billing period and project title by default when invoice data includes them', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            project: { title: 'Website redesign' },
            tasks: [],
            totalAmount: 0,
            billingPeriodPreset: 'all-time',
            currency: 'USD'
        })

        expect(html).toContain('Billing Period: All Time')
        expect(html).toContain('Project: Website redesign')
    })

    it('hides the billing period and project title when the template disables them', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            project: { title: 'Website redesign' },
            tasks: [],
            totalAmount: 0,
            billingPeriodPreset: 'all-time',
            currency: 'USD',
            template: {
                showBillingPeriod: false,
                showProjectTitle: false,
            }
        })

        expect(html).not.toContain('Billing Period: All Time')
        expect(html).not.toContain('Project: Website redesign')
    })

    it('keeps the classic invoice layout styling by default', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            businessInfo: { businessName: 'TaskTime Studio' },
            tasks: [{ id: 'task', title: 'Classic Task', hours: 2, hourlyRate: 80 }],
            subtotal: 160,
            totalAmount: 160,
            currency: 'USD',
            paymentMethod: { bank: 'TaskTime Bank' },
            template: {}
        })

        expect(html).toContain('Invoice To:')
        expect(html).toContain('Invoice From:')
        expect(html).toContain('Payment Details:')
        expect(html).toContain('background-color: #f8f9fa;')
        expect(html).toContain('<div style="margin-bottom: 40px;">')
        expect(html).toContain('justify-content: space-between; align-items: flex-end; gap: 24px;')
        expect(html).toContain('border-top: 1px solid #ddd; padding-top: 8px;')
        expect(html).toContain('padding-top: 10px;')
        expect(html).not.toContain('border-top: 1px solid #ddd; padding-top: 10px;')
        expect(html).not.toContain('border-bottom: 1px solid #eee;')
        expect(html).toContain('margin-top: 10px; padding-top: 30px;')
        expect(html).not.toContain('margin-top: 10px; padding-top: 30px; border-top: 1px solid #ddd;')
    })

    it('renders a full-width brand bar when business primary color is enabled', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD',
            businessInfo: {
                branding: {
                    primaryColor: '#1f2937',
                }
            },
            template: {}
        })

        expect(html).toContain('<div style="width: 100%; height: 3px; background-color: #1f2937; margin-bottom: 28px;"></div>')
        expect(html).toContain('margin: 6px 0 0 0; font-size: 24px; color: #111827;')
        expect(html).not.toContain('font-size: 24px; color: #1f2937;')
    })

    it('omits the brand bar when business primary color is disabled', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD',
            businessInfo: {
                branding: {
                    primaryColor: '#1f2937',
                }
            },
            template: {
                brandingOptions: {
                    useBusinessPrimaryColor: false,
                }
            }
        })

        expect(html).not.toContain('height: 3px; background-color: #1f2937; margin-bottom: 28px;')
    })

    it('aligns description header padding with the row content in both classic and minimal layouts', () => {

        const classicHtml = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task', title: 'Classic Task', hours: 2, hourlyRate: 80 }],
            totalAmount: 160,
            currency: 'USD',
            template: { layoutStyle: 'classic' }
        })

        const minimalHtml = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task', title: 'Minimal Task', hours: 2, hourlyRate: 80 }],
            totalAmount: 160,
            currency: 'USD',
            template: { layoutStyle: 'neutral' }
        })

        expect(classicHtml).toContain('<th style="padding: 12px 8px; text-align: left; vertical-align: middle; line-height: 1.25;')
        expect(classicHtml).toContain('<td style="padding: 8px; vertical-align: middle; line-height: 1.25;')
        expect(minimalHtml).toContain('<th style="padding: 12px 8px; text-align: left; vertical-align: middle; line-height: 1.25;')
        expect(minimalHtml).toContain('<td style="padding: 8px; vertical-align: middle; line-height: 1.25;')
    })

    it('removes the classic payment divider when an invoice note is present', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task', title: 'Classic Task', hours: 2, hourlyRate: 80 }],
            totalAmount: 160,
            currency: 'USD',
            note: 'Thanks for your business',
            paymentMethod: { bank: 'TaskTime Bank' },
            template: { layoutStyle: 'classic' }
        })

        expect(html).toContain('Thanks for your business')
        expect(html).toContain('Payment Details:')
        expect(html).toContain('margin-top: 10px; padding-top: 30px;')
        expect(html).not.toContain('margin-top: 10px; padding-top: 30px; border-top: 1px solid #ddd;')
    })

    it('renders the neutral layout without header fill, payment card fill, or row dividers', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [
                { id: 'task-1', title: 'Task A', hours: 1, hourlyRate: 80 },
                { id: 'task-2', title: 'Task B', hours: 2, hourlyRate: 80 },
            ],
            subtotal: 240,
            totalAmount: 240,
            currency: 'USD',
            paymentMethod: { bank: 'TaskTime Bank' },
            template: { layoutStyle: 'neutral' }
        })

        expect(html).toContain('background-color: transparent')
        expect(html).not.toContain('background-color: #f8f9fa; padding: 15px; border-radius: 5px; display: flex; flex-direction: column; gap: 0;')
        expect(html).toContain('padding: 0; display: flex; flex-direction: column; gap: 6px;')
        expect(html).not.toContain('border-bottom: 1px solid #eee;')
        expect(html).toContain('background-color: transparent; color: #9ca3af;')
        expect(html).toContain('<h1 style="color: #111827; margin-bottom: 10px; font-size: 25px; font-weight: 400; letter-spacing: 0.12em;">INVOICE</h1>')
        expect(html).toContain('font-size: 13px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.12em;')
        expect(html).toContain('<h3 style="color: #9ca3af; font-size: 13px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 15px;">Payment Details:</h3>')
        expect(html).toContain('<p style="margin: 0; line-height: 1.4;"><span style="color: inherit; font-weight: 400;">Bank:</span> TaskTime Bank</p>')
        expect(html).toContain('break-inside: avoid;')
        expect(html).toContain('border-top: 1px solid #ddd; padding-top: 8px;')
        expect(html).not.toContain('border-top: 1px solid #ddd; padding-top: 10px;')
        expect(html).not.toContain('margin-top: 10px; padding-top: 30px; border-top: 1px solid #ddd;')
    })

    it('prefers the saved invoice layout snapshot over the current template layout', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task-1', title: 'Task A', hours: 1, hourlyRate: 80 }],
            subtotal: 80,
            totalAmount: 80,
            currency: 'USD',
            paymentMethod: { bank: 'TaskTime Bank' },
            template: { layoutStyle: 'classic' },
            brandingSnapshot: {
                layoutStyle: 'neutral',
                logoPlacement: 'invoice-left-logo-right',
                showBusinessLogo: true,
                useBusinessPrimaryColor: true,
            }
        })

        expect(html).toContain('background-color: transparent')
        expect(html).not.toContain('background-color: #f8f9fa; padding: 15px; border-radius: 5px; display: flex; flex-direction: column; gap: 0;')
    })

    it('rebuilds invoice html from structured invoice data', () => {

        const html = buildInvoiceHtmlContent({
            invoiceNumber: 'INV-0160',
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD'
        })

        expect(html).toContain('Invoice: #INV-0160')
    })

    it('hydrates client details from clientId when rebuilding stored invoice html', () => {

        const html = buildInvoiceHtmlContent({
            clientId: 'client-1',
            invoiceNumber: 'INV-0161',
            client: { name: 'Stale Name' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD'
        }, [{
            id: 'client-1',
            clientName: 'Fresh Client',
            email: 'fresh@example.com'
        }])

        expect(html).toContain('Fresh Client')
        expect(html).not.toContain('fresh@example.com')
        expect(html).not.toContain('Stale Name')
    })

    it('regenerates stale stored html when invoice number changed', () => {

        const html = getCurrentInvoiceHtmlContent({
            invoiceNumber: 'INV-0160',
            htmlContent: '<div>Invoice: #INV-0159</div>',
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD'
        })

        expect(html).toContain('Invoice: #INV-0160')
        expect(html).not.toContain('INV-0159')
    })

    it('reuses stored html when the current invoice number already matches', () => {

        const html = getCurrentInvoiceHtmlContent({
            invoiceNumber: 'INV-0200',
            htmlContent: '<div>Invoice: #INV-0200</div>',
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD'
        })

        expect(html).toBe('<div>Invoice: #INV-0200</div>')
    })

    it('reuses stored html when no invoice number is set yet', () => {

        const html = getCurrentInvoiceHtmlContent({
            htmlContent: '<div>Draft invoice</div>',
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD'
        })

        expect(html).toBe('<div>Draft invoice</div>')
    })

    it('renders quote labels without due date or billing period', () => {

        const html = createInvoiceHTML({
            documentMode: 'quote',
            project: { title: 'Website Refresh', hourlyRate: 120 },
            client: { name: 'Client Name' },
            tasks: [{ id: 'task', title: 'Discovery', hours: 2, hourlyRate: 120 }],
            totalHours: 2,
            totalAmount: 240,
            invoiceNumber: '29112233',
            date: '2026-05-29',
            dueDate: '2026-06-10',
            billingPeriodStart: '2026-05-01',
            billingPeriodEnd: '2026-05-31',
            currency: 'USD'
        })

        expect(html).toContain('QUOTE')
        expect(html).toContain('Quote: #29112233')
        expect(html).not.toContain('Due Date: 2026-06-10')
        expect(html).not.toContain('Billing Period:')
    })

    it('renders business info, payment method, and note', () => {

        const html = createInvoiceHTML({
            project: { title: 'Project A', hourlyRate: 120 },
            client: {
                name: 'Client Name',
                contactPerson: 'Contact',
                email: 'client@example.com',
                address: '123 Main',
                city: 'City',
                state: 'ST',
                zip: '12345',
                country: 'Country'
            },
            tasks: [{ id: 'task', title: 'Task', hours: 1, hourlyRate: 120 }],
            totalHours: 1,
            totalAmount: 120,
            note: 'Thanks for your business',
            businessInfo: {
                businessName: 'Biz',
                address: 'Biz St',
                city: 'Biz City',
                state: 'BS',
                zip: '99999',
                country: 'Bizland',
                email: 'biz@example.com',
                phone: '555',
                registrationNumber: 'REG',
                vat: 'VAT',
                taxNumber: 'TAX',
                custom: [{ label: 'Custom', value: 'Value' }]
            },
            paymentMethod: {
                fullName: 'Payee',
                bank: 'Bank',
                iban: 'IBAN',
                swift: 'SWIFT',
                bankAddress: 'Bank St',
                paypal: 'paypal@example.com',
                custom: [{ label: 'PM', value: 'Custom' }]
            },
            billingPeriodPreset: 'custom',
            billingPeriodStart: '2026-04-01',
            billingPeriodEnd: '2026-04-30',
            currency: 'USD'
        })

        expect(html).toContain('Invoice To:')
        expect(html).toContain('Invoice From:')
        expect(html).toContain('Payment Details:')
        expect(html).toContain('Billing Period:')
        expect(html).not.toContain('Contact<br>')
        expect(html).not.toContain('client@example.com')
        expect(html).toContain('vertical-align: middle;')
        expect(html).toContain('background-color: #f8f9fa; padding: 15px; border-radius: 5px; display: flex; flex-direction: column; gap: 0;')
        expect(html).toContain('margin: 0; line-height: 1.4;')
        expect(html).toContain('Thanks for your business')
    })

    it('keeps sender details only in the invoice from section', () => {

        const businessName = 'Sender Once Ltd'
        const html = createInvoiceHTML({
            client: { name: 'Client Name' },
            tasks: [{ id: 'task', title: 'Task', hours: 1, hourlyRate: 120 }],
            totalAmount: 120,
            currency: 'USD',
            template: { logoPlacement: 'invoice-right-logo-left' },
            businessInfo: { businessName },
        })

        expect((html.match(new RegExp(businessName, 'g')) || []).length).toBe(1)
    })

    it('stacks the logo above the invoice block for the centered logo placement', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client Name' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD',
            template: { logoPlacement: 'invoice-center-logo-center' },
            date: '04/05/2026',
            dueDate: '19/05/2026',
            brandingLogoDataUrl: 'data:image/png;base64,AAAA',
        })

        expect(html).toContain('justify-content: center')
        expect(html).toContain('text-align: center;')
        expect(html).toContain('flex-direction: column;')
        expect(html).toContain('gap: 12px;')
        expect(html).toContain('Date: 04/05/2026 &bull; Due Date: 19/05/2026')
    })

    it('shows dashes for flat rate task without tracked hours in hourly table', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [
                { id: 'hourly', title: 'Hourly', hours: 1, hourlyRate: 100 },
                { id: 'flat', title: 'Flat', hours: 0, flatRate: 100 }
            ],
            taskFlatRates: { flat: 100 },
            totalAmount: 200,
            currency: 'USD'
        })

        expect(html).toContain('—')
    })

    it('uses task flat rates and merged subtask hours in simplified table', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{
                id: 'task',
                title: 'Flat Merged',
                hours: 0,
                isMerged: true,
                mergedSubtasks: [{ id: 'sub', title: 'Sub', hours: 2 }]
            }],
            taskFlatRates: { task: 150 },
            totalAmount: 150,
            currency: 'USD'
        })

        expect(html).toContain('Flat Merged')
        expect(html).toContain('$150.00')
    })

    it('handles additional hourly tasks in simplified table', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            additionalTasks: [{ title: 'Extra', hours: 0, hourlyRate: 100, useFlatRate: false }],
            totalAmount: 0,
            currency: 'USD'
        })

        expect(html).toContain('Extra')
    })

    it('shows dashes for flat additional tasks without tracked hours in hourly table', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'hourly', title: 'Hourly', hours: 1, hourlyRate: 100 }],
            additionalTasks: [{ title: 'Extra Flat', flatRate: 50, useFlatRate: true }],
            totalAmount: 150,
            currency: 'USD'
        })

        expect(html).toContain('Extra Flat')
        expect(html).toContain('—')
    })

    it('shows both rate and quantity columns for mixed invoices', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [
                { id: 'hourly', title: 'Hourly', hours: 1, hourlyRate: 100 },
                { id: 'flat', title: 'Flat', flatRate: 50, quantity: 3, useFlatRate: true }
            ],
            totalAmount: 250,
            currency: 'USD'
        })

        expect(html).toContain('Rate</th>')
        expect(html).toContain('Qty</th>')
    })

    it('includes expense items as flat rate additions', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            expenseItems: [{ id: 'exp-1', title: 'Hosting', supplierName: 'AWS', amount: 25 }],
            totalAmount: 25,
            currency: 'USD'
        })

        expect(html).toContain('Hosting • AWS')
        expect(html).toContain('$25.00')
    })

    it('prefers explicit total and omits the supplier separator when an expense has no supplier', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            expenseItems: [{ id: 'exp-1', title: 'Hosting', amount: 25 }],
            totalAmount: 10,
            total: 25,
            currency: 'USD'
        })

        expect(html).toContain('Hosting')
        expect(html).not.toContain('Hosting •')
        expect(html).toContain('Total: $25.00')
    })

    it('renders flat additional tasks in simplified table', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [],
            additionalTasks: [{ title: 'Flat Extra', flatRate: 30, quantity: 2, useFlatRate: true }],
            totalAmount: 60,
            currency: 'USD'
        })

        expect(html).toContain('Flat Extra')
        expect(html).toContain('$60.00')
    })

    it('uses taskHourlyRates in simplified table when hourlyRate missing', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            project: { hourlyRate: 0 },
            tasks: [{ id: 't-rate', title: 'Rate Task', hours: 2 }],
            taskHourlyRates: { 't-rate': 75 },
            totalAmount: 150,
            currency: 'USD'
        })

        expect(html).toContain('Rate Task')
        expect(html).toContain('$150.00')
    })

    it('treats flatRate as implicit flat task when useFlatRate is undefined', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 't-flat', title: 'Implicit Flat', flatRate: 40, quantity: 2 }],
            totalAmount: 80,
            currency: 'USD'
        })

        expect(html).toContain('Implicit Flat')
        expect(html).toContain('$80.00')
    })

    it('renders simplified table branch when forcing no task types', () => {

        const someSpy = vi.spyOn(Array.prototype, 'some').mockReturnValue(false)

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 't1', title: 'Forced Task', hours: 2, hourlyRate: 50, flatRate: 0 }],
            additionalTasks: [{ title: 'Forced Extra', hours: 1, hourlyRate: 25 }],
            totalAmount: 125,
            currency: 'USD'
        })

        someSpy.mockRestore()

        expect(html).toContain('Description')
        expect(html).toContain('Total')
        expect(html).toContain('Forced Task')
        expect(html).toContain('Forced Extra')
    })

    it('uses project hourly rate for additional hourly tasks', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            project: { hourlyRate: 60 },
            tasks: [{ id: 't1', title: 'Hourly', hours: 1, hourlyRate: 60 }],
            additionalTasks: [{ title: 'Extra Hourly', hours: 2 }],
            totalAmount: 180,
            currency: 'USD'
        })

        expect(html).toContain('Extra Hourly')
        expect(html).toContain('$120.00')
    })

    it('calculates merged hourly totals in simplified table', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            project: { hourlyRate: 120 },
            tasks: [{
                id: 'parent',
                title: 'Merged Hourly',
                hours: 0,
                hourlyRate: 120,
                isMerged: true,
                mergedSubtasks: [{ id: 'child', title: 'Child', hours: 1, hourlyRate: 100 }]
            }],
            totalAmount: 100,
            currency: 'USD'
        })

        expect(html).toContain('Merged Hourly')
        expect(html).toContain('1.00')
        expect(html).toContain('$100.00')
    })

    it('matches PDF totals with pricing totals', () => {

        const { result } = renderHook(() => useInvoicePricing({
            invoiceTasks: [{ id: 'task-1', hours: 2.25, hourlyRate: 80 }],
            additionalTasks: [{ title: 'Flat Task', flatRate: 50, quantity: 2, useFlatRate: true }],
            editableHours: {},
            discountType: 'percentage',
            discountValue: 10,
            shippingAmount: 15,
            taxOverride: { enabled: true, rate: 5, label: 'Tax' },
            taskFlatRates: {},
            useFlatRate: {},
            taskHourlyRates: {},
            taskQuantities: {},
            selectedTasksForBilling: { 'task-1': true },
            mergedSubtasks: {},
            selectedBusinessInfo: null,
            selectedClient: null,
            selectedProject: null
        }))

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            tasks: [{ id: 'task-1', title: 'Hourly', hours: 2.25, hourlyRate: 80 }],
            additionalTasks: [{ title: 'Flat Task', flatRate: 50, quantity: 2, useFlatRate: true }],
            subtotal: result.current.subtotal,
            discount: result.current.discount,
            shipping: result.current.shipping,
            tax: result.current.tax,
            taxRate: result.current.taxRate,
            taxLabel: result.current.taxLabel,
            totalAmount: result.current.total,
            currency: 'USD'
        })

        expect(html).toContain(`Total: $${result.current.total.toFixed(2)}`)
    })

    it('shows grouped document total hours only when all grouped sections are hourly', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            projectBreakdowns: [
                {
                    projectId: 'project-1',
                    projectTitle: 'Discovery',
                    clientId: 'client-1',
                    pricingMode: 'hourly',
                    totalHours: 3,
                    subtotal: 300,
                    tasks: [
                        { id: 'task-1', title: 'Workshop', hours: 1, hourlyRate: 100 },
                        { id: 'task-2', title: 'Follow-up', hours: 2, hourlyRate: 100 }
                    ],
                    expenseItems: [],
                },
                {
                    projectId: 'project-2',
                    projectTitle: 'Implementation',
                    clientId: 'client-1',
                    pricingMode: 'hourly',
                    subtotal: 300,
                    tasks: [{ id: 'task-2', title: 'Build', hours: 2, projectHourlyRate: 150 }],
                    expenseItems: [],
                },
            ],
            totalHours: 5,
            totalAmount: 600,
            subtotal: 600,
            currency: 'USD'
        })

        expect(html).toContain('Discovery')
        expect(html).toContain('Implementation')
        expect(html).toContain('Workshop')
        expect(html).toContain('Build')
        expect((html.match(/Project total hours:/g) || []).length).toBe(1)
        expect(html).toContain('Project total hours: <strong>3.00</strong>')
        expect(html).toContain('Total hours: <strong>5.00</strong>')
        expect(html).toContain('Subtotal: <strong>$600.00</strong>')
    })

    it('renders grouped additional items and invoice-only expenses as separate sections', () => {

        const html = createInvoiceHTML({
            client: { name: 'Client' },
            projectBreakdowns: [{
                projectId: 'project-1',
                projectTitle: 'Main Project',
                clientId: 'client-1',
                pricingMode: 'hourly',
                totalHours: 2,
                subtotal: 200,
                tasks: [{ id: 'task-1', title: 'Core work', hours: 2, hourlyRate: 100 }],
                expenseItems: [],
            }],
            additionalTasks: [
                { title: 'Extra hourly', hours: 1.5, hourlyRate: 80, useFlatRate: false },
                { title: 'Extra flat', flatRate: 120, quantity: 2, useFlatRate: true }
            ],
            invoiceOnlyExpenseItems: [{ id: 'expense-1', title: 'Permit', amount: 30 }],
            totalHours: 3.5,
            totalAmount: 590,
            subtotal: 590,
            currency: 'USD'
        })

        expect(html).toContain('Additional Items')
        expect(html).toContain('Invoice-only Expenses')
        expect(html).toContain('Extra hourly')
        expect(html).toContain('Extra flat')
        expect(html).toContain('Permit')
        expect(html).toContain('Project total hours: <strong>2.00</strong>')
        expect(html).toContain('Project subtotal: <strong>$200.00</strong>')
        expect(html).toContain('Additional items subtotal: <strong>$360.00</strong>')
        expect(html).toContain('Invoice-only expenses subtotal: <strong>$30.00</strong>')
        expect(html).toContain('Qty</th>')
        expect(html).toContain('Hours</th>')
        expect(html).not.toContain('Total hours: <strong>3.50</strong>')
    })

    it('rebuilds stored invoice html with a branding snapshot logo asset', () => {

        const html = buildInvoiceHtmlContent({
            invoiceNumber: 'INV-0201',
            client: { name: 'Client' },
            tasks: [],
            totalAmount: 0,
            currency: 'USD',
            brandingSnapshot: {
                showBusinessLogo: true,
                logoAssetId: 'logo-1',
            }
        }, [], [{
            id: 'logo-1',
            dataUrl: 'data:image/png;base64,LOGO',
        }])

        expect(html).toContain('data:image/png;base64,LOGO')
    })

    it('ignores archived stored logo assets and falls back to an empty client shell when needed', () => {

        const html = buildInvoiceHtmlContent({
            invoiceNumber: 'INV-0202',
            tasks: [],
            totalAmount: 0,
            currency: 'USD',
            businessInfo: {
                branding: {
                    logoAssetId: 'logo-archived',
                }
            }
        }, [], [
            {
                id: 'other-logo',
                dataUrl: 'data:image/png;base64,OTHER',
            },
            {
                id: 'logo-archived',
                dataUrl: 'data:image/png;base64,ARCHIVED',
                archivedAt: '2026-05-01T00:00:00.000Z',
            }
        ])

        expect(html).not.toContain('data:image/png;base64,ARCHIVED')
        expect(html).toContain('Invoice To:')
    })
})

describe('generatePDF', () => {

    it('rejects when html content is missing', async () => {

        await expect(generatePDF('')).rejects.toThrow('No HTML content provided')
    })

    it('resolves when pdf generation succeeds', async () => {

        await expect(generatePDF('<p>Invoice</p>', 'invoice.pdf')).resolves.toBeUndefined()

        expect(html2pdfMocks.html2pdf).toHaveBeenCalled()
        expect(html2pdfMocks.set).toHaveBeenCalled()
        const pdfOptions = html2pdfMocks.set.mock.calls[0][0]
        expect(pdfOptions).toEqual(expect.objectContaining({
            jsPDF: expect.objectContaining({
                unit: 'mm',
                orientation: 'portrait'
            })
        }))
        expect(Array.isArray(pdfOptions.margin)).toBe(true)
        expect(pdfOptions.margin).toHaveLength(4)
        expect(pdfOptions.pagebreak?.avoid).toContain('.invoice-project-section')
        expect(html2pdfMocks.from).toHaveBeenCalledWith('<p>Invoice</p>')
        expect(html2pdfMocks.save).toHaveBeenCalled()
    })

    it('allows caller options to override default pdf settings', async () => {

        await expect(generatePDF('<p>Invoice</p>', 'custom.pdf', {
            image: { type: 'png', quality: 1 },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'landscape' }
        })).resolves.toBeUndefined()

        expect(html2pdfMocks.set).toHaveBeenCalledWith(expect.objectContaining({
            filename: 'custom.pdf',
            image: { type: 'png', quality: 1 },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'landscape' }
        }))
    })

    it('rejects when pdf generation fails', async () => {

        const error = new Error('Save failed')
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        html2pdfMocks.save.mockRejectedValueOnce(error)

        await expect(generatePDF('<p>Invoice</p>')).rejects.toThrow('Save failed')

        expect(errorSpy).toHaveBeenCalled()

        errorSpy.mockRestore()
    })

    it('rejects when html2pdf throws synchronously', async () => {

        const error = new Error('Boom')
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        html2pdfMocks.html2pdf.mockImplementationOnce(() => {
            throw error
        })

        await expect(generatePDF('<p>Invoice</p>')).rejects.toThrow('Boom')

        expect(errorSpy).toHaveBeenCalled()

        errorSpy.mockRestore()
    })
})

describe('generatePDFBase64', () => {

    it('returns a base64 string from HTML content', async () => {

        const result = await generatePDFBase64('<p>Test Invoice</p>')

        expect(typeof result).toBe('string')
        // The result should be a valid base64 string (no data URL prefix)
        expect(result).not.toContain('data:')
        expect(result.length).toBeGreaterThan(0)

        expect(html2pdfMocks.outputPdf).toHaveBeenCalledWith('blob')
    })

    it('rejects when no HTML content provided', async () => {

        await expect(generatePDFBase64('')).rejects.toThrow('No HTML content provided')
    })

    it('rejects when html2pdf fails', async () => {

        html2pdfMocks.outputPdf.mockRejectedValueOnce(new Error('PDF generation failed'))

        await expect(generatePDFBase64('<p>Invoice</p>')).rejects.toThrow('PDF generation failed')
    })

    it('passes sanitized HTML to html2pdf', async () => {

        await generatePDFBase64('<p>Hello</p><script>alert("xss")</script>')

        expect(html2pdfMocks.from).toHaveBeenCalledOnce()
        const passedHtml = html2pdfMocks.from.mock.calls[0][0]
        expect(passedHtml).not.toContain('<script>')
        expect(passedHtml).toContain('<p>Hello</p>')
    })
})

describe('generatePDFBlob', () => {

    it('returns a pdf blob from HTML content', async () => {

        const blob = await generatePDFBlob('<p>Blob Invoice</p>')

        expect(blob).toBeInstanceOf(Blob)
        expect(html2pdfMocks.outputPdf).toHaveBeenCalledWith('blob')
    })

    it('rejects when no HTML content is provided', async () => {

        await expect(generatePDFBlob('')).rejects.toThrow('No HTML content provided')
    })
})
