import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskItem from './TaskItem';

const hookState = vi.hoisted(() => ({
    tasks: [],
    projects: [],
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
    default: () => <div data-testid="task-start-date" />,
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

vi.mock('../hooks/useProjects', () => ({
    useProjects: () => ({
        projects: hookState.projects,
    }),
}));

vi.mock('../hooks/useTimers', () => ({
    useTimers: () => ({
        getTimerForTask: hookState.getTimerForTask,
        clearTimer: hookState.clearTimer,
    }),
}));

describe('TaskItem subtask creation', () => {
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
        });
    };

    it('includes note in onCreateSubtask payload', async () => {
        setMatchMedia(false);
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

    it('uses a right-aligned secondary row on mobile', () => {
        setMatchMedia(true);
        hookState.tasks = [];
        hookState.entries = [{ taskId: 'task-2', start: 0, end: 7200000 }];
        hookState.getTimerForTask.mockReturnValue(null);

        render(
            <TaskItem
                task={{
                    id: 'task-2',
                    projectId: 'project-1',
                    title: 'Mobile task row',
                    recurring: null,
                    startDate: '2026-03-24',
                    completed: false,
                    archived: false,
                    createdAt: Date.now(),
                }}
                onCreateSubtask={vi.fn()}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                onUnarchive={vi.fn()}
                onToggleBillable={vi.fn()}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        const secondaryRow = screen.getByTestId('task-item-secondary-task-2');

        expect(secondaryRow.className.includes('w-full')).toBe(true);
        expect(secondaryRow.className.includes('justify-end')).toBe(true);
        expect(screen.getByTestId('task-start-date')).toBeInTheDocument();
        expect(screen.getByText('2h')).toBeInTheDocument();
        expect(screen.getByTestId('task-actions')).toBeInTheDocument();
    });
});
