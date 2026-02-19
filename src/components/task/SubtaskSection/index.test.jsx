import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SubtaskSection from './index';

const hookState = vi.hoisted(() => ({
    tasks: [],
    entries: [],
    timers: [],
    deleteTask: vi.fn(),
    deleteEntry: vi.fn(),
    clearTimer: vi.fn(),
}));

vi.mock('./SubtaskItem', () => ({
    default: ({ task, onDelete }) => (
        <div data-testid="subtask-item">
            <span>{task.title}</span>
            <button type="button" onClick={onDelete}>Delete {task.title}</button>
        </div>
    ),
}));

vi.mock('./SubtaskCreateForm', () => ({
    default: () => null,
}));

vi.mock('../../Modal', () => ({
    default: ({ isOpen, title, description, footer, children }) => {
        if (!isOpen) return null;

        return (
            <div>
                <h2>{title}</h2>
                <p>{description}</p>
                <div>{children}</div>
                <div>{footer}</div>
            </div>
        );
    },
}));

vi.mock('@/components/ui/notice', () => ({
    Notice: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../hooks/useTasks', () => ({
    useTasks: () => ({
        tasks: hookState.tasks,
        deleteTask: hookState.deleteTask,
    }),
}));

vi.mock('../../../hooks/useTimeEntries', () => ({
    useTimeEntries: () => ({
        entries: hookState.entries,
        deleteEntry: hookState.deleteEntry,
    }),
}));

vi.mock('../../../hooks/useTimers', () => ({
    useTimers: () => ({
        timers: hookState.timers,
        clearTimer: hookState.clearTimer,
    }),
}));

const renderSubtaskSection = ({ subtasks, showSuccess = vi.fn() }) => {
    return render(
        <SubtaskSection
            subtasks={subtasks}
            task={{ id: 'parent-1', completed: false }}
            onToggleBillable={vi.fn()}
            onCreateSubtask={undefined}
            showCreateSubtaskForm={false}
            setShowCreateSubtaskForm={vi.fn()}
            newSubtaskTitle=""
            setNewSubtaskTitle={vi.fn()}
            newSubtaskStartDate=""
            setNewSubtaskStartDate={vi.fn()}
            handleCreateSubtask={vi.fn()}
            cancelCreateSubtask={vi.fn()}
            isArchived={false}
            anyTimerActive={false}
            isRelatedToActiveTimer={false}
            showSuccess={showSuccess}
            onEditTask={vi.fn()}
            onViewTask={vi.fn()}
        />
    );
};

describe('SubtaskSection sorting', () => {
    it('opens a confirmation modal for subtask delete and only deletes on confirm', () => {
        const showSuccess = vi.fn();
        const subtasks = [
            { id: 's1', title: 'Subtask 1', completed: false, lastActive: 200 },
        ];

        hookState.tasks = subtasks;
        hookState.entries = [
            { id: 'e1', taskId: 's1' },
            { id: 'e2', taskId: 'other' },
        ];
        hookState.timers = [
            { taskId: 's1', projectId: 'p1' },
        ];

        renderSubtaskSection({ subtasks, showSuccess });

        fireEvent.click(screen.getByRole('button', { name: 'Delete Subtask 1' }));

        expect(screen.getByText('Delete task?')).toBeInTheDocument();
        expect(screen.getByText('Deleting "Subtask 1" cannot be undone.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(hookState.deleteTask).not.toHaveBeenCalled();
        expect(screen.queryByText('Delete task?')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Delete Subtask 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(hookState.deleteEntry).toHaveBeenCalledWith('e1');
        expect(hookState.deleteEntry).not.toHaveBeenCalledWith('e2');
        expect(hookState.clearTimer).toHaveBeenCalledWith('p1');
        expect(hookState.deleteTask).toHaveBeenCalledWith('s1');
        expect(showSuccess).toHaveBeenCalledWith('Subtask "Subtask 1" deleted successfully');
    });

    it('sorts subtasks by lastActive descending and places completed at the bottom', () => {
        hookState.tasks = [];
        hookState.entries = [];
        hookState.timers = [];

        const subtasks = [
            { id: 's1', title: 'Completed recent', completed: true, lastActive: 300 },
            { id: 's2', title: 'Active older', completed: false, lastActive: 100 },
            { id: 's3', title: 'Active newest', completed: false, lastActive: 400 },
            { id: 's4', title: 'Completed older', completed: true, lastActive: 200 },
        ];

        renderSubtaskSection({ subtasks });

        const renderedTitles = screen.getAllByTestId('subtask-item').map((item) => item.textContent);

        expect(renderedTitles).toEqual([
            'Active newestDelete Active newest',
            'Active olderDelete Active older',
            'Completed recentDelete Completed recent',
            'Completed olderDelete Completed older',
        ]);
    });
});
