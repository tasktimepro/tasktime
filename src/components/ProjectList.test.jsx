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

    it('opens the client from its project-card link without opening the project', async () => {
        const user = userEvent.setup()
        const onSelectProject = vi.fn()
        const navigateToClient = vi.fn()

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
                navigateToClient={navigateToClient}
            />
        )

        expect(screen.getByText('Client:')).toBeInTheDocument()
        const clientLink = screen.getByRole('button', { name: 'Open client Acme Co' })

        expect(clientLink).toHaveClass('cursor-pointer', 'hover:underline')

        await user.click(clientLink)

        expect(navigateToClient).toHaveBeenCalledWith('client-1')
        expect(onSelectProject).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText('Project One'))

        expect(onSelectProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'project-1' }))
    })

    it('wraps long project titles instead of truncating them', () => {
        const longTitle = 'New AI with a very very long title here that will not fit on one line'

        projectsHookMocks.projects = [
            { id: 'project-1', title: longTitle, createdAt: Date.now(), archived: false }
        ]

        render(
            <ProjectList
                onSelectProject={vi.fn()}
                clients={[]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        const title = screen.getByRole('heading', { name: longTitle })
        const menuButton = screen.getByRole('button', { name: 'More actions' })

        expect(title.className).toContain('whitespace-normal')
        expect(title.className).toContain('break-words')
        expect(title.className).toContain('[overflow-wrap:anywhere]')
        expect(title.className).not.toContain('truncate')
        expect(menuButton.className).toContain('shrink-0')
    })

    it('keeps the header actions inline with flexible wrapping instead of forcing a mobile stack', () => {
        render(
            <ProjectList
                onSelectProject={vi.fn()}
                clients={[]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        const header = screen.getByText(/Projects/).parentElement
        const actions = screen.getByRole('button', { name: 'New Project' }).parentElement

        expect(header?.className).toContain('flex-wrap')
        expect(header?.className).toContain('items-center')
        expect(header?.className).not.toContain('flex-col')
        expect(actions?.className).toContain('ml-auto')
        expect(actions?.className).toContain('flex-wrap')
    })

    it('identifies the page with one project icon and matches the client-card grid gap', () => {
        render(
            <ProjectList
                onSelectProject={vi.fn()}
                clients={[]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        const pageHeading = screen.getByRole('heading', { name: 'Projects (1)' })
        const projectHeading = screen.getByRole('heading', { name: 'Project One' })
        const projectsGrid = projectHeading.closest('.grid')
        const count = pageHeading.querySelector('span')

        expect(pageHeading.querySelector('svg')).toHaveClass('lucide-folder-closed', 'text-muted-foreground')
        expect(pageHeading.querySelector('svg')).not.toHaveClass('status-info-text-strong')
        expect(count).toHaveClass('hidden', 'sm:inline')
        expect(projectHeading.querySelector('svg')).toBeNull()
        expect(projectsGrid).toHaveClass('gap-6')
        expect(projectsGrid).not.toHaveClass('gap-4')
    })

    it('matches client card padding and places personal status immediately beside the title', () => {
        projectsHookMocks.projects = [
            {
                id: 'project-1',
                title: 'Personal Project',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                archived: false,
                isPersonal: true,
            }
        ]

        render(
            <ProjectList
                onSelectProject={vi.fn()}
                clients={[]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        const projectHeading = screen.getByRole('heading', { name: 'Personal Project' })
        const cardContent = projectHeading.closest('.rounded-xl')?.firstElementChild
        const titleGroup = screen.getByTestId('project-card-title-group')
        const personalBadge = screen.getByText('Personal')
        const menuButton = screen.getByRole('button', { name: 'More actions' })

        expect(cardContent).toHaveClass('p-4', 'md:p-6', 'md:pt-5')
        expect(titleGroup).toHaveClass('flex-wrap', 'items-center')
        expect(titleGroup).toContainElement(projectHeading)
        expect(projectHeading.nextElementSibling).toBe(personalBadge)
        expect(titleGroup.parentElement).toContainElement(menuButton)
        expect(menuButton.parentElement).toBe(titleGroup.parentElement)
        expect(titleGroup.parentElement).toHaveClass('items-center')
        expect(screen.getByText(/Created /)).toBeInTheDocument()
        expect(screen.queryByText(/Most recent /)).not.toBeInTheDocument()
    })

    it('renders archived project menu triggers with the same styling as active project cards', async () => {
        const user = userEvent.setup()

        projectsHookMocks.projects = [
            { id: 'project-1', title: 'Active Project', createdAt: Date.now(), archived: false },
            { id: 'project-2', title: 'Archived Project', createdAt: Date.now(), archived: true },
        ]

        render(
            <ProjectList
                onSelectProject={vi.fn()}
                clients={[]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        await user.click(screen.getByRole('button', { name: /Archived Projects/i }))

        const menuButtons = screen.getAllByRole('button', { name: 'More actions' })
        const archivedGrid = screen.getByRole('heading', { name: 'Archived Project' }).closest('.grid')

        expect(menuButtons).toHaveLength(2)
        expect(menuButtons[0].className).toBe(menuButtons[1].className)
        expect(archivedGrid).toHaveClass('gap-6')
    })

    it('shows quote stage and deadline context for quoted client projects', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-24T12:00:00Z'))

        projectsHookMocks.projects = [
            {
                id: 'project-1',
                title: 'Project One',
                createdAt: Date.now(),
                archived: false,
                preferredClientId: 'client-1',
                statusMode: 'quote',
                deadline: '2026-03-28',
            }
        ]

        render(
            <ProjectList
                onSelectProject={vi.fn()}
                clients={[{ id: 'client-1', title: 'Acme Co' }]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        expect(screen.getByText('Quote stage')).toBeInTheDocument()
        expect(screen.getByText(/Deadline/i)).toBeInTheDocument()
        expect(screen.getByText(/4 days remaining/i)).toBeInTheDocument()

        vi.useRealTimers()
    })

    it('shows an overdue deadline badge beside the project details', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-24T12:00:00Z'))

        projectsHookMocks.projects = [
            {
                id: 'project-1',
                title: 'Project One',
                createdAt: Date.now(),
                archived: false,
                preferredClientId: 'client-1',
                deadline: '2026-03-20',
            }
        ]

        render(
            <ProjectList
                onSelectProject={vi.fn()}
                clients={[{ id: 'client-1', title: 'Acme Co' }]}
                openProjectModal={vi.fn()}
                editProjectModal={vi.fn()}
            />
        )

        expect(screen.getByText('Overdue')).toBeInTheDocument()
        expect(screen.getByText(/4 days overdue/i)).toBeInTheDocument()

        const detailsLayout = screen.getByTestId('project-card-details')
        const detailText = screen.getByTestId('project-card-detail-text')
        const pills = screen.getByTestId('project-card-pills')

        expect(detailsLayout).toHaveClass('flex-wrap', 'items-end')
        expect(detailText.nextElementSibling).toBe(pills)
        expect(pills).toHaveClass('ml-auto', 'justify-end')
        expect(pills).toContainElement(screen.getByText('Overdue'))
        expect(pills).not.toHaveClass('mt-auto', 'pt-4')

        vi.useRealTimers()
    })

})
