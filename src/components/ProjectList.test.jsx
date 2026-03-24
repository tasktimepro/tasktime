import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectList from './ProjectList'

const toastMocks = vi.hoisted(() => ({

    showSuccess: vi.fn()
}))

const projectsHookMocks = vi.hoisted(() => ({

    deleteProject: vi.fn(),
    updateProject: vi.fn(),
    projects: []
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

vi.mock('../hooks/useProjects.ts', () => ({

    useProjects: () => ({
        projects: projectsHookMocks.projects,
        updateProject: projectsHookMocks.updateProject,
        deleteProject: projectsHookMocks.deleteProject
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

vi.mock('../hooks/useTimers.ts', () => ({

    useTimers: () => ({
        timers: [],
        clearTimer: vi.fn()
    })
}))

vi.mock('../hooks/usePreferences.ts', () => ({

    usePreferences: () => ({
        preferences: { projectSort: 'createdAt' },
        updatePreferences: vi.fn()
    })
}))

describe('ProjectList', () => {

    beforeEach(() => {
        projectsHookMocks.deleteProject.mockClear()
        expensesHookMocks.deleteExpense.mockClear()
        recurrencesHookMocks.deleteRecurrence.mockClear()

        projectsHookMocks.projects = [
            { id: 'project-1', title: 'Project One', createdAt: Date.now(), archived: false }
        ]

        expensesHookMocks.expenses = [
            { id: 'expense-1', projectId: 'project-1', clientId: null }
        ]

        recurrencesHookMocks.recurrences = [
            { id: 'recurrence-1', projectId: 'project-1', clientId: null }
        ]

        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('deletes related expenses and recurrences when deleting a project', async () => {
        const user = userEvent.setup()

        render(
            <ProjectList
                onSelectProject={vi.fn()}
                clients={[]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        await user.click(screen.getByTitle('More actions'))
        await user.click(screen.getByText('Delete'))
        await user.click(screen.getByText('Delete Project'))

        expect(expensesHookMocks.deleteExpense).toHaveBeenCalledWith('expense-1')
        expect(recurrencesHookMocks.deleteRecurrence).toHaveBeenCalledWith('recurrence-1')
        expect(projectsHookMocks.deleteProject).toHaveBeenCalledWith('project-1')
    })

    it('shows client context and opens the project on card click', () => {
        const onSelectProject = vi.fn()

        projectsHookMocks.projects = [
            {
                id: 'project-1',
                title: 'Project One',
                createdAt: Date.now(),
                archived: false,
                preferredClientId: 'client-1',
            }
        ]

        render(
            <ProjectList
                onSelectProject={onSelectProject}
                clients={[{ id: 'client-1', title: 'Acme Co' }]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        expect(screen.getByText('Client:')).toBeInTheDocument()
        expect(screen.getByText('Acme Co')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Project One'))

        expect(onSelectProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'project-1' }))
    })
})
