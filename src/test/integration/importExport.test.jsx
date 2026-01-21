import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportImport from '../../components/ExportImport'

// Mock useTimer hook
const mockTimerState = { isActive: false };
vi.mock('../../hooks/useTimer.ts', () => ({
    useTimer: () => mockTimerState
}));

describe('Import/Export integration', () => {

    const baseProps = {
        projects: [{ id: 'project-1', title: 'Project One' }],
        tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Task' }],
        timeEntries: [{ id: 'entry-1', taskId: 'task-1', start: 0, end: 1000 }],
        invoices: [],
        paymentMethods: [],
        businessInfos: [],
        clients: [],
        invoiceTemplates: [],
        preferences: { currency: 'EUR' }
    }

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
        expect(parsed.businessInfos).toEqual(baseProps.businessInfos)
        expect(parsed.clients).toEqual(baseProps.clients)
        expect(parsed.invoiceTemplates).toEqual(baseProps.invoiceTemplates)
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
            projects: [{ id: 'project-1', title: 'Imported' }],
            tasks: [],
            timeEntries: [],
            invoices: [],
            paymentMethods: [],
            businessInfos: [],
            clients: [],
            invoiceTemplates: [],
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
            businessInfos: [],
            clients: [],
            invoiceTemplates: [],
            preferences: payload.preferences
        })
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
        mockTimerState.isActive = true;

        render(
            <ExportImport
                {...baseProps}
                onImport={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Import' }))

        expect(screen.getByText('Active Timer Detected!')).toBeInTheDocument()
        
        // Reset for other tests
        mockTimerState.isActive = false;
    })
})
