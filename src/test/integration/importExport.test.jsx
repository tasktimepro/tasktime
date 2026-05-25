import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportImport from '../../components/ExportImport'
import { BACKUP_VERSION } from '../../utils/backupData'

// Mock useTimers hook
const mockTimers = [];
const mockExpenses = [];
const mockExportBackupData = vi.fn();
const mockExpenseCategories = [];
const mockTaxReturnPeriods = [];

vi.mock('../../hooks/useTimers.ts', () => ({
    useTimers: () => ({ timers: mockTimers })
}));

vi.mock('../../hooks/useExpenses.ts', () => ({
    useExpenses: () => ({ expenses: mockExpenses })
}));

vi.mock('../../contexts/YjsContext.tsx', () => ({
    useYjs: () => ({
        store: {
            exportBackupData: mockExportBackupData,
        },
    }),
}));

vi.mock('../../hooks/useToast.ts', () => ({
    useToast: () => ({
        showError: vi.fn(),
    }),
}));

describe('Import/Export integration', () => {

    const baseProps = {
        projects: [{ id: 'project-1', title: 'Project One' }],
        tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Task' }],
        timeEntries: [{ id: 'entry-1', taskId: 'task-1', start: 0, end: 1000 }],
        invoices: [],
        paymentMethods: [],
        expenseCategories: [],
        taxReturnPeriods: [],
        businessInfos: [],
        clients: [],
        invoiceTemplates: [],
        emailTemplates: [],
        preferences: { currency: 'EUR' }
    }

    beforeEach(() => {

        mockTimers.length = 0
        mockExpenses.length = 0
        mockExpenseCategories.length = 0
        mockTaxReturnPeriods.length = 0
        mockExportBackupData.mockResolvedValue({
            version: BACKUP_VERSION,
            exportDate: '2026-04-22T12:14:07.792Z',
            backupType: 'manual',
            projects: baseProps.projects,
            tasks: baseProps.tasks,
            timeEntries: baseProps.timeEntries,
            invoices: baseProps.invoices,
            paymentMethods: baseProps.paymentMethods,
            expenseCategories: mockExpenseCategories,
            taxReturnPeriods: mockTaxReturnPeriods,
            businessInfos: baseProps.businessInfos,
            clients: baseProps.clients,
            invoiceTemplates: baseProps.invoiceTemplates,
            emailTemplates: baseProps.emailTemplates,
            expenses: mockExpenses,
            expenseRecurrences: [],
            dailyGoals: [],
            plannerAttachments: [],
            preferences: baseProps.preferences,
        })
    })

    const setupExportMocks = () => {
        const originalCreateElement = document.createElement.bind(document)
        const createElementSpy = vi.spyOn(document, 'createElement')
        let lastLink = null

        createElementSpy.mockImplementation((tag) => {
            const element = originalCreateElement(tag)
            if (tag === 'a') {
                lastLink = element
                vi.spyOn(element, 'click').mockImplementation(() => {})
            }
            return element
        })

        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

        return { createElementSpy, createObjectURLSpy, revokeObjectURLSpy, getLastLink: () => lastLink }
    }

    afterEach(() => {

        vi.restoreAllMocks()
    })

    it('exports JSON data', async () => {

        const user = userEvent.setup()
        const { createObjectURLSpy, revokeObjectURLSpy, getLastLink } = setupExportMocks()

        render(
            <ExportImport
                {...baseProps}
                onImport={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Export' }))

        expect(mockExportBackupData).toHaveBeenCalledWith({
            backupType: 'manual',
            refreshFromCloud: true,
        })
        expect(createObjectURLSpy).toHaveBeenCalled()

        const link = getLastLink()
        expect(link).not.toBeNull()
        expect(link.click).toHaveBeenCalled()
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock')
    })

    it('exports all collections', async () => {

        const user = userEvent.setup()
        const { createObjectURLSpy } = setupExportMocks()
        const originalBlob = global.Blob
        let capturedPayload = null

        const blobSpy = vi.spyOn(global, 'Blob').mockImplementation(function (parts, options) {
            capturedPayload = parts?.[0] ?? null
            return new originalBlob(parts, options)
        })

        render(
            <ExportImport
                {...baseProps}
                onImport={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Export' }))

        expect(createObjectURLSpy).toHaveBeenCalled()
        expect(capturedPayload).not.toBeNull()

        const parsed = JSON.parse(capturedPayload)
        expect(parsed.projects).toEqual(baseProps.projects)
        expect(parsed.tasks).toEqual(baseProps.tasks)
        expect(parsed.timeEntries).toEqual(baseProps.timeEntries)
        expect(parsed.invoices).toEqual(baseProps.invoices)
        expect(parsed.paymentMethods).toEqual(baseProps.paymentMethods)
        expect(parsed.expenseCategories).toEqual(mockExpenseCategories)
        expect(parsed.taxReturnPeriods).toEqual(mockTaxReturnPeriods)
        expect(parsed.businessInfos).toEqual(baseProps.businessInfos)
        expect(parsed.clients).toEqual(baseProps.clients)
        expect(parsed.invoiceTemplates).toEqual(baseProps.invoiceTemplates)
        expect(parsed.emailTemplates).toEqual(baseProps.emailTemplates)
        expect(parsed.preferences).toEqual(baseProps.preferences)

        blobSpy.mockRestore()
    })

    it('imports valid JSON and calls onImport', async () => {

        const user = userEvent.setup()
        const onImport = vi.fn()

        render(
            <ExportImport
                {...baseProps}
                onImport={onImport}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Import' }))

        const payload = {
            version: BACKUP_VERSION,
            projects: [{ id: 'project-1', title: 'Imported' }],
            tasks: [],
            timeEntries: [],
            invoices: [],
            paymentMethods: [],
            expenseCategories: [{ id: 'category-1', name: 'Travel' }],
            taxReturnPeriods: [{ id: 'period-1', title: 'Q1 2026', startDate: '2026-01-01', endDate: '2026-03-31' }],
            businessInfos: [],
            clients: [],
            invoiceTemplates: [],
            emailTemplates: [],
            preferences: { currency: 'USD' }
        }

        fireEvent.change(screen.getByLabelText('Or paste JSON data'), {
            target: { value: JSON.stringify(payload) }
        })
        await user.click(screen.getByRole('button', { name: 'Import Data' }))

        expect(onImport).toHaveBeenCalledWith({
            projects: payload.projects,
            tasks: [],
            timeEntries: [],
            invoices: [],
            paymentMethods: [],
            expenseCategories: payload.expenseCategories,
            taxReturnPeriods: payload.taxReturnPeriods,
            businessInfos: [],
            clients: [],
            invoiceTemplates: [],
            emailTemplates: [],
            expenses: [],
            expenseRecurrences: [],
            dailyGoals: [],
            plannerAttachments: [],
            preferences: payload.preferences
        })
        expect(screen.queryByRole('dialog', { name: 'Import Data' })).not.toBeInTheDocument()
    })

    it('shows error for invalid JSON', async () => {

        const user = userEvent.setup()

        render(
            <ExportImport
                {...baseProps}
                onImport={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Import' }))
        fireEvent.change(screen.getByLabelText('Or paste JSON data'), {
            target: { value: '{invalid' }
        })
        await user.click(screen.getByRole('button', { name: 'Import Data' }))

        expect(screen.getByText(/invalid/i)).toBeInTheDocument()
    })

    it('shows active timer warning when timer is active', async () => {

        const user = userEvent.setup()
        
        // Set timer as active
        mockTimers.push({ projectId: 'project-1', taskId: 'task-1' })

        render(
            <ExportImport
                {...baseProps}
                onImport={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Import' }))

        expect(screen.getByText('Active Timer Detected!')).toBeInTheDocument()
        
        // Reset for other tests
        mockTimers.length = 0
    })

    it('shows expenses in the current data summary', () => {

        mockExpenses.push({ id: 'expense-1', title: 'Lunch', amount: 12 })

        render(
            <ExportImport
                {...baseProps}
                projects={[]}
                tasks={[]}
                timeEntries={[]}
                expenses={[]}
                onImport={vi.fn()}
            />
        )

        expect(screen.getByText('Current Data')).toBeInTheDocument()
        expect(screen.getByText('Expenses:')).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('includes archived expenses in the current data summary and export payload', async () => {

        const user = userEvent.setup()
        const { createObjectURLSpy } = setupExportMocks()
        const originalBlob = global.Blob
        let capturedPayload = null

        mockExpenses.push(
            { id: 'expense-1', title: 'Lunch', amount: 12 },
            { id: 'expense-2', title: 'Archive fee', amount: 25 }
        )

        const blobSpy = vi.spyOn(global, 'Blob').mockImplementation(function (parts, options) {
            capturedPayload = parts?.[0] ?? null
            return new originalBlob(parts, options)
        })

        render(
            <ExportImport
                {...baseProps}
                projects={[]}
                tasks={[]}
                timeEntries={[]}
                expenses={[]}
                onImport={vi.fn()}
            />
        )

        expect(screen.getByText('Expenses:')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Export' }))

        expect(createObjectURLSpy).toHaveBeenCalled()

        const parsed = JSON.parse(capturedPayload)
        expect(parsed.expenses).toEqual([
            { id: 'expense-1', title: 'Lunch', amount: 12 },
            { id: 'expense-2', title: 'Archive fee', amount: 25 }
        ])

        blobSpy.mockRestore()
    })
})
