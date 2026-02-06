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
        projects: [],
        updateProject: vi.fn(),
        deleteProject: vi.fn()
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
        invoices: [],
        deleteInvoice: vi.fn()
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
        expensesHookMocks.deleteExpense.mockClear()
        recurrencesHookMocks.deleteRecurrence.mockClear()

        clientsHookMocks.clients = [
            { id: 'client-1', title: 'Client One', createdAt: Date.now() }
        ]

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
})
