import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TaskViewModal from './TaskViewModal'
import { toDisplayDate } from '@/utils/dateUtils'

const hookMocks = vi.hoisted(() => ({

    projects: [],
    tasks: [],
    recurringStatus: null,
    isCompleted: false,
    showSuccess: vi.fn(),
    updateTask: vi.fn(),
    unarchiveTask: vi.fn(),
    toggleRecurringCompletion: vi.fn(),
    skipRecurringOccurrence: vi.fn(),
    createEntry: vi.fn(),
    getTimerForTask: vi.fn(() => null),
    clearTimer: vi.fn(),
    isTaskTimerActive: vi.fn(() => false),
    deleteAttachment: vi.fn(),
}))

vi.mock('@/utils/dateUtils', async () => {

    const actual = await vi.importActual('@/utils/dateUtils')
    return {
        ...actual,
        getTodayString: () => '2026-02-19',
    }
})

vi.mock('../Modal', () => ({

    default: ({ isOpen, title, footer, children }) => {
        if (!isOpen) return null
        return (
            <div>
                <h2>{title}</h2>
                <div>{children}</div>
                <div>{footer}</div>
            </div>
        )
    }
}))

vi.mock('../TimerControls', () => ({

    default: () => <div>Timer controls</div>
}))

vi.mock('../task/TaskActionsMenu', () => ({

    default: () => <div>Task actions</div>
}))

vi.mock('./AddTimeEntryModal', () => ({

    default: () => null
}))

vi.mock('@/hooks/useToast', () => ({

    useToast: () => ({
        showSuccess: hookMocks.showSuccess,
    })
}))

vi.mock('@/hooks/useProjects', () => ({

    useProjects: () => ({
        projects: hookMocks.projects,
    })
}))

vi.mock('@/hooks/useClients', () => ({

    useClients: () => ({
        clients: [],
    })
}))

vi.mock('@/hooks/useTasks', () => ({

    useTasks: () => ({
        tasks: hookMocks.tasks,
        updateTask: hookMocks.updateTask,
        unarchiveTask: hookMocks.unarchiveTask,
        toggleRecurringCompletion: hookMocks.toggleRecurringCompletion,
        skipRecurringOccurrence: hookMocks.skipRecurringOccurrence,
        isCompletedOnDate: () => hookMocks.isCompleted,
        getRecurringStatus: () => hookMocks.recurringStatus,
    })
}))

vi.mock('@/hooks/useTimeEntries', () => ({

    useTimeEntries: () => ({
        entries: [],
        createEntry: hookMocks.createEntry,
    })
}))

vi.mock('@/hooks/useTimers', () => ({

    useTimers: () => ({
        getTimerForTask: hookMocks.getTimerForTask,
        clearTimer: hookMocks.clearTimer,
        isTaskTimerActive: hookMocks.isTaskTimerActive,
    })
}))

vi.mock('@/hooks/usePlannerAttachments', () => ({

    usePlannerAttachments: () => ({
        deleteAttachment: hookMocks.deleteAttachment,
    })
}))

describe('TaskViewModal recurring actions', () => {

    const recurringTask = {
        id: 'task-1',
        title: 'Recurring task',
        recurring: { type: 'weekly', weeklyDays: [1, 3, 5] },
        archived: false,
        completed: false,
        projectId: null,
        promptTimeEntry: false,
    }

    const renderModal = (props = {}) => {
        render(
            <TaskViewModal
                isOpen={true}
                onClose={vi.fn()}
                task={recurringTask}
                dateStr={null}
                attachment={null}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                onNavigateToProject={vi.fn()}
                onOpenTimeEntries={vi.fn()}
                onOpenPlannerOptions={vi.fn()}
                {...props}
            />
        )
    }

    beforeEach(() => {
        vi.clearAllMocks()
        hookMocks.projects = []
        hookMocks.tasks = [recurringTask]
        hookMocks.isCompleted = false
        hookMocks.recurringStatus = {
            isDueToday: false,
            isOverdue: false,
            lastDueDateStr: null,
            nextDueDateStr: '2026-02-21',
            effectiveDateStr: null,
            isSkipped: false,
        }
    })

    it('hides skip button for future viewed dates and shows date-specific done label', () => {
        renderModal({ dateStr: '2026-02-21' })

        const expectedDateLabel = toDisplayDate('2026-02-21', { month: 'short', day: 'numeric' })
        expect(screen.getByRole('button', { name: `Done for ${expectedDateLabel}` })).toBeInTheDocument()
        expect(screen.queryByTitle('Skip until next recurring')).not.toBeInTheDocument()
    })

    it('hides skip button for already skipped occurrence and keeps date-specific done label', () => {
        hookMocks.recurringStatus = {
            isDueToday: false,
            isOverdue: false,
            lastDueDateStr: '2026-02-17',
            nextDueDateStr: '2026-02-21',
            effectiveDateStr: null,
            isSkipped: true,
        }

        renderModal({ dateStr: '2026-02-17' })

        const expectedDateLabel = toDisplayDate('2026-02-17', { month: 'short', day: 'numeric' })
        expect(screen.getByRole('button', { name: `Done for ${expectedDateLabel}` })).toBeInTheDocument()
        expect(screen.queryByTitle('Skip until next recurring')).not.toBeInTheDocument()
    })

    it('shows today labels and skip button when recurring task is due today', () => {
        hookMocks.recurringStatus = {
            isDueToday: true,
            isOverdue: false,
            lastDueDateStr: '2026-02-19',
            nextDueDateStr: null,
            effectiveDateStr: '2026-02-19',
            isSkipped: false,
        }

        renderModal()

        expect(screen.getByRole('button', { name: 'Done for today' })).toBeInTheDocument()
        expect(screen.getByTitle('Skip until next recurring')).toBeInTheDocument()
    })

    it('shows overdue date label and skip button when recurring task is overdue', () => {
        hookMocks.recurringStatus = {
            isDueToday: false,
            isOverdue: true,
            lastDueDateStr: '2026-02-17',
            nextDueDateStr: '2026-02-21',
            effectiveDateStr: '2026-02-17',
            isSkipped: false,
        }

        renderModal()

        const expectedDateLabel = toDisplayDate('2026-02-17', { month: 'short', day: 'numeric' })
        expect(screen.getByRole('button', { name: `Done for ${expectedDateLabel}` })).toBeInTheDocument()
        expect(screen.getByTitle('Skip until next recurring')).toBeInTheDocument()
    })

    it('keeps footer actions and linked details in flexible wrap layouts', () => {
        hookMocks.projects = [{ id: 'project-1', title: 'Client Work' }]
        hookMocks.tasks = [
            {
                ...recurringTask,
                projectId: 'project-1',
            },
        ]

        renderModal({ task: hookMocks.tasks[0] })

        const projectSection = screen.getByText('Project').parentElement?.parentElement
        const footer = screen.getByText('Timer controls').parentElement

        expect(projectSection?.className).toContain('grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]')
        expect(projectSection?.className).not.toContain('sm:grid-cols-2')
        expect(footer?.className).toContain('flex-wrap')
        expect(footer?.className).not.toContain('flex-col')
    })
})

describe('TaskViewModal billable toggle', () => {
    const task = {
        id: 'task-billable-1',
        title: 'Billable task',
        recurring: null,
        archived: false,
        completed: false,
        projectId: 'project-1',
        billable: false,
    }

    const renderModal = (props = {}) => {
        render(
            <TaskViewModal
                isOpen={true}
                onClose={vi.fn()}
                task={task}
                dateStr={null}
                attachment={null}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                onNavigateToProject={vi.fn()}
                onOpenTimeEntries={vi.fn()}
                onOpenPlannerOptions={vi.fn()}
                {...props}
            />
        )
    }

    beforeEach(() => {
        vi.clearAllMocks()
        hookMocks.tasks = [task]
        hookMocks.projects = [{ id: 'project-1', title: 'Client Work', isPersonal: false }]
    })

    it('shows the billable toggle for non-personal project tasks', () => {
        renderModal()

        expect(screen.getByRole('button', { name: 'Mark as billable' })).toBeInTheDocument()
        expect(screen.queryByText('Billing')).not.toBeInTheDocument()
    })

    it('hides the billable toggle for personal project tasks', () => {
        hookMocks.projects = [{ id: 'project-1', title: 'Personal Work', isPersonal: true }]

        renderModal()

        expect(screen.queryByRole('button', { name: 'Mark as billable' })).not.toBeInTheDocument()
    })

    it('updates billable state from the modal using the existing task update behavior', () => {
        const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(123)

        renderModal()

        fireEvent.click(screen.getByRole('button', { name: 'Mark as billable' }))

        expect(hookMocks.updateTask).toHaveBeenCalledWith('task-billable-1', {
            billable: true,
            billableSetByUser: true,
            lastActive: 123,
        })
        expect(hookMocks.showSuccess).toHaveBeenCalledWith('Task marked as billable')

        dateNowSpy.mockRestore()
    })
})

describe('TaskViewModal archived footer actions', () => {
    const archivedTask = {
        id: 'task-archived-1',
        title: 'Archived task',
        recurring: null,
        archived: true,
        completed: true,
        projectId: null,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        hookMocks.tasks = [archivedTask]
    })

    it('shows delete on the left side of the archived footer and keeps unarchive available', () => {
        const onClose = vi.fn()
        const onDelete = vi.fn()

        render(
            <TaskViewModal
                isOpen={true}
                onClose={onClose}
                task={archivedTask}
                dateStr={null}
                attachment={null}
                onEdit={vi.fn()}
                onDelete={onDelete}
                onArchive={vi.fn()}
                onNavigateToProject={vi.fn()}
                onOpenTimeEntries={vi.fn()}
                onOpenPlannerOptions={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument()
        expect(screen.getByTestId('archived-task-modal-footer').className).toContain('justify-between')

        fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))

        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onDelete).toHaveBeenCalledWith(archivedTask)
    })
})
