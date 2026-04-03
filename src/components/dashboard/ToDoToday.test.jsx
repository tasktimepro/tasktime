import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ToDoToday from './ToDoToday'
import { formatDurationWithSeconds, toStorageDate } from '../../utils/dateUtils.ts'

const hookMocks = {
    expenses: [],
    markAsPaid: vi.fn(),
    recurrences: [],
    getTimerForTask: vi.fn(() => null),
    showSuccess: vi.fn(),
    showError: vi.fn(),
}

vi.mock('../../hooks/useTimers', () => ({
    useTimers: () => ({
        getTimerForTask: hookMocks.getTimerForTask
    })
}))

vi.mock('../../hooks/useExpenses.ts', () => ({
    useExpenses: () => ({
        expenses: hookMocks.expenses,
        markAsPaid: hookMocks.markAsPaid,
    })
}))

vi.mock('../../hooks/useExpenseRecurrences.ts', () => ({
    useExpenseRecurrences: () => ({
        recurrences: hookMocks.recurrences,
    })
}))

vi.mock('../../hooks/useToast.ts', () => ({
    useToast: () => ({
        showError: hookMocks.showError,
        showSuccess: hookMocks.showSuccess
    })
}))

vi.mock('../TimeEntriesModal', () => ({
    default: ({ isOpen, task }) => (isOpen ? <div>Time entries for {task.title}</div> : null)
}))

vi.mock('../expenses/ExpenseDueCard', () => ({
    default: ({ expense, isOverdue, isToday, isPreview, onView, onMarkPaid }) => (
        <div data-testid={`expense-${expense.id}`}>
            <span>{expense.title}</span>
            {isOverdue && <span>Overdue expense</span>}
            {isToday && <span>Today expense</span>}
            {isPreview && <span>Preview expense</span>}
            <button type="button" onClick={onView}>View expense</button>
            {onMarkPaid && (
                <button type="button" onClick={onMarkPaid}>Mark expense paid</button>
            )}
        </div>
    )
}))

vi.mock('../task/TaskActionsMenu', () => ({
    default: ({ task, onEdit, onDelete }) => (
        <div>
            <button type="button" onClick={() => onEdit(task)}>Edit task</button>
            <button type="button" onClick={() => onDelete(task)}>Delete task</button>
        </div>
    )
}))

describe('ToDoToday', () => {

    const setMatchMedia = (matches) => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches,
                media: '(max-width: 767px)',
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }))
        })
    }

    beforeEach(() => {
        setMatchMedia(false)
        hookMocks.expenses = []
        hookMocks.recurrences = []
        hookMocks.markAsPaid = vi.fn()
        hookMocks.getTimerForTask = vi.fn(() => null)
        hookMocks.showSuccess = vi.fn()
        hookMocks.showError = vi.fn()
    })

    const todayStr = toStorageDate(new Date()) || '2026-02-18'
    const yesterdayStr = toStorageDate(new Date(Date.now() - 24 * 60 * 60 * 1000)) || '2026-02-17'
    const tomorrowStr = toStorageDate(new Date(Date.now() + 24 * 60 * 60 * 1000)) || '2026-02-19'

    const overdueTask = {
        id: 't1',
        title: 'Overdue Task',
        projectId: 'p1',
        completed: false,
        startDate: yesterdayStr,
        recurring: null,
        recentTime: 0,
        project: { title: 'Project Alpha' }
    }

    const todayTask = {
        id: 't2',
        title: 'Today Task',
        projectId: null,
        completed: false,
        startDate: todayStr,
        recurring: null,
        recentTime: 0
    }

    const upcomingTask = {
        id: 't3',
        title: 'Upcoming Task',
        projectId: 'p1',
        completed: false,
        startDate: tomorrowStr,
        recurring: null,
        recentTime: 0
    }

    const renderComponent = (overrides = {}) => {
        const props = {
            overdueTasks: [overdueTask],
            tasksForToday: [todayTask],
            upcomingTasks: [upcomingTask],
            handleCompleteTask: vi.fn(),
            getTaskCompletedStatus: vi.fn(() => false),
            renderTaskTitle: (task) => <span>{task.title}</span>,
            renderTaskControls: () => null,
            onEditTask: vi.fn(),
            onDeleteTask: vi.fn(),
            onArchiveTask: vi.fn(),
            onTaskTitleClick: vi.fn(),
            openExpenseView: vi.fn(),
            ...overrides,
        }

        render(<ToDoToday {...props} />)
        return props
    }

    it('shows empty state when nothing is due today', () => {
        renderComponent({
            overdueTasks: [],
            tasksForToday: [],
            upcomingTasks: [],
        })

        expect(screen.getByText('Nothing due today')).toBeInTheDocument()
        expect(screen.getByText("You're all caught up.")).toBeInTheDocument()
    })

    it('renders tasks and toggles upcoming section', async () => {
        const user = userEvent.setup()

        renderComponent()

        expect(screen.getByText('To Do Today (2)')).toBeInTheDocument()
        expect(screen.getByText('Overdue Task')).toBeInTheDocument()
        expect(screen.getByText('Today Task')).toBeInTheDocument()

        expect(screen.queryByText('Upcoming Task')).not.toBeInTheDocument()
        await user.click(screen.getByText('Upcoming tasks (1)'))
        expect(screen.getByText('Upcoming Task')).toBeInTheDocument()
    })

    it('stacks task metadata and actions below the title content', () => {
        setMatchMedia(true)

        renderComponent({
            upcomingTasks: [],
            renderTaskControls: () => <button type="button">Start timer</button>,
            renderTaskTitle: (task) => <span>{task.title} with an intentionally long mobile title</span>,
        })

        const secondaryRow = screen.getByTestId(`task-row-secondary-${overdueTask.id}`)
        const actionsRow = screen.getByTestId(`task-row-actions-${overdueTask.id}`)

        expect(secondaryRow.className.includes('w-full')).toBe(true)
        expect(secondaryRow.className.includes('justify-end')).toBe(true)
        expect(actionsRow.className.includes('justify-end')).toBe(true)
        expect(within(actionsRow).getByText('Start timer')).toBeInTheDocument()
    })

    it('hides recent time on mobile task rows', () => {
        setMatchMedia(true)

        const durationLabel = formatDurationWithSeconds(3661)

        renderComponent({
            overdueTasks: [{
                ...overdueTask,
                recentTime: 3661,
            }],
            tasksForToday: [],
            upcomingTasks: [],
        })

        expect(screen.queryByText(durationLabel)).not.toBeInTheDocument()
    })

    it('deduplicates tasks appearing in both overdue and today lists', () => {
        const duplicate = { ...overdueTask, id: 'dupe-task' }

        renderComponent({
            overdueTasks: [duplicate],
            tasksForToday: [duplicate],
            upcomingTasks: [],
        })

        expect(screen.getByText('To Do Today (1)')).toBeInTheDocument()
        expect(screen.getAllByText(duplicate.title)).toHaveLength(1)
    })

    it('handles completion and actions', async () => {
        const user = userEvent.setup()
        const props = renderComponent({ upcomingTasks: [] })

        const [checkbox] = screen.getAllByRole('checkbox')
        await user.click(checkbox)
        expect(props.handleCompleteTask).toHaveBeenCalledWith(overdueTask, true)

        await user.click(screen.getAllByTitle('Add time entry')[0])
        expect(screen.getByText('Time entries for Overdue Task')).toBeInTheDocument()

        await user.click(screen.getAllByText('Edit task')[0])
        expect(props.onEditTask).toHaveBeenCalledWith(overdueTask)

        await user.click(screen.getAllByText('Delete task')[0])
        expect(props.onDeleteTask).toHaveBeenCalledWith(overdueTask)
    })

    it('opens task details only for overdue incomplete tasks when callback is provided', async () => {
        const user = userEvent.setup()
        const props = renderComponent({
            overdueTasks: [{
                ...overdueTask,
                recurringStatus: { isOverdue: true },
            }],
            tasksForToday: [],
            upcomingTasks: [],
        })

        const detailsButton = screen.getByRole('button', { name: 'Open task details' })
        await user.click(detailsButton)

        expect(props.onTaskTitleClick).toHaveBeenCalledWith(expect.objectContaining({ id: overdueTask.id }))
    })

    it('does not render open-details button for completed overdue tasks', () => {
        const getTaskCompletedStatus = vi.fn(() => true)

        renderComponent({
            overdueTasks: [{
                ...overdueTask,
                recurringStatus: { isOverdue: true },
            }],
            tasksForToday: [],
            upcomingTasks: [],
            getTaskCompletedStatus,
        })

        expect(screen.queryByRole('button', { name: 'Open task details' })).not.toBeInTheDocument()
    })

    it('hides row actions when timer exists for the task/project', () => {
        hookMocks.getTimerForTask = vi.fn(() => ({
            taskId: 'different-task',
            isPaused: false,
        }))

        renderComponent({ upcomingTasks: [] })

        expect(screen.queryByTitle('Add time entry')).not.toBeInTheDocument()
        expect(screen.queryByText('Edit task')).not.toBeInTheDocument()
        expect(screen.queryByText('Delete task')).not.toBeInTheDocument()
    })

    it('shows recurring-overdue tasks as overdue even without a past start date', async () => {
        const user = userEvent.setup()
        const recurringCarryOver = {
            ...todayTask,
            id: 'recurring-carry-over',
            title: 'Recurring Carry Over',
            startDate: null,
            recurring: { type: 'weekly', weeklyDays: [1, 3, 5] },
            recurringStatus: { isOverdue: true },
        }

        const props = renderComponent({
            overdueTasks: [],
            tasksForToday: [recurringCarryOver],
            upcomingTasks: [],
        })

        const detailsButton = screen.getByRole('button', { name: 'Open task details' })
        await user.click(detailsButton)
        expect(props.onTaskTitleClick).toHaveBeenCalledWith(expect.objectContaining({ id: recurringCarryOver.id }))
    })

    it('renders and toggles upcoming expenses', async () => {
        const user = userEvent.setup()
        hookMocks.expenses = [
            {
                id: 'expense-upcoming',
                title: 'Upcoming Expense',
                paymentStatus: 'unpaid',
                paymentMode: 'manual',
                amountType: 'fixed',
                amount: 10,
                currency: 'USD',
                date: tomorrowStr,
                isRecurring: false,
            },
        ]

        renderComponent({
            overdueTasks: [],
            tasksForToday: [],
            upcomingTasks: [],
        })

        expect(screen.queryByText('Upcoming Expense')).not.toBeInTheDocument()
        await user.click(screen.getByText('Upcoming expenses (1)'))
        expect(screen.getByText('Upcoming Expense')).toBeInTheDocument()
    })

    it('marks manual unpaid expense as paid and opens expense view', async () => {
        const user = userEvent.setup()
        const expense = {
            id: 'expense-today',
            title: 'Today Manual Expense',
            paymentStatus: 'unpaid',
            paymentMode: 'manual',
            amountType: 'fixed',
            amount: 15,
            currency: 'USD',
            date: todayStr,
            isRecurring: false,
        }
        hookMocks.expenses = [expense]
        const openExpenseView = vi.fn()

        renderComponent({
            overdueTasks: [],
            tasksForToday: [],
            upcomingTasks: [],
            openExpenseView,
        })

        await user.click(screen.getByRole('button', { name: 'View expense' }))
        expect(openExpenseView).toHaveBeenCalledWith(expense)

        await user.click(screen.getByRole('button', { name: 'Mark expense paid' }))
        expect(hookMocks.markAsPaid).toHaveBeenCalledWith(expense.id)
        expect(hookMocks.showSuccess).toHaveBeenCalledWith('Expense marked as paid')
    })

    it('shows toast error when marking expense paid throws', async () => {
        const user = userEvent.setup()
        hookMocks.markAsPaid = vi.fn(() => {
            throw new Error('mark failed')
        })
        hookMocks.expenses = [
            {
                id: 'expense-error',
                title: 'Expense Error',
                paymentStatus: 'unpaid',
                paymentMode: 'manual',
                amountType: 'fixed',
                amount: 12,
                currency: 'USD',
                date: todayStr,
            },
        ]

        renderComponent({
            overdueTasks: [],
            tasksForToday: [],
            upcomingTasks: [],
        })

        await user.click(screen.getByRole('button', { name: 'Mark expense paid' }))
        expect(hookMocks.showError).toHaveBeenCalledWith('mark failed')
    })

    it('hides mark paid button for auto-fixed, paid, and preview expenses', async () => {
        const user = userEvent.setup()
        hookMocks.expenses = [
            {
                id: 'expense-auto',
                title: 'Auto Fixed Expense',
                paymentStatus: 'unpaid',
                paymentMode: 'auto',
                amountType: 'fixed',
                amount: 20,
                currency: 'USD',
                date: todayStr,
                recurrenceId: 'rec-1',
            },
            {
                id: 'expense-paid',
                title: 'Paid Expense',
                paymentStatus: 'paid',
                paidOn: todayStr,
                paymentMode: 'manual',
                amountType: 'fixed',
                amount: 25,
                currency: 'USD',
                date: todayStr,
            },
        ]
        hookMocks.recurrences = [
            {
                id: 'rec-2',
                active: true,
                startDate: tomorrowStr,
                repeat: 'monthly',
                monthlyType: 'date',
                monthlyDay: 1,
                amountType: 'fixed',
                amount: 10,
            },
        ]

        renderComponent({
            overdueTasks: [],
            tasksForToday: [],
            upcomingTasks: [],
        })

        await user.click(screen.getByText(/Upcoming expenses/i))
        expect(screen.getByText('Preview expense')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mark expense paid' })).not.toBeInTheDocument()
    })

    it('shows completed tasks and paid expenses at the bottom in the top list', () => {
        const getTaskCompletedStatus = vi.fn((task) => task.completed === true)

        const dueIncomplete = {
            ...todayTask,
            id: 't4',
            title: 'Due Incomplete',
            completed: false,
            startDate: todayStr,
        }

        const dueCompleted = {
            ...todayTask,
            id: 't5',
            title: 'Due Completed',
            completed: true,
            startDate: todayStr,
        }

        hookMocks.expenses = [
            {
                id: 'e1',
                title: 'Today Unpaid Expense',
                paymentStatus: 'unpaid',
                paymentMode: 'manual',
                amountType: 'fixed',
                amount: 10,
                currency: 'USD',
                date: todayStr,
                isRecurring: false,
            },
            {
                id: 'e2',
                title: 'Today Paid Expense',
                paymentStatus: 'paid',
                paidOn: todayStr,
                paymentMode: 'manual',
                amountType: 'fixed',
                amount: 20,
                currency: 'USD',
                date: todayStr,
                isRecurring: false,
            },
        ]

        renderComponent({
            overdueTasks: [],
            tasksForToday: [dueCompleted, dueIncomplete],
            upcomingTasks: [],
            getTaskCompletedStatus,
        })

        const dueIncompleteNode = screen.getByText('Due Incomplete')
        const dueCompletedNode = screen.getByText('Due Completed')
        const unpaidExpenseNode = screen.getByText('Today Unpaid Expense')
        const paidExpenseNode = screen.getByText('Today Paid Expense')

        expect(dueIncompleteNode.compareDocumentPosition(dueCompletedNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(unpaidExpenseNode.compareDocumentPosition(paidExpenseNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        expect(unpaidExpenseNode.compareDocumentPosition(dueCompletedNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
})
