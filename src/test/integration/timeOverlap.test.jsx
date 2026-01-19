import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimeEntriesModal from '../../components/TimeEntriesModal'
import { ToastContext } from '../../contexts/ToastContext'

describe('Time entry overlap integration', () => {

    const toastContextValue = {
        addToast: vi.fn(),
        removeToast: vi.fn(),
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn()
    }

    const task = { id: 'task-1', projectId: 'project-1', title: 'Task' }
    const allTasks = [task]

    it('blocks overlapping manual entries', async () => {

        const user = userEvent.setup()
        const setTimeEntries = vi.fn()

        render(
            <ToastContext.Provider value={toastContextValue}>
                <TimeEntriesModal
                    isOpen
                    onClose={vi.fn()}
                    task={task}
                    timeEntries={[{
                        id: 'entry-1',
                        taskId: 'task-1',
                        start: new Date('2026-01-19T10:00:00').getTime(),
                        end: new Date('2026-01-19T11:00:00').getTime()
                    }]}
                    setTimeEntries={setTimeEntries}
                    allTasks={allTasks}
                />
            </ToastContext.Provider>
        )

        await user.click(screen.getByRole('button', { name: 'Add Entry' }))

        await user.clear(screen.getByLabelText('Start Date'))
        await user.type(screen.getByLabelText('Start Date'), '2026-01-19')
        await user.clear(screen.getByLabelText('Start Time'))
        await user.type(screen.getByLabelText('Start Time'), '10:30:00')
        await user.clear(screen.getByLabelText('End Date'))
        await user.type(screen.getByLabelText('End Date'), '2026-01-19')
        await user.clear(screen.getByLabelText('End Time'))
        await user.type(screen.getByLabelText('End Time'), '11:30:00')

        const buttons = screen.getAllByRole('button', { name: 'Add Entry' })
        await user.click(buttons[1])

        expect(toastContextValue.showError).toHaveBeenCalled()
        expect(setTimeEntries).not.toHaveBeenCalled()
    })
})
