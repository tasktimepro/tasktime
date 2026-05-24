import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SubtaskSection from './index';

const hookState = vi.hoisted(() => ({
    tasks: [],
    entries: [],
    timers: [],
    projects: [],
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    deleteEntry: vi.fn(),
    clearTimer: vi.fn(),
    isMobileLayout: false,
}));

vi.mock('../../../hooks/useIsMobileLayout', () => ({
    default: () => hookState.isMobileLayout,
}));

vi.mock('./SubtaskItem', () => ({
    default: ({ task, onArchive, onUnarchive, onDelete }) => (
        <div data-testid="subtask-item">
            <span>{task.title}</span>
            {onArchive && <button type="button" onClick={onArchive}>Archive {task.title}</button>}
            {onUnarchive && <button type="button" onClick={onUnarchive}>Unarchive {task.title}</button>}
            <button type="button" onClick={onDelete}>Delete {task.title}</button>
        </div>
    ),
}));

vi.mock('../drag/SortableSubtaskItem', () => ({
    default: ({ task, onArchive, onUnarchive, onDelete }) => (
        <div data-testid="subtask-item">
            <span>{task.title}</span>
            {onArchive && <button type="button" onClick={onArchive}>Archive {task.title}</button>}
            {onUnarchive && <button type="button" onClick={onUnarchive}>Unarchive {task.title}</button>}
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
        updateTask: hookState.updateTask,
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

vi.mock('../../../hooks/useProjects', () => ({
    useProjects: () => ({
        projects: hookState.projects,
    }),
}));

const renderSubtaskSection = ({ subtasks, showSuccess = vi.fn(), manualSortEnabled = false }) => {
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
            manualSortEnabled={manualSortEnabled}
        />
    );
};

describe('SubtaskSection sorting', () => {
    it('keeps archived subtasks hidden behind a collapsible section', () => {
        hookState.tasks = [];
        hookState.entries = [];
        hookState.timers = [];

        const subtasks = [
            { id: 's1', title: 'Active subtask', completed: false, archived: false, lastActive: 300 },
            { id: 's2', title: 'Archived subtask', completed: true, archived: true, lastActive: 200 },
        ];

        renderSubtaskSection({ subtasks });

        expect(screen.getByText('Active subtask')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Archived Subtasks (1)' })).toBeInTheDocument();
        expect(screen.queryByText('Archived subtask')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Archived Subtasks (1)' }));

        expect(screen.getByText('Archived subtask')).toBeInTheDocument();
    });

    it('archives completed subtasks and unarchives archived subtasks', () => {
        const showSuccess = vi.fn();
        const subtasks = [
            { id: 's1', title: 'Completed subtask', completed: true, archived: false, lastActive: 300 },
            { id: 's2', title: 'Archived subtask', completed: true, archived: true, lastActive: 200 },
        ];

        hookState.tasks = subtasks;
        hookState.entries = [];
        hookState.timers = [];

        renderSubtaskSection({ subtasks, showSuccess });

        fireEvent.click(screen.getByRole('button', { name: 'Archive Completed subtask' }));

        expect(hookState.updateTask).toHaveBeenCalledWith('s1', expect.objectContaining({
            archived: true,
            archivedOnDate: expect.any(String),
        }));
        expect(showSuccess).toHaveBeenCalledWith('Subtask archived');

        fireEvent.click(screen.getByRole('button', { name: 'Archived Subtasks (1)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Unarchive Archived subtask' }));

        expect(hookState.updateTask).toHaveBeenCalledWith('s2', expect.objectContaining({
            archived: false,
            archivedOnDate: null,
        }));
        expect(showSuccess).toHaveBeenCalledWith('Subtask unarchived');
    });

    it('removes extra left indentation for subtasks on mobile', () => {
        hookState.tasks = [];
        hookState.entries = [];
        hookState.timers = [];
        hookState.isMobileLayout = true;

        const subtasks = [
            { id: 's1', title: 'Subtask 1', completed: false, lastActive: 200 },
        ];

        const { container } = renderSubtaskSection({ subtasks });
        const wrapper = container.querySelector('.border-t.border-border');
        const inner = wrapper?.firstElementChild;

        expect(inner?.className.includes('px-2')).toBe(true);
        expect(inner?.className.includes('pl-8')).toBe(false);

        hookState.isMobileLayout = false;
    });

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

    it('shows billed and unbilled warnings for subtask deletion when applicable', () => {
        const subtasks = [
            { id: 's1', title: 'Subtask 1', completed: false, lastActive: 200, billable: true, projectId: 'p1', lastBilledAt: 1000 },
        ];

        hookState.tasks = subtasks;
        hookState.entries = [
            { id: 'e1', taskId: 's1', start: 500, end: 900, billedInvoiceId: 'inv-1' },
            { id: 'e2', taskId: 's1', start: 2000, end: 5600000 },
        ];
        hookState.timers = [];
        hookState.projects = [{ id: 'p1', isPersonal: false }];

        renderSubtaskSection({ subtasks });

        fireEvent.click(screen.getByRole('button', { name: 'Delete Subtask 1' }));

        expect(screen.getByText('This task includes 1.55 unbilled hours.')).toBeInTheDocument();
        expect(screen.getByText('This task includes time that is already recorded on an invoice.')).toBeInTheDocument();
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
            'Active newestArchive Active newestDelete Active newest',
            'Active olderArchive Active olderDelete Active older',
            'Completed recentArchive Completed recentDelete Completed recent',
            'Completed olderArchive Completed olderDelete Completed older',
        ]);
    });

    it('uses manual order for active subtasks when manual sort is enabled', () => {
        hookState.tasks = [];
        hookState.entries = [];
        hookState.timers = [];

        const subtasks = [
            { id: 's1', title: 'Second subtask', completed: false, archived: false, sortOrder: 2000 },
            { id: 's2', title: 'First subtask', completed: false, archived: false, sortOrder: 1000 },
        ];

        renderSubtaskSection({ subtasks, manualSortEnabled: true });

        const renderedTitles = screen.getAllByTestId('subtask-item').map((item) => item.textContent);

        expect(renderedTitles).toEqual([
            'First subtaskArchive First subtaskDelete First subtask',
            'Second subtaskArchive Second subtaskDelete Second subtask',
        ]);
    });
});
