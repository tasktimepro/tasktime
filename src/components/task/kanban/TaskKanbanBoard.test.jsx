import React from 'react';
import { MouseSensor, TouchSensor, useSensor } from '@dnd-kit/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TaskKanbanBoard from './TaskKanbanBoard';

const kanbanMocks = vi.hoisted(() => ({
    updateTask: vi.fn(),
    createEntry: vi.fn(),
    getTimerForTask: vi.fn(() => null),
    clearTimer: vi.fn(),
    projects: [{ id: 'project-1', title: 'Client Work', isPersonal: false }],
    dndContextProps: null,
}));

vi.mock('@dnd-kit/core', async () => {
    const actual = await vi.importActual('@dnd-kit/core');
    return {
        ...actual,
        DndContext: (props) => {
            kanbanMocks.dndContextProps = props;
            return <>{props.children}</>;
        },
        DragOverlay: ({ children }) => <>{children}</>,
        useDroppable: vi.fn(() => ({
            setNodeRef: vi.fn(),
            isOver: false,
        })),
        useSensor: vi.fn(() => ({})),
        useSensors: vi.fn(() => []),
    };
});

vi.mock('@dnd-kit/sortable', async () => {
    const actual = await vi.importActual('@dnd-kit/sortable');
    return {
        ...actual,
        SortableContext: ({ children }) => <>{children}</>,
        useSortable: () => ({
            attributes: { 'data-drag-anchor': 'true' },
            listeners: {},
            setActivatorNodeRef: vi.fn(),
            setNodeRef: vi.fn(),
            transform: null,
            transition: undefined,
            isDragging: false,
        }),
    };
});

vi.mock('@/hooks/useIsMobileLayout', () => ({
    default: () => false,
}));

vi.mock('@/hooks/useTasks', () => ({
    useTasks: () => ({
        updateTask: kanbanMocks.updateTask,
    }),
}));

vi.mock('@/hooks/useTimeEntries', () => ({
    useTimeEntries: () => ({
        createEntry: kanbanMocks.createEntry,
    }),
}));

vi.mock('@/hooks/useTimers', () => ({
    useTimers: () => ({
        getTimerForTask: kanbanMocks.getTimerForTask,
        clearTimer: kanbanMocks.clearTimer,
        timers: [],
        startTimer: vi.fn(),
        pauseTimer: vi.fn(),
        resumeTimer: vi.fn(),
    }),
}));

vi.mock('@/hooks/useProjects', () => ({
    useProjects: () => ({
        projects: kanbanMocks.projects,
    }),
}));

vi.mock('../../TaskTimer', () => ({
    default: () => <div>Task timer</div>,
}));

describe('TaskKanbanBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        kanbanMocks.getTimerForTask.mockReturnValue(null);
        kanbanMocks.dndContextProps = null;
    });

    const parentTask = {
        id: 'parent-1',
        title: 'Planning',
        note: 'Main task note',
        projectId: 'project-1',
        archived: false,
        recurring: null,
        completed: false,
        billable: true,
    };

    const subtasks = [
        {
            id: 'subtask-1',
            title: 'Initial draft',
            note: 'Write the draft',
            projectId: 'project-1',
            parentTaskId: 'parent-1',
            archived: false,
            recurring: null,
            completed: false,
            billable: true,
            lastActive: 20,
        },
        {
            id: 'subtask-2',
            title: 'Review',
            projectId: 'project-1',
            parentTaskId: 'parent-1',
            archived: false,
            recurring: null,
            completed: true,
            billable: false,
            lastActive: 10,
        },
    ];

    it('renders parent task columns and subtask cards', () => {
        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[parentTask, ...subtasks]}
                onCreateSubtask={vi.fn()}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                showBillableBadges={true}
            />
        );

        expect(screen.getByTestId('task-kanban-board')).toBeInTheDocument();
        expect(screen.getByTestId('task-kanban-column-parent-1')).toBeInTheDocument();
        expect(screen.getByTestId('task-kanban-card-subtask-1')).toBeInTheDocument();
        expect(screen.queryByText('Billable')).not.toBeInTheDocument();
    });

    it('opens the task view for columns and cards', () => {
        const onViewTask = vi.fn();

        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[parentTask, ...subtasks]}
                onCreateSubtask={vi.fn()}
                onViewTask={onViewTask}
                onUpdateTask={vi.fn()}
                showBillableBadges={false}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Planning' }));
        fireEvent.click(screen.getByRole('button', { name: 'Initial draft' }));

        expect(onViewTask).toHaveBeenNthCalledWith(1, parentTask, { dateStr: null });
        expect(onViewTask).toHaveBeenNthCalledWith(2, subtasks[0], { dateStr: null });
    });

    it('creates a subtask from a column using the existing create payload shape', () => {
        const onCreateSubtask = vi.fn();

        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[parentTask, ...subtasks]}
                onCreateSubtask={onCreateSubtask}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                showBillableBadges={false}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add subtask' }));
        fireEvent.change(screen.getByPlaceholderText('Enter subtask title'), { target: { value: 'New subtask' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));

        expect(onCreateSubtask).toHaveBeenCalledWith({
            parentTaskId: 'parent-1',
            title: 'New subtask',
            note: '',
            startDate: null,
            recurring: null,
        });
    });

    it('renders a leading create column when the kanban task form is open', () => {
        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[parentTask, ...subtasks]}
                onCreateSubtask={vi.fn()}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                showBillableBadges={false}
                createColumnProps={{
                    newTaskTitle: '',
                    setNewTaskTitle: vi.fn(),
                    newTaskNote: '',
                    setNewTaskNote: vi.fn(),
                    newTaskStartDate: '',
                    setNewTaskStartDate: vi.fn(),
                    newTaskRecurring: null,
                    setNewTaskRecurring: vi.fn(),
                    newTaskEstimatedHours: '',
                    setNewTaskEstimatedHours: vi.fn(),
                    newTaskEstimatedFlatAmount: '',
                    setNewTaskEstimatedFlatAmount: vi.fn(),
                    showEstimateFields: true,
                    isFlatRateProject: true,
                    onSubmit: vi.fn((event) => event.preventDefault()),
                    onCancel: vi.fn(),
                }}
            />
        );

        expect(screen.getByTestId('task-kanban-create-column')).toBeInTheDocument();
        expect(screen.getByLabelText('Estimated Hours')).toBeInTheDocument();
        expect(screen.getByLabelText('Quote Amount')).toBeInTheDocument();
        expect(screen.queryByText('Estimate')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Set repeat' })).toBeInTheDocument();
        expect(screen.getByTestId('task-kanban-create-action-row')).not.toHaveClass('flex-wrap');
    });

    it('does not render an empty-state subtask message for empty columns', () => {
        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[parentTask]}
                onCreateSubtask={vi.fn()}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                showBillableBadges={false}
            />
        );

        expect(screen.queryByText('No subtasks yet.')).not.toBeInTheDocument();
    });

    it('keeps the card drag activator on the handle with touch scrolling disabled there', () => {
        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[parentTask, ...subtasks]}
                onCreateSubtask={vi.fn()}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                showBillableBadges={false}
            />
        );

        const card = screen.getByTestId('task-kanban-card-subtask-1');
        const dragHandle = card.querySelector('[data-drag-anchor="true"]');

        expect(dragHandle).toBeInTheDocument();
        expect(dragHandle).toHaveClass('touch-none');
        expect(card.querySelector(':scope > [data-drag-anchor="true"]')).toBeNull();
    });

    it('registers mouse and touch sensors for kanban drag', () => {
        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[parentTask, ...subtasks]}
                onCreateSubtask={vi.fn()}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                showBillableBadges={false}
            />
        );

        expect(useSensor).toHaveBeenCalledWith(MouseSensor, {
            activationConstraint: {
                distance: 6,
            },
        });
        expect(useSensor).toHaveBeenCalledWith(TouchSensor, {
            activationConstraint: {
                delay: 120,
                tolerance: 8,
            },
        });
    });

    it('shows the archive action for completed tasks instead of a done badge', () => {
        const onArchiveTask = vi.fn();

        render(
            <TaskKanbanBoard
                parentTasks={[{ ...parentTask, completed: true }]}
                tasks={[{ ...parentTask, completed: true }]}
                onCreateSubtask={vi.fn()}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                onArchiveTask={onArchiveTask}
                showBillableBadges={false}
            />
        );

        expect(screen.queryByText('Done')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Archive Task' }));

        expect(onArchiveTask).toHaveBeenCalledWith('parent-1');
    });

    it('keeps archived subtasks in a collapsible section', () => {
        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[
                    parentTask,
                    ...subtasks,
                    {
                        id: 'subtask-archived',
                        title: 'Archived note pass',
                        projectId: 'project-1',
                        parentTaskId: 'parent-1',
                        archived: true,
                        recurring: null,
                        completed: true,
                        billable: false,
                        lastActive: 5,
                    },
                ]}
                onCreateSubtask={vi.fn()}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                onUnarchiveTask={vi.fn()}
                onDeleteTask={vi.fn()}
                showBillableBadges={false}
            />
        );

        expect(screen.getByRole('button', { name: 'Archived Subtasks (1)' })).toBeInTheDocument();
        expect(screen.queryByTestId('task-kanban-card-subtask-archived')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Archived Subtasks (1)' }));

        expect(screen.getByTestId('task-kanban-card-subtask-archived')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Unarchive Subtask' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete Subtask' })).toBeInTheDocument();
    });

    it('keeps archived subtasks collapsed in the column drag overlay', () => {
        render(
            <TaskKanbanBoard
                parentTasks={[parentTask]}
                tasks={[
                    parentTask,
                    ...subtasks,
                    {
                        id: 'subtask-archived',
                        title: 'Archived note pass',
                        projectId: 'project-1',
                        parentTaskId: 'parent-1',
                        archived: true,
                        recurring: null,
                        completed: true,
                        billable: false,
                        lastActive: 5,
                    },
                ]}
                onCreateSubtask={vi.fn()}
                onViewTask={vi.fn()}
                onUpdateTask={vi.fn()}
                onUnarchiveTask={vi.fn()}
                onDeleteTask={vi.fn()}
                showBillableBadges={false}
            />
        );

        act(() => {
            kanbanMocks.dndContextProps.onDragStart({
                active: {
                    id: 'column:parent-1',
                    data: {
                        current: {
                            type: 'column',
                            taskId: 'parent-1',
                        },
                    },
                },
            });
        });

        expect(screen.queryByText('Archived note pass')).not.toBeInTheDocument();
        expect(screen.getAllByText('Archived Subtasks (1)')).toHaveLength(2);
    });
});