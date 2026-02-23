import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskItem from './TaskItem';

const hookState = vi.hoisted(() => ({
    tasks: [],
    entries: [],
    getTimerForTask: vi.fn(() => null),
    clearTimer: vi.fn(),
    createEntry: vi.fn(),
    updateTask: vi.fn(),
    toggleRecurringCompletion: vi.fn(),
    isCompletedOnDate: vi.fn(() => false),
    showSuccess: vi.fn(),
}));

vi.mock('./task/TaskHeader', () => ({
    default: () => <div data-testid="task-header" />,
}));

vi.mock('./task/TaskActions', () => ({
    default: () => <div data-testid="task-actions" />,
}));

vi.mock('./task/StartDateBadge', () => ({
    default: () => null,
}));

vi.mock('./TimeEntriesModal', () => ({
    default: () => null,
}));

vi.mock('./modals/AddTimeEntryModal', () => ({
    default: () => null,
}));

vi.mock('./task/SubtaskSection', () => ({
    default: ({
        showCreateSubtaskForm,
        setShowCreateSubtaskForm,
        setNewSubtaskTitle,
        setNewSubtaskNote,
        setNewSubtaskStartDate,
        handleCreateSubtask,
    }) => (
        <div>
            <button
                type="button"
                onClick={() => setShowCreateSubtaskForm(true)}
            >
                Open subtask form
            </button>
            {showCreateSubtaskForm && (
                <div>
                    <button
                        type="button"
                        onClick={() => setNewSubtaskTitle('Subtask A')}
                    >
                        Fill title
                    </button>
                    <button
                        type="button"
                        onClick={() => setNewSubtaskNote('Subtask note')}
                    >
                        Fill note
                    </button>
                    <button
                        type="button"
                        onClick={() => setNewSubtaskStartDate('2026-02-23')}
                    >
                        Fill date
                    </button>
                    <button
                        type="button"
                        onClick={() => handleCreateSubtask({ preventDefault: () => {} })}
                    >
                        Submit subtask
                    </button>
                </div>
            )}
        </div>
    ),
}));

vi.mock('../hooks/useToast', () => ({
    useToast: () => ({
        showSuccess: hookState.showSuccess,
    }),
}));

vi.mock('../hooks/useTasks', () => ({
    useTasks: () => ({
        tasks: hookState.tasks,
        updateTask: hookState.updateTask,
        toggleRecurringCompletion: hookState.toggleRecurringCompletion,
        isCompletedOnDate: hookState.isCompletedOnDate,
    }),
}));

vi.mock('../hooks/useTimeEntries', () => ({
    useTimeEntries: () => ({
        entries: hookState.entries,
        createEntry: hookState.createEntry,
    }),
}));

vi.mock('../hooks/useTimers', () => ({
    useTimers: () => ({
        getTimerForTask: hookState.getTimerForTask,
        clearTimer: hookState.clearTimer,
    }),
}));

describe('TaskItem subtask creation', () => {
    it('includes note in onCreateSubtask payload', async () => {
        hookState.tasks = [];
        hookState.entries = [];
        hookState.getTimerForTask.mockReturnValue(null);

        const onCreateSubtask = vi.fn();
        const user = userEvent.setup();

        render(
            <TaskItem
                task={{
                    id: 'task-1',
                    projectId: 'project-1',
                    title: 'Parent task',
                    recurring: null,
                    completed: false,
                    archived: false,
                    createdAt: Date.now(),
                }}
                onCreateSubtask={onCreateSubtask}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                onUnarchive={vi.fn()}
                onToggleBillable={vi.fn()}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        await user.click(screen.getByRole('button', { name: 'Open subtask form' }));
        await user.click(screen.getByRole('button', { name: 'Fill title' }));
        await user.click(screen.getByRole('button', { name: 'Fill note' }));
        await user.click(screen.getByRole('button', { name: 'Fill date' }));
        await user.click(screen.getByRole('button', { name: 'Submit subtask' }));

        expect(onCreateSubtask).toHaveBeenCalledWith({
            parentTaskId: 'task-1',
            title: 'Subtask A',
            note: 'Subtask note',
            startDate: '2026-02-23',
            recurring: null,
        });
    });
});
