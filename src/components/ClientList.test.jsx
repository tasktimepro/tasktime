import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClientList from './ClientList'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn()
}))

const clientsHookMocks = vi.hoisted(() => ({

    deleteClient: vi.fn(),
    updateClient: vi.fn(),
    clients: []
}))

const projectHookMocks = vi.hoisted(() => ({

    deleteProject: vi.fn(),
    updateProject: vi.fn(),
    projects: []
}))

const invoiceHookMocks = vi.hoisted(() => ({

    deleteInvoice: vi.fn(),
    invoices: []
}))

const expensesHookMocks = vi.hoisted(() => ({

    deleteExpense: vi.fn(),
    unbillExpensesForInvoice: vi.fn(),
    expenses: []
}))

const recurrencesHookMocks = vi.hoisted(() => ({

    deleteRecurrence: vi.fn(),
    recurrences: []
}))

vi.mock('../hooks/useToast.ts', () => ({

    useToast: () => ({
        showSuccess: toastMocks.showSuccess
    })
}))

vi.mock('../contexts/YjsContext', () => ({

    useYjs: () => ({
        store: {
            projects: { doc: { transact: (cb) => cb() } },
            activeEntriesDoc: { transact: (cb) => cb() }
        }
    })
}))

vi.mock('../hooks/useClients.ts', () => ({

    useClients: () => ({
        clients: clientsHookMocks.clients,
        updateClient: clientsHookMocks.updateClient,
        deleteClient: clientsHookMocks.deleteClient
    })
}))

vi.mock('../hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: projectHookMocks.projects,
        updateProject: projectHookMocks.updateProject,
        deleteProject: projectHookMocks.deleteProject
    })
}))

vi.mock('../hooks/useTasks.ts', () => ({

    useTasks: () => ({
        tasks: [],
        deleteTask: vi.fn()
    })
}))

vi.mock('../hooks/useTimeEntries.ts', () => ({

    useTimeEntries: () => ({
        entries: [],
        deleteEntry: vi.fn()
    })
}))

vi.mock('../hooks/useInvoices.ts', () => ({

    useInvoices: () => ({
        invoices: invoiceHookMocks.invoices,
        deleteInvoice: invoiceHookMocks.deleteInvoice
    })
}))

vi.mock('../hooks/useExpenses.ts', () => ({

    useExpenses: () => ({
        expenses: expensesHookMocks.expenses,
        deleteExpense: expensesHookMocks.deleteExpense,
        unbillExpensesForInvoice: expensesHookMocks.unbillExpensesForInvoice
    })
}))

vi.mock('../hooks/useExpenseRecurrences.ts', () => ({

    useExpenseRecurrences: () => ({
        recurrences: recurrencesHookMocks.recurrences,
        deleteRecurrence: recurrencesHookMocks.deleteRecurrence
    })
}))

vi.mock('../hooks/usePreferences.ts', () => ({

    usePreferences: () => ({
        preferences: { clientSort: 'createdAt' },
        updatePreferences: vi.fn()
    })
}))

describe('ClientList', () => {

    beforeEach(() => {
        clientsHookMocks.deleteClient.mockClear()
        projectHookMocks.deleteProject.mockClear()
        projectHookMocks.updateProject.mockClear()
        invoiceHookMocks.deleteInvoice.mockClear()
        expensesHookMocks.deleteExpense.mockClear()
        expensesHookMocks.unbillExpensesForInvoice.mockClear()
        recurrencesHookMocks.deleteRecurrence.mockClear()

        clientsHookMocks.clients = [
            { id: 'client-1', title: 'Client One', createdAt: Date.now() }
        ]

        projectHookMocks.projects = []
        invoiceHookMocks.invoices = []

        expensesHookMocks.expenses = [
            { id: 'expense-1', clientId: 'client-1', projectId: null }
        ]

        recurrencesHookMocks.recurrences = [
            { id: 'recurrence-1', clientId: 'client-1', projectId: null }
        ]
    })

    it('deletes related expenses and recurrences when deleting a client', async () => {
        const user = userEvent.setup()

        render(
            <ClientList
                onSelectClient={vi.fn()}
                openClientModal={vi.fn()}
                editClientModal={vi.fn()}
            />
        )

        await user.click(screen.getByLabelText('More actions'))
        await user.click(screen.getByText('Delete'))

        expect(expensesHookMocks.deleteExpense).toHaveBeenCalledWith('expense-1')
        expect(recurrencesHookMocks.deleteRecurrence).toHaveBeenCalledWith('recurrence-1')
        expect(clientsHookMocks.deleteClient).toHaveBeenCalledWith('client-1')
    })

    it('keeps the header actions inline with flexible wrapping instead of forcing a mobile stack', () => {
        render(
            <ClientList
                onSelectClient={vi.fn()}
                openClientModal={vi.fn()}
                editClientModal={vi.fn()}
            />
        )

        const header = screen.getByText(/Clients/).parentElement
        const actions = screen.getByRole('button', { name: 'New Client' }).parentElement

        expect(header?.className).toContain('flex-wrap')
        expect(header?.className).toContain('items-center')
        expect(header?.className).not.toContain('flex-col')
        expect(actions?.className).toContain('ml-auto')
        expect(actions?.className).toContain('flex-wrap')
    })

    it('renders archived client menu triggers with the same styling as active client cards', async () => {
        const user = userEvent.setup()

        clientsHookMocks.clients = [
            { id: 'client-1', title: 'Active Client', createdAt: Date.now(), archived: false },
            { id: 'client-2', title: 'Archived Client', createdAt: Date.now(), archived: true },
        ]

        render(
            <ClientList
                onSelectClient={vi.fn()}
                openClientModal={vi.fn()}
                editClientModal={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: /Archived Clients/i }))

        const menuButtons = screen.getAllByRole('button', { name: 'More actions' })

        expect(menuButtons).toHaveLength(2)
        expect(menuButtons[0].className).toBe(menuButtons[1].className)
    })

    it('deletes both project-linked and client-only invoices when deleting a client with projects', async () => {
        const user = userEvent.setup()

        projectHookMocks.projects = [
            { id: 'project-1', title: 'Project One', preferredClientId: 'client-1' }
        ]
        invoiceHookMocks.invoices = [
            { id: 'invoice-project', clientId: 'client-1', projectIds: ['project-1'] },
            { id: 'invoice-client-only', clientId: 'client-1', projectId: null },
            { id: 'invoice-other', clientId: 'client-2', projectId: null },
        ]

        render(
            <ClientList
                onSelectClient={vi.fn()}
                openClientModal={vi.fn()}
                editClientModal={vi.fn()}
            />
        )

        await user.click(screen.getByLabelText('More actions'))
        await user.click(screen.getByText('Delete'))
        await user.click(screen.getByText('Delete Client & All Projects'))

        expect(expensesHookMocks.unbillExpensesForInvoice).toHaveBeenCalledWith('invoice-project')
        expect(expensesHookMocks.unbillExpensesForInvoice).toHaveBeenCalledWith('invoice-client-only')
        expect(invoiceHookMocks.deleteInvoice).toHaveBeenCalledWith('invoice-project')
        expect(invoiceHookMocks.deleteInvoice).toHaveBeenCalledWith('invoice-client-only')
        expect(invoiceHookMocks.deleteInvoice).not.toHaveBeenCalledWith('invoice-other')
    })

})
