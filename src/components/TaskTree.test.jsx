import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TaskTree from './TaskTree';

const taskTreeMocks = vi.hoisted(() => ({
    isMobileLayout: false,
    tasks: [],
    updateProject: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    deleteEntry: vi.fn(),
    getTimerForProject: vi.fn(() => null),
    clearTimer: vi.fn(),
    showSuccess: vi.fn(),
}));

vi.mock('../hooks/useIsMobileLayout', () => ({
    default: () => taskTreeMocks.isMobileLayout,
}));

vi.mock('../hooks/useToast.ts', () => ({
    useToast: () => ({ showSuccess: taskTreeMocks.showSuccess })
}));

vi.mock('../hooks/useProjects.ts', () => ({
    useProjects: () => ({
        updateProject: taskTreeMocks.updateProject,
    })
}));

vi.mock('../hooks/useTasks.ts', () => ({
    useTasks: () => ({
        tasks: taskTreeMocks.tasks,
        createTask: taskTreeMocks.createTask,
        updateTask: taskTreeMocks.updateTask,
        deleteTask: taskTreeMocks.deleteTask,
    })
}));

vi.mock('../hooks/useTimeEntries.ts', () => ({
    useTimeEntries: () => ({ entries: [], deleteEntry: taskTreeMocks.deleteEntry })
}));

vi.mock('../hooks/useTimers.ts', () => ({
    useTimers: () => ({
        getTimerForProject: taskTreeMocks.getTimerForProject,
        clearTimer: taskTreeMocks.clearTimer,
    })
}));

vi.mock('../hooks/useDayRollover', () => ({
    useTodayString: () => '2026-04-11',
    useTodayDate: () => new Date('2026-04-11T09:00:00Z'),
}));

vi.mock('./TaskItem', () => ({
    default: ({ task, onCreateSubtask, onArchive, onUnarchive }) => (
        <div data-testid={`task-item-${task.id}`}>
            <span data-testid={`task-title-${task.id}`}>{task.title}</span>
            {onCreateSubtask ? (
                <button
                    type="button"
                    onClick={() => onCreateSubtask({
                        parentTaskId: task.id,
                        title: `${task.title} subtask`,
                        note: '',
                        startDate: null,
                        recurring: null,
                    })}
                >
                    Create subtask for {task.title}
                </button>
            ) : null}
            {onArchive ? (
                <button type="button" onClick={onArchive}>
                    Archive {task.title}
                </button>
            ) : null}
            {onUnarchive ? (
                <button type="button" onClick={onUnarchive}>
                    Unarchive {task.title}
                </button>
            ) : null}
        </div>
    )
}));
vi.mock('./task/drag/SortableTaskItem', () => ({
    default: ({ task, onCreateSubtask, onArchive, onUnarchive }) => (
        <div data-testid={`sortable-task-item-${task.id}`}>
            <span data-testid={`task-title-${task.id}`}>{task.title}</span>
            {onCreateSubtask ? (
                <button
                    type="button"
                    onClick={() => onCreateSubtask({
                        parentTaskId: task.id,
                        title: `${task.title} subtask`,
                        note: '',
                        startDate: null,
                        recurring: null,
                    })}
                >
                    Create subtask for {task.title}
                </button>
            ) : null}
            {onArchive ? (
                <button type="button" onClick={onArchive}>
                    Archive {task.title}
                </button>
            ) : null}
            {onUnarchive ? (
                <button type="button" onClick={onUnarchive}>
                    Unarchive {task.title}
                </button>
            ) : null}
        </div>
    )
}));
vi.mock('./task/kanban/TaskKanbanBoard', () => ({
    default: ({ parentTasks = [], dragDisabled = false, onUnarchiveTask = null, onDeleteTask = null, createColumnProps = null }) => (
        <div
            data-testid={`kanban-board-${parentTasks.map((task) => task.id).join('-') || 'empty'}`}
            data-has-unarchive={String(Boolean(onUnarchiveTask))}
            data-has-delete={String(Boolean(onDeleteTask))}
            data-has-create-column={String(Boolean(createColumnProps))}
        >
            Kanban board{dragDisabled ? ' archived' : ''}
        </div>
    )
}));
vi.mock('./Modal', () => ({ default: () => null }));
vi.mock('./task/RecurringPicker', () => ({
    default: ({ onChange }) => (
        <button
            type="button"
            onClick={() => onChange?.({ type: 'weekly', weeklyDays: [1] })}
        >
            Recurring picker
        </button>
    )
}));
vi.mock('./task/DeleteTaskWarnings', () => ({ default: () => <div>Delete warnings</div> }));

describe('TaskTree', () => {
    beforeEach(() => {
        taskTreeMocks.isMobileLayout = false;
        taskTreeMocks.tasks = [];
        taskTreeMocks.createTask.mockReset();
        taskTreeMocks.createTask.mockImplementation((data) => ({ id: data.id || 'created-task', ...data }));
        taskTreeMocks.updateTask.mockReset();
        taskTreeMocks.updateProject.mockReset();
    });

    it('defaults to the list view for parent tasks', () => {
        taskTreeMocks.tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Parent task', parentTaskId: null, archived: false, recurring: null },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        expect(screen.getByTestId('task-item-task-1')).toBeInTheDocument();
        expect(screen.queryByText('Kanban board')).not.toBeInTheDocument();
    });

    it('switches to the Kanban view when requested', () => {
        taskTreeMocks.tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Parent task', parentTaskId: null, archived: false, recurring: null },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Switch to kanban view' }));

        expect(screen.getByText('Kanban board')).toBeInTheDocument();
        expect(screen.queryByText('Task item')).not.toBeInTheDocument();
        expect(taskTreeMocks.updateProject).toHaveBeenCalledWith('project-1', { taskView: 'kanban' });
        expect(screen.queryByRole('combobox', { name: 'Sort tasks' })).not.toBeInTheDocument();
    });

    it('renders the kanban create column for a new empty project', () => {
        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskView: 'kanban' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'New Task' }));

        expect(screen.getByTestId('kanban-board-empty')).toBeInTheDocument();
        expect(screen.getByTestId('kanban-board-empty')).toHaveAttribute('data-has-create-column', 'true');
        expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument();
    });

    it('uses persisted project task view when provided', () => {
        taskTreeMocks.tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Parent task', parentTaskId: null, archived: false, recurring: null },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskView: 'kanban' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        expect(screen.getByText('Kanban board')).toBeInTheDocument();
        expect(screen.queryByText('Task item')).not.toBeInTheDocument();
    });

    it('uses persisted project task sort when provided', () => {
        taskTreeMocks.tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Parent task', parentTaskId: null, archived: false, recurring: null },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskSort: 'manual' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        expect(screen.getByTestId('sortable-task-item-task-1')).toBeInTheDocument();
        expect(screen.queryByTestId('task-item-task-1')).not.toBeInTheDocument();
    });

    it('uses sortable task rows when manual sort is selected in list view', () => {
        taskTreeMocks.tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Parent task', parentTaskId: null, archived: false, recurring: null },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('combobox', { name: 'Sort tasks' }));
        fireEvent.click(screen.getByRole('option', { name: 'Manual' }));

        expect(screen.getByTestId('sortable-task-item-task-1')).toBeInTheDocument();
        expect(screen.queryByTestId('task-item-task-1')).not.toBeInTheDocument();
        expect(taskTreeMocks.updateProject).toHaveBeenCalledWith('project-1', { taskSort: 'manual' });
    });

    it('assigns an explicit manual rank when creating a main task in manual mode', () => {
        taskTreeMocks.tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'First task', parentTaskId: null, archived: false, recurring: null, sortOrder: 1000, lastActive: 100 },
            { id: 'task-2', projectId: 'project-1', title: 'Second task', parentTaskId: null, archived: false, recurring: null, sortOrder: 2000, lastActive: 200 },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskSort: 'manual' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
        fireEvent.change(screen.getByPlaceholderText('Enter task title'), { target: { value: 'New manual task' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        expect(taskTreeMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
            title: 'New manual task',
            parentTaskId: null,
            sortOrder: 3000,
            sortOrderUpdatedAt: expect.any(Number),
        }));
        expect(taskTreeMocks.updateTask).not.toHaveBeenCalled();
    });

    it('includes inline estimate fields when creating a client task', () => {
        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, preferredClientId: 'client-1', flatRate: true }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
        fireEvent.change(screen.getByPlaceholderText('Enter task title'), { target: { value: 'Quoted task' } });
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Estimate' }), { button: 0, ctrlKey: false });
        fireEvent.change(screen.getByLabelText('Estimated Hours'), { target: { value: '3.5' } });
        fireEvent.change(screen.getByLabelText('Quote Amount'), { target: { value: '900' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        expect(taskTreeMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Quoted task',
            estimatedHours: 3.5,
            estimatedFlatAmount: 900,
        }));
    });

    it('does not assign active-list manual rank when creating a recurring task', () => {
        taskTreeMocks.tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'First task', parentTaskId: null, archived: false, recurring: null, sortOrder: 1000, lastActive: 100 },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskSort: 'manual' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
        fireEvent.change(screen.getByPlaceholderText('Enter task title'), { target: { value: 'Recurring task' } });
        fireEvent.click(screen.getByText('Recurring picker'));
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        expect(taskTreeMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Recurring task',
            parentTaskId: null,
            sortOrder: undefined,
            sortOrderUpdatedAt: undefined,
        }));
    });

    it('bootstraps subtask manual order before appending a new subtask', () => {
        taskTreeMocks.tasks = [
            { id: 'parent-1', projectId: 'project-1', title: 'Parent task', parentTaskId: null, archived: false, recurring: null, sortOrder: 1000, lastActive: 50 },
            { id: 'subtask-1', projectId: 'project-1', title: 'Newest subtask', parentTaskId: 'parent-1', archived: false, recurring: null, lastActive: 300 },
            { id: 'subtask-2', projectId: 'project-1', title: 'Older subtask', parentTaskId: 'parent-1', archived: false, recurring: null, lastActive: 100 },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskSort: 'manual' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Create subtask for Parent task' }));

        expect(taskTreeMocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Parent task subtask',
            parentTaskId: 'parent-1',
            sortOrder: 3000,
            sortOrderUpdatedAt: expect.any(Number),
        }));
        expect(taskTreeMocks.updateTask).toHaveBeenCalledWith('subtask-1', expect.objectContaining({
            sortOrder: 1000,
            sortOrderUpdatedAt: expect.any(Number),
        }));
        expect(taskTreeMocks.updateTask).toHaveBeenCalledWith('subtask-2', expect.objectContaining({
            sortOrder: 2000,
            sortOrderUpdatedAt: expect.any(Number),
        }));
        expect(taskTreeMocks.updateTask).toHaveBeenCalledWith('parent-1', expect.objectContaining({
            lastActive: expect.any(Number),
        }));
    });

    it('archives a parent task together with its subtasks', () => {
        taskTreeMocks.tasks = [
            { id: 'parent-1', projectId: 'project-1', title: 'Parent task', parentTaskId: null, archived: false, recurring: null },
            { id: 'child-1', projectId: 'project-1', title: 'Child task', parentTaskId: 'parent-1', archived: false, recurring: null },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Archive Parent task' }));

        expect(taskTreeMocks.updateTask).toHaveBeenCalledWith('parent-1', expect.objectContaining({
            archived: true,
            archivedOnDate: expect.any(String),
        }));
        expect(taskTreeMocks.updateTask).toHaveBeenCalledWith('child-1', expect.objectContaining({
            archived: true,
            archivedOnDate: expect.any(String),
        }));
        expect(taskTreeMocks.showSuccess).toHaveBeenCalledWith('Task and 1 subtask(s) archived successfully');
    });

    it('keeps due recurring tasks on most-recent order when project sort is manual', () => {
        taskTreeMocks.tasks = [
            {
                id: 'recurring-1',
                projectId: 'project-1',
                title: 'Older activity',
                parentTaskId: null,
                archived: false,
                recurring: { type: 'monthly', monthlyType: 'specific', monthlyDay: 11 },
                createdAt: 500,
                lastActive: 100,
            },
            {
                id: 'recurring-2',
                projectId: 'project-1',
                title: 'Newer activity',
                parentTaskId: null,
                archived: false,
                recurring: { type: 'monthly', monthlyType: 'specific', monthlyDay: 11 },
                createdAt: 200,
                lastActive: 300,
            },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskSort: 'manual' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        expect(screen.getAllByTestId(/task-title-/).map((item) => item.textContent)).toEqual([
            'Newer activity',
            'Older activity',
        ]);
    });

    it('keeps archived tasks on most-recent order when project sort is manual', () => {
        taskTreeMocks.tasks = [
            {
                id: 'archived-1',
                projectId: 'project-1',
                title: 'Older activity',
                parentTaskId: null,
                archived: true,
                recurring: null,
                createdAt: 500,
                lastActive: 100,
            },
            {
                id: 'archived-2',
                projectId: 'project-1',
                title: 'Newer activity',
                parentTaskId: null,
                archived: true,
                recurring: null,
                createdAt: 200,
                lastActive: 300,
            },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskSort: 'manual' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Archived Tasks (2)' }));

        expect(screen.getAllByTestId(/task-title-/).map((item) => item.textContent)).toEqual([
            'Newer activity',
            'Older activity',
        ]);
    });

    it('keeps recurring tasks list-rendered while kanban mode is active', () => {
        taskTreeMocks.tasks = [
            {
                id: 'recurring-1',
                projectId: 'project-1',
                title: 'Weekly check-in',
                parentTaskId: null,
                archived: false,
                recurring: { type: 'monthly', monthlyType: 'specific', monthlyDay: 12 },
                createdAt: 100,
                lastActive: 100,
            },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskView: 'kanban' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Recurring Tasks (1)' }));

        expect(screen.getByTestId('task-item-recurring-1')).toBeInTheDocument();
        expect(screen.queryByTestId('kanban-board-recurring-1')).not.toBeInTheDocument();
    });

    it('renders archived parent tasks in a separate kanban section when kanban mode is active', () => {
        taskTreeMocks.tasks = [
            {
                id: 'task-1',
                projectId: 'project-1',
                title: 'Parent task',
                parentTaskId: null,
                archived: false,
                recurring: null,
            },
            {
                id: 'archived-1',
                projectId: 'project-1',
                title: 'Archived parent',
                parentTaskId: null,
                archived: true,
                recurring: null,
            },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskView: 'kanban' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Archived Tasks (1)' }));

        expect(screen.getByTestId('kanban-board-task-1')).toBeInTheDocument();
        expect(screen.getByTestId('kanban-board-archived-1')).toBeInTheDocument();
        expect(screen.queryByTestId('task-item-archived-1')).not.toBeInTheDocument();
    });

    it('passes unarchive and delete handlers into the active kanban board for archived subtasks', () => {
        taskTreeMocks.tasks = [
            {
                id: 'task-1',
                projectId: 'project-1',
                title: 'Parent task',
                parentTaskId: null,
                archived: false,
                recurring: null,
            },
            {
                id: 'archived-subtask-1',
                projectId: 'project-1',
                title: 'Archived subtask',
                parentTaskId: 'task-1',
                archived: true,
                recurring: null,
            },
        ];

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false, taskView: 'kanban' }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        const activeBoard = screen.getByTestId('kanban-board-task-1');

        expect(activeBoard).toHaveAttribute('data-has-unarchive', 'true');
        expect(activeBoard).toHaveAttribute('data-has-delete', 'true');
    });

    it('keeps desktop create actions aligned to the right edge', () => {
        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'New Task' }));

        const actions = screen.getByRole('button', { name: 'Create' }).parentElement;

        expect(actions?.className.includes('ml-auto')).toBe(true);
        expect(Array.from(actions?.children || []).map((item) => item.textContent)).toEqual(['Cancel', 'Create']);
    });

    it('keeps sort and new task controls inline on mobile until they need to wrap', () => {
        taskTreeMocks.isMobileLayout = true;

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        const newTaskButton = screen.getByRole('button', { name: 'New Task' });
        const controlsRow = newTaskButton.parentElement;
        const headerRow = controlsRow?.parentElement;

        expect(controlsRow?.className.includes('gap-3')).toBe(true);
        expect(controlsRow?.className.includes('w-full')).toBe(false);
        expect(headerRow?.className.includes('flex-wrap')).toBe(true);
        expect(headerRow?.className.includes('flex-col')).toBe(false);
    });
});
