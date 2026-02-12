import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ToDoToday from './ToDoToday'
import { toStorageDate } from '../../utils/dateUtils.ts'

const hookMocks = {
    expenses: [],
    markAsPaid: vi.fn(),
    recurrences: [],
}

vi.mock('../../hooks/useTimers', () => ({
    useTimers: () => ({
        getTimerForTask: () => null
    })
}))

vi.mock('@/hooks/useExpenses.ts', () => ({
    useExpenses: () => ({
        expenses: hookMocks.expenses,
        markAsPaid: hookMocks.markAsPaid,
    })
}))

vi.mock('@/hooks/useExpenseRecurrences.ts', () => ({
    useExpenseRecurrences: () => ({
        recurrences: hookMocks.recurrences,
    })
}))

vi.mock('@/hooks/useToast.ts', () => ({
    useToast: () => ({
        showError: vi.fn(),
        showSuccess: vi.fn()
    })
}))

vi.mock('../TimeEntriesModal', () => ({
    default: ({ isOpen, task }) => (isOpen ? <div>Time entries for {task.title}</div> : null)
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

    beforeEach(() => {
        hookMocks.expenses = []
        hookMocks.recurrences = []
        hookMocks.markAsPaid = vi.fn()
    })

    const overdueTask = {
        id: 't1',
        title: 'Overdue Task',
        projectId: 'p1',
        completed: false,
        startDate: '2025-01-05',
        recurring: null,
        recentTime: 0,
        project: { title: 'Project Alpha' }
    }

    const todayTask = {
        id: 't2',
        title: 'Today Task',
        projectId: null,
        completed: false,
        startDate: '2025-01-06',
        recurring: null,
        recentTime: 0
    }

    const upcomingTask = {
        id: 't3',
        title: 'Upcoming Task',
        projectId: 'p1',
        completed: false,
        startDate: '2025-01-10',
        recurring: null,
        recentTime: 0
    }

    it('renders tasks and toggles upcoming section', async () => {

        const handleCompleteTask = vi.fn()
        const getTaskCompletedStatus = vi.fn(() => false)
        const onEditTask = vi.fn()
        const onDeleteTask = vi.fn()
        const user = userEvent.setup()

        render(
            <ToDoToday
                overdueTasks={[overdueTask]}
                tasksForToday={[todayTask]}
                upcomingTasks={[upcomingTask]}
                handleCompleteTask={handleCompleteTask}
                getTaskCompletedStatus={getTaskCompletedStatus}
                renderTaskTitle={(task) => <span>{task.title}</span>}
                renderTaskControls={() => null}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
            />
        )

        expect(screen.getByText('To Do Today (2)')).toBeInTheDocument()
        expect(screen.getByText('Overdue Task')).toBeInTheDocument()
        expect(screen.getByText('Today Task')).toBeInTheDocument()

        expect(screen.queryByText('Upcoming Task')).not.toBeInTheDocument()
        await user.click(screen.getByText('Upcoming tasks (1)'))
        expect(screen.getByText('Upcoming Task')).toBeInTheDocument()
    })

    it('handles completion and actions', async () => {

        const handleCompleteTask = vi.fn()
        const getTaskCompletedStatus = vi.fn(() => false)
        const onEditTask = vi.fn()
        const onDeleteTask = vi.fn()
        const user = userEvent.setup()

        render(
            <ToDoToday
                overdueTasks={[overdueTask]}
                tasksForToday={[todayTask]}
                upcomingTasks={[]}
                handleCompleteTask={handleCompleteTask}
                getTaskCompletedStatus={getTaskCompletedStatus}
                renderTaskTitle={(task) => <span>{task.title}</span>}
                renderTaskControls={() => null}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
            />
        )

        const [checkbox] = screen.getAllByRole('checkbox')
        await user.click(checkbox)
        expect(handleCompleteTask).toHaveBeenCalledWith(overdueTask, true)

        await user.click(screen.getAllByTitle('Add time entry')[0])
        expect(screen.getByText('Time entries for Overdue Task')).toBeInTheDocument()

        await user.click(screen.getAllByText('Edit task')[0])
        expect(onEditTask).toHaveBeenCalledWith(overdueTask)

        await user.click(screen.getAllByText('Delete task')[0])
        expect(onDeleteTask).toHaveBeenCalledWith(overdueTask)
    })

    it('shows completed tasks and paid expenses at the bottom in the top list', () => {

        const getTaskCompletedStatus = vi.fn((task) => task.completed === true)
        const todayStr = toStorageDate(new Date()) || '2026-02-12'

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

        render(
            <ToDoToday
                overdueTasks={[]}
                tasksForToday={[dueCompleted, dueIncomplete]}
                upcomingTasks={[]}
                handleCompleteTask={vi.fn()}
                getTaskCompletedStatus={getTaskCompletedStatus}
                renderTaskTitle={(task) => <span>{task.title}</span>}
                renderTaskControls={() => null}
                onEditTask={vi.fn()}
                onDeleteTask={vi.fn()}
            />
        )

        const dueIncompleteNode = screen.getByText('Due Incomplete')
        const dueCompletedNode = screen.getByText('Due Completed')
        const unpaidExpenseNode = screen.getByText('Today Unpaid Expense')
        const paidExpenseNode = screen.getByText('Today Paid Expense')

        expect(dueIncompleteNode.compareDocumentPosition(dueCompletedNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(unpaidExpenseNode.compareDocumentPosition(paidExpenseNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        expect(unpaidExpenseNode.compareDocumentPosition(dueCompletedNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
})
