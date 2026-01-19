import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useInvoicePricing from '../components/invoice/hooks/useInvoicePricing'
import { createInvoiceHTML, generatePDF } from './pdfUtils'

const html2pdfMocks = vi.hoisted(() => {

    return {
        html2pdf: vi.fn(),
        set: vi.fn(),
        from: vi.fn(),
        save: vi.fn()
    }
})

vi.mock('html2pdf.js', () => ({

    default: html2pdfMocks.html2pdf
}))

beforeEach(() => {

    vi.clearAllMocks()

    html2pdfMocks.save.mockResolvedValue(undefined)
    html2pdfMocks.from.mockReturnValue({ save: html2pdfMocks.save })
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
            currency: 'USD'
        })

        expect(html).toContain('Invoice To:')
        expect(html).toContain('Invoice From:')
        expect(html).toContain('Payment Details:')
        expect(html).toContain('Thanks for your business')
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

        expect(html).toContain('Flat Merged (2.00h)')
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

        expect(html).toContain('Merged Hourly (1.00h)')
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
})

describe('generatePDF', () => {

    it('rejects when html content is missing', async () => {

        await expect(generatePDF('')).rejects.toThrow('No HTML content provided')
    })

    it('resolves when pdf generation succeeds', async () => {

        await expect(generatePDF('<p>Invoice</p>', 'invoice.pdf')).resolves.toBeUndefined()

        expect(html2pdfMocks.html2pdf).toHaveBeenCalled()
        expect(html2pdfMocks.set).toHaveBeenCalled()
        expect(html2pdfMocks.from).toHaveBeenCalledWith('<p>Invoice</p>')
        expect(html2pdfMocks.save).toHaveBeenCalled()
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
