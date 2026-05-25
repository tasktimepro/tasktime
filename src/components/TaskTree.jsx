import React, { useState, useCallback, useMemo } from 'react';
import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DocumentCheckIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon, SortIcon, LayoutListIcon, KanbanIcon, GripVerticalIcon } from '@/components/ui/icons';
import TaskItem from './TaskItem';
import SortableTaskItem from './task/drag/SortableTaskItem';
import TaskKanbanBoard from './task/kanban/TaskKanbanBoard';
import SubtaskItem from './task/SubtaskSection/SubtaskItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Notice } from '@/components/ui/notice';
import Modal from './Modal';
import RecurringPicker from './task/RecurringPicker';
import { useToast } from '../hooks/useToast.ts';
import { useProjects } from '../hooks/useProjects.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useTimers } from '../hooks/useTimers.ts';
import DeleteTaskWarnings from './task/DeleteTaskWarnings';
import { getTaskDeletionBillingSummary, getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { SORT_OPTIONS, sortItems } from '../utils/sortUtils.ts';
import { buildTaskAppendOrderPlan, buildTaskContainerMoveOrderUpdates, buildTaskMoveOrderUpdates, reorderTaskItems, sortTasksByManualOrder } from '../utils/taskOrderingUtils.ts';
import { isRecurringTaskDueOnDate } from '../utils/recurringUtils.ts';
import { useTodayDate, useTodayString } from '../hooks/useDayRollover';
import { toStorageDate } from '../utils/dateUtils.ts';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';

const TASK_SORT_OPTIONS = [
    ...SORT_OPTIONS,
    { value: 'manual', label: 'Manual' },
];
const TASK_SORT_VALUES = new Set(TASK_SORT_OPTIONS.map((option) => option.value));

const getProjectTaskSort = (taskSort) => {
    return TASK_SORT_VALUES.has(taskSort) ? taskSort : 'lastActive';
};

const getDroppableContainersByType = (args, typeMatcher) => {
    return args.droppableContainers.filter((container) => {
        return typeMatcher(container.data.current || null);
    });
};

const getPointerCollisionsByType = (args, typeMatcher) => {
    const droppableContainers = getDroppableContainersByType(args, typeMatcher);

    if (droppableContainers.length === 0) {
        return [];
    }

    return pointerWithin({
        ...args,
        droppableContainers,
    });
};

const getClosestCollisionsByType = (args, typeMatcher, fallbackCollisionDetection = closestCenter) => {
    const droppableContainers = getDroppableContainersByType(args, typeMatcher);

    if (droppableContainers.length === 0) {
        return [];
    }

    const narrowedArgs = {
        ...args,
        droppableContainers,
    };

    return fallbackCollisionDetection(narrowedArgs);
};

const taskListCollisionDetection = (args) => {
    const activeType = args.active.data.current?.type;

    if (activeType === 'subtask') {
        const subtaskPointerCollisions = getPointerCollisionsByType(args, (data) => data?.type === 'subtask');

        if (subtaskPointerCollisions.length > 0) {
            return subtaskPointerCollisions;
        }

        const containerPointerCollisions = getPointerCollisionsByType(args, (data) => data?.type === 'subtask-container' || data?.type === 'task');

        if (containerPointerCollisions.length > 0) {
            return containerPointerCollisions;
        }

        const subtaskCollisions = getClosestCollisionsByType(args, (data) => data?.type === 'subtask');

        if (subtaskCollisions.length > 0) {
            return subtaskCollisions;
        }

        const containerCollisions = getClosestCollisionsByType(args, (data) => data?.type === 'subtask-container' || data?.type === 'task');

        return containerCollisions.length > 0 ? containerCollisions : closestCenter(args);
    }

    if (activeType === 'task') {
        const taskCollisions = getClosestCollisionsByType(args, (data) => data?.type === 'task');

        return taskCollisions.length > 0 ? taskCollisions : closestCenter(args);
    }

    return closestCenter(args);
};

/**
 * TaskTree component - Displays and manages the hierarchical task structure
 * Uses Yjs hooks directly for state management
 */
const TaskTree = ({
    project,
    onEditTask,
    onViewTask
}) => {
    const isMobileLayout = useIsMobileLayout();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskNote, setNewTaskNote] = useState('');
    const [newTaskStartDate, setNewTaskStartDate] = useState('');
    const [newTaskRecurring, setNewTaskRecurring] = useState(null);
    const [showRecurringTasks, setShowRecurringTasks] = useState(false);
    const [showArchivedTasks, setShowArchivedTasks] = useState(false);
    const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState(null);
    const [taskSort, setTaskSort] = useState(() => getProjectTaskSort(project.taskSort));
    const { showSuccess } = useToast();
    const { updateProject } = useProjects();
    const [taskDisplay, setTaskDisplay] = useState(project.taskView === 'kanban' ? 'kanban' : 'list');
    const [activeTaskDragId, setActiveTaskDragId] = useState(null);
    const [activeTaskDragWidth, setActiveTaskDragWidth] = useState(null);
    const [subtaskDragPreview, setSubtaskDragPreview] = useState(null);
    
    // Yjs hooks for state
    const { tasks, createTask, updateTask, deleteTask } = useTasks({ projectId: project.id });
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { getTimerForProject, clearTimer } = useTimers();
    const todayStr = useTodayString();
    const todayDate = useTodayDate();
    const taskListSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const allowBillableToggle = !project.isPersonal;

    React.useEffect(() => {
        setTaskDisplay(project.taskView === 'kanban' ? 'kanban' : 'list');
    }, [project.id, project.taskView]);

    React.useEffect(() => {
        setTaskSort(getProjectTaskSort(project.taskSort));
    }, [project.id, project.taskSort]);

    // Get tasks for this project
    const projectTasks = tasks.filter(task => task.projectId === project.id);

    // Get parent tasks (tasks without parentTaskId) that are not archived or recurring
    const parentTasks = projectTasks.filter(task => !task.parentTaskId && !task.archived && !task.recurring);

    // Get recurring parent tasks (non-archived)
    const recurringTasks = projectTasks.filter(task => !task.parentTaskId && !task.archived && task.recurring);

    // Get archived parent tasks
    const archivedTasks = projectTasks.filter(task => !task.parentTaskId && task.archived);

    const visibleTasksCount = useMemo(() => {

        return projectTasks.filter(task => !task.completed && !task.archived).length;
    }, [projectTasks]);
    const secondaryTaskSort = taskSort === 'manual' ? 'lastActive' : taskSort;

    const activeSubtaskDragTask = useMemo(() => {
        if (!subtaskDragPreview?.taskId) {
            return null;
        }

        return projectTasks.find((task) => task.id === subtaskDragPreview.taskId) || null;
    }, [projectTasks, subtaskDragPreview]);

    const activeTaskDragTask = useMemo(() => {
        if (!activeTaskDragId) {
            return null;
        }

        return projectTasks.find((task) => task.id === activeTaskDragId) || null;
    }, [activeTaskDragId, projectTasks]);

    const sortedParentTasks = useMemo(() => {
        if (taskSort === 'manual') {
            return sortTasksByManualOrder(parentTasks, 'lastActive');
        }

        return sortItems({
            items: parentTasks,
            sortBy: taskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [parentTasks, taskSort]);

    const sortedArchivedTasks = useMemo(() => {

        return sortItems({
            items: archivedTasks,
            sortBy: secondaryTaskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [archivedTasks, secondaryTaskSort]);

    const sortedRecurringTasks = useMemo(() => {

        return sortItems({
            items: recurringTasks,
            sortBy: secondaryTaskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [recurringTasks, secondaryTaskSort]);

    const dueTodayRecurringTasks = useMemo(() => {
        if (!todayStr) return [];

        const due = recurringTasks.filter(task => isRecurringTaskDueOnDate(todayDate, task.recurring));
        return sortItems({
            items: due,
            sortBy: secondaryTaskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [recurringTasks, secondaryTaskSort, todayDate, todayStr]);

    const remainingRecurringTasks = useMemo(() => {
        if (!todayStr) return sortedRecurringTasks;
        const dueTodayIds = new Set(dueTodayRecurringTasks.map(task => task.id));
        return sortedRecurringTasks.filter(task => !dueTodayIds.has(task.id));
    }, [sortedRecurringTasks, dueTodayRecurringTasks, todayStr]);

    const handleParentTaskDragEnd = useCallback((event) => {
        const { active, over } = event;

        if (!over) return;

        const activeId = typeof active.id === 'string' ? active.id.replace('task:', '') : null;
        const overId = typeof over.id === 'string' ? over.id.replace('task:', '') : null;

        if (!activeId || !overId || activeId === overId) return;

        const updates = buildTaskMoveOrderUpdates(
            reorderTaskItems(sortedParentTasks, activeId, overId),
            activeId
        );

        updates.forEach((update) => {
            updateTask(update.id, {
                sortOrder: update.sortOrder,
                sortOrderUpdatedAt: update.sortOrderUpdatedAt,
            });
        });
    }, [sortedParentTasks, updateTask]);

    const handleTaskListDragEnd = useCallback((event) => {
        const { active, over } = event;

        if (!over) {
            setActiveTaskDragId(null);
            setActiveTaskDragWidth(null);
            setSubtaskDragPreview(null);
            return;
        }

        const activeData = active.data.current || null;
        const overData = over.data.current || null;

        if (activeData?.type === 'task') {
            if (overData?.type !== 'task') {
                setActiveTaskDragId(null);
                setActiveTaskDragWidth(null);
                setSubtaskDragPreview(null);
                return;
            }

            handleParentTaskDragEnd(event);
            setActiveTaskDragId(null);
            setActiveTaskDragWidth(null);
            setSubtaskDragPreview(null);
            return;
        }

        if (activeData?.type !== 'subtask') {
            setActiveTaskDragId(null);
            setActiveTaskDragWidth(null);
            setSubtaskDragPreview(null);
            return;
        }

        const activeId = activeData.taskId || (typeof active.id === 'string' ? active.id.replace('subtask:', '') : null);
        const sourceParentTaskId = activeData.parentTaskId || null;

        const destinationParentTaskId = overData?.type === 'subtask'
            ? (overData.parentTaskId || null)
            : overData?.type === 'subtask-container'
                ? (overData.parentTaskId || null)
                : overData?.type === 'task'
                    ? (overData.taskId || null)
                    : null;

        if (!activeId || !sourceParentTaskId || !destinationParentTaskId) {
            setActiveTaskDragId(null);
            setActiveTaskDragWidth(null);
            setSubtaskDragPreview(null);
            return;
        }

        const sourceSubtasks = sortTasksByManualOrder(
            projectTasks.filter((candidate) => candidate.parentTaskId === sourceParentTaskId && !candidate.archived),
            'lastActive'
        );
        const destinationSubtasks = sourceParentTaskId === destinationParentTaskId
            ? sourceSubtasks
            : sortTasksByManualOrder(
                projectTasks.filter((candidate) => candidate.parentTaskId === destinationParentTaskId && !candidate.archived),
                'lastActive'
            );
        const overSubtaskId = overData?.type === 'subtask'
            ? (overData.taskId || null)
            : null;

        const updates = buildTaskContainerMoveOrderUpdates(
            sourceSubtasks,
            destinationSubtasks,
            activeId,
            overSubtaskId
        );

        if (updates.length === 0 && sourceParentTaskId !== destinationParentTaskId) {
            updateTask(activeId, {
                parentTaskId: destinationParentTaskId,
            });
            setActiveTaskDragId(null);
            setActiveTaskDragWidth(null);
            setSubtaskDragPreview(null);
            return;
        }

        updates.forEach((update) => {
            updateTask(update.id, {
                sortOrder: update.sortOrder,
                sortOrderUpdatedAt: update.sortOrderUpdatedAt,
                ...(update.id === activeId && sourceParentTaskId !== destinationParentTaskId
                    ? { parentTaskId: destinationParentTaskId }
                    : {}),
            });
        });
        setActiveTaskDragId(null);
        setActiveTaskDragWidth(null);
        setSubtaskDragPreview(null);
    }, [handleParentTaskDragEnd, projectTasks, updateTask]);

    const handleTaskListDragStart = useCallback((event) => {
        const activeData = event.active.data.current || null;

        if (activeData?.type === 'task') {
            setActiveTaskDragId(activeData.taskId || (typeof event.active.id === 'string' ? event.active.id.replace('task:', '') : null));
            setActiveTaskDragWidth(activeData.getOverlayRect?.()?.width || event.active.rect.current.initial?.width || null);
            setSubtaskDragPreview(null);
            return;
        }

        if (activeData?.type !== 'subtask') {
            setActiveTaskDragId(null);
            setActiveTaskDragWidth(null);
            setSubtaskDragPreview(null);
            return;
        }

        setActiveTaskDragId(null);
        setActiveTaskDragWidth(null);
        const taskId = activeData.taskId || (typeof event.active.id === 'string' ? event.active.id.replace('subtask:', '') : null);
        const activeTask = projectTasks.find((task) => task.id === taskId) || null;

        setSubtaskDragPreview({
            taskId,
            title: activeTask?.title || 'Subtask',
            sourceParentTaskId: activeData.parentTaskId || null,
            destinationParentTaskId: null,
            overTaskId: null,
        });
    }, [projectTasks]);

    const handleTaskListDragOver = useCallback((event) => {
        const activeData = event.active.data.current || null;

        if (activeData?.type !== 'subtask') {
            return;
        }

        if (!event.over) {
            setSubtaskDragPreview((current) => current ? {
                ...current,
                destinationParentTaskId: null,
                overTaskId: null,
            } : null);
            return;
        }

        const overData = event.over.data.current || null;
        const destinationParentTaskId = overData?.type === 'subtask'
            ? (overData.parentTaskId || null)
            : overData?.type === 'subtask-container'
                ? (overData.parentTaskId || null)
                : overData?.type === 'task'
                    ? (overData.taskId || null)
                    : null;

        setSubtaskDragPreview((current) => current ? {
            ...current,
            destinationParentTaskId,
            overTaskId: overData?.type === 'subtask'
                ? (overData.taskId || null)
                : null,
        } : null);
    }, []);

    const handleTaskListDragCancel = useCallback(() => {
        setActiveTaskDragId(null);
        setActiveTaskDragWidth(null);
        setSubtaskDragPreview(null);
    }, []);

    const handleTaskSortChange = useCallback((nextSort) => {
        setTaskSort(nextSort);
        updateProject(project.id, {
            taskSort: nextSort,
        });
    }, [project.id, updateProject]);

    const handleToggleTaskDisplay = useCallback(() => {
        const nextDisplay = taskDisplay === 'kanban' ? 'list' : 'kanban';

        setTaskDisplay(nextDisplay);
        updateProject(project.id, {
            taskView: nextDisplay,
        });
    }, [project.id, taskDisplay, updateProject]);


    const pendingDeleteTask = pendingDeleteTaskId
        ? tasks.find(task => task.id === pendingDeleteTaskId)
        : null;

    const pendingDeleteTaskIds = useMemo(() => {
        if (!pendingDeleteTaskId || !pendingDeleteTask) {
            return [];
        }

        return pendingDeleteTask.parentTaskId
            ? [pendingDeleteTaskId]
            : getTaskIdsToDelete(pendingDeleteTaskId, tasks);
    }, [pendingDeleteTaskId, pendingDeleteTask, tasks]);

    const deleteBillingSummary = useMemo(() => {
        return getTaskDeletionBillingSummary(pendingDeleteTaskIds, tasks, timeEntries, [project]);
    }, [pendingDeleteTaskIds, tasks, timeEntries, project]);

    /**
     * Create a new task
     */
    const handleCreateTask = useCallback((taskData) => {
        const now = Date.now();
        const parentTaskId = taskData.parentTaskId || null;
        const trimmedTitle = taskData.title.trim();
        const shouldAssignManualOrder = taskSort === 'manual' && (parentTaskId || !taskData.recurring);
        const manualScopeTasks = parentTaskId
            ? projectTasks.filter((task) => task.parentTaskId === parentTaskId && !task.archived)
            : projectTasks.filter((task) => !task.parentTaskId && !task.archived && !task.recurring);
        const appendOrderPlan = shouldAssignManualOrder
            ? buildTaskAppendOrderPlan(manualScopeTasks, {
                id: `__new-task__:${now}`,
                title: trimmedTitle,
                createdAt: now,
                lastActive: now,
            }, 'lastActive', now)
            : null;
        const newTask = createTask({
            projectId: project.id,
            parentTaskId,
            title: trimmedTitle,
            note: taskData.note ? taskData.note.trim() : null,
            startDate: taskData.recurring ? null : (taskData.startDate || null),
            recurring: taskData.recurring || null,
            lastActive: now,
            lastBilledAt: null,
            billable: false,
            billableSetByUser: false,
            sortOrder: appendOrderPlan?.newItemSortOrder,
            sortOrderUpdatedAt: appendOrderPlan?.newItemSortOrderUpdatedAt,
        });

        appendOrderPlan?.existingUpdates.forEach((update) => {
            updateTask(update.id, {
                sortOrder: update.sortOrder,
                sortOrderUpdatedAt: update.sortOrderUpdatedAt,
            });
        });

        // If this is a subtask, also update the parent task's lastActive
        if (parentTaskId) {
            updateTask(parentTaskId, { lastActive: now });
        }
        
        return newTask;
    }, [createTask, project.id, projectTasks, taskSort, updateTask]);

    /**
     * Create a new main task
     */
    const handleCreateMainTask = (e) => {
        e.preventDefault();

        if (!newTaskTitle.trim()) return;

        handleCreateTask({
            parentTaskId: null,
            title: newTaskTitle,
            note: newTaskNote,
            startDate: newTaskStartDate,
            recurring: newTaskRecurring
        });

        if (newTaskRecurring) {
            setShowRecurringTasks(true);
        }

        setNewTaskTitle('');
        setNewTaskNote('');
        setNewTaskStartDate('');
        setNewTaskRecurring(null);
        setShowCreateForm(false);
    };

    /**
     * Archive a task
     */
    const handleArchiveTask = useCallback((taskId) => {
        updateTask(taskId, {
            archived: true,
            archivedOnDate: toStorageDate(new Date()),
            lastActive: Date.now()
        });
    }, [updateTask]);

    /**
     * Unarchive a task
     */
    const handleUnarchiveTask = useCallback((taskId) => {
        updateTask(taskId, {
            archived: false,
            archivedOnDate: null,
            lastActive: Date.now()
        });
    }, [updateTask]);

    /**
     * Toggle billable status for a task
     */
    const handleToggleBillable = useCallback((taskId) => {
        const targetTask = tasks.find(task => task.id === taskId);
        if (!targetTask) return;
        
        const newBillableStatus = targetTask.billable !== true;
        
        updateTask(taskId, {
            billable: newBillableStatus,
            billableSetByUser: true,
            lastActive: Date.now()
        });
        
        showSuccess(`Task marked as ${newBillableStatus ? 'billable' : 'not billable'}`);
    }, [tasks, updateTask, showSuccess]);

    /**
     * Delete a task and its subtasks
     */
    const handleDeleteTask = (taskId) => {
        setPendingDeleteTaskId(taskId);
    };

    const closeDeleteTaskModal = () => {
        setPendingDeleteTaskId(null);
    };

    const confirmDeleteTask = useCallback(() => {
        if (!pendingDeleteTaskId) return;

        const taskToDelete = tasks.find(t => t.id === pendingDeleteTaskId);
        const taskTitle = taskToDelete?.title || 'Task';
        const isMainTask = !!(taskToDelete && !taskToDelete.parentTaskId);

        // Get all task IDs to delete (including subtasks for main tasks)
        const taskIdsToDelete = isMainTask 
            ? getTaskIdsToDelete(pendingDeleteTaskId, tasks)
            : [pendingDeleteTaskId];

        // Delete time entries for these tasks
        const entriesToDelete = timeEntries.filter(entry => 
            taskIdsToDelete.includes(entry.taskId)
        );
        entriesToDelete.forEach(entry => deleteEntry(entry.id));

        // Clear timer if it's for one of these tasks
        const projectTimer = getTimerForProject(project.id);
        if (projectTimer && taskIdsToDelete.includes(projectTimer.taskId)) {
            clearTimer(project.id);
        }

        // Delete tasks
        taskIdsToDelete.forEach(id => deleteTask(id));

        // Show success message
        const message = isMainTask && taskIdsToDelete.length > 1
            ? `Task "${taskTitle}" and ${taskIdsToDelete.length - 1} subtask(s) deleted successfully`
            : `Task "${taskTitle}" deleted successfully`;
        
        showSuccess(message);
        setPendingDeleteTaskId(null);
    }, [pendingDeleteTaskId, tasks, timeEntries, project.id, getTimerForProject, deleteEntry, clearTimer, deleteTask, showSuccess]);

    /**
     * Start creating a subtask for a parent task
     */
    // const startCreatingSubtask = (parentTaskId) => {
        // This will now be handled by the TaskItem component
        // No need to set global state
    // };

    /**
     * Cancel task creation
     */
    const cancelCreate = () => {
        setShowCreateForm(false);
        setNewTaskTitle('');
        setNewTaskNote('');
        setNewTaskStartDate('');
        setNewTaskRecurring(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="min-w-0 flex-1 text-lg font-semibold text-foreground">
                    Tasks ({visibleTasksCount})
                </h3>

                <div className="flex shrink-0 items-center gap-3">
                    {taskDisplay === 'list' ? (
                        <Select value={taskSort} onValueChange={handleTaskSortChange}>
                            <SelectTrigger
                                className="h-9 w-9"
                                aria-label="Sort tasks"
                                leadingIcon={SortIcon}
                                hideCaret
                                iconOnly
                            >
                                <span className="sr-only">
                                    <SelectValue placeholder="Sort by" />
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                {TASK_SORT_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : null}

                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        leadingIcon={taskDisplay === 'kanban' ? LayoutListIcon : KanbanIcon}
                        iconOnly
                        aria-label={taskDisplay === 'kanban' ? 'Switch to list view' : 'Switch to kanban view'}
                        title={taskDisplay === 'kanban' ? 'Switch to list view' : 'Switch to kanban view'}
                        onClick={handleToggleTaskDisplay}
                    />

                    {!showCreateForm && (
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateForm(true)}
                            leadingIcon={PlusIcon}
                        >
                            New Task
                        </Button>
                    )}
                </div>
            </div>

            {/* Create Task Form */}
            {showCreateForm && taskDisplay === 'list' && (
                <div className={cn('rounded-lg border border-border bg-card', isMobileLayout ? 'p-3' : 'p-4')}>
                    <h3 className="text-sm font-medium text-foreground mb-3">
                        Create New Task
                    </h3>

                    <form onSubmit={handleCreateMainTask} className={cn(isMobileLayout ? 'space-y-3' : 'flex items-center space-x-3')}>
                        <Input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Enter task title"
                            className={cn(!isMobileLayout && 'flex-1')}
                            autoFocus
                        />

                        <Input
                            type="text"
                            value={newTaskNote}
                            onChange={(e) => setNewTaskNote(e.target.value)}
                            placeholder="Note"
                            className={cn(!isMobileLayout && 'flex-1')}
                        />

                        <NativeDateInput
                            value={newTaskStartDate}
                            onChange={(e) => {
                                setNewTaskStartDate(e.target.value);
                                if (e.target.value) {
                                    setNewTaskRecurring(null);
                                }
                            }}
                            className={cn(isMobileLayout ? 'w-full dark:[color-scheme:dark]' : 'w-40 dark:[color-scheme:dark]')}
                            disabled={Boolean(newTaskRecurring)}
                        />

                        <RecurringPicker
                            value={newTaskRecurring}
                            onChange={(config) => {
                                setNewTaskRecurring(config);
                                setNewTaskStartDate('');
                            }}
                            onClear={() => setNewTaskRecurring(null)}
                            inactiveVariant="ghost"
                        />

                        <div className={cn('flex gap-2', isMobileLayout ? 'justify-end' : 'ml-auto shrink-0')}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cancelCreate}
                            >
                                Cancel
                            </Button>

                            <Button type="submit">
                                Create
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tasks List */}
            {parentTasks.length === 0 && recurringTasks.length === 0 && archivedTasks.length === 0 && !(taskDisplay === 'kanban' && showCreateForm) ? (
                <EmptyState
                    icon={DocumentCheckIcon}
                    title="No tasks yet"
                    description="Get started by creating your first task."
                    className="py-8"
                />
            ) : (
                <>
                    {/* Active Tasks */}
                    {dueTodayRecurringTasks.length > 0 && (
                        <div className="space-y-4">
                            {dueTodayRecurringTasks.map((task) => (
                                <TaskItem
                                    key={task.id}
                                    task={task}
                                    recurringCompletionDate={todayStr}
                                    onDelete={() => handleDeleteTask(task.id)}
                                    onCreateSubtask={null}
                                    onArchive={() => handleArchiveTask(task.id)}
                                    onUnarchive={() => handleUnarchiveTask(task.id)}
                                    onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
                                    onEditTask={onEditTask}
                                    onViewTask={onViewTask}
                                />
                            ))}
                        </div>
                    )}

                    {sortedParentTasks.length > 0 && taskDisplay === 'list' && (
                        taskSort === 'manual' ? (
                            <DndContext
                                sensors={taskListSensors}
                                collisionDetection={taskListCollisionDetection}
                                onDragStart={handleTaskListDragStart}
                                onDragOver={handleTaskListDragOver}
                                onDragCancel={handleTaskListDragCancel}
                                onDragEnd={handleTaskListDragEnd}
                            >
                                <SortableContext items={sortedParentTasks.map((task) => `task:${task.id}`)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-4">
                                        {sortedParentTasks.map((task) => (
                                            <SortableTaskItem
                                                key={task.id}
                                                task={task}
                                                onDelete={() => handleDeleteTask(task.id)}
                                                onCreateSubtask={handleCreateTask}
                                                onArchive={() => handleArchiveTask(task.id)}
                                                onUnarchive={() => handleUnarchiveTask(task.id)}
                                                onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
                                                onEditTask={onEditTask}
                                                onViewTask={onViewTask}
                                                subtaskDragPreview={subtaskDragPreview}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>

                                <DragOverlay>
                                    {activeTaskDragTask ? (
                                        <div
                                            className="w-[min(56rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] pointer-events-none"
                                            style={{ width: activeTaskDragWidth ? `${activeTaskDragWidth}px` : undefined }}
                                        >
                                            <TaskItem
                                                task={activeTaskDragTask}
                                                onDelete={() => {}}
                                                onCreateSubtask={handleCreateTask}
                                                onArchive={() => {}}
                                                onUnarchive={() => {}}
                                                onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
                                                onEditTask={() => {}}
                                                onViewTask={() => {}}
                                                showDecorativeSubtaskDragHandles={true}
                                                dragHandle={(
                                                    <span aria-hidden="true" className="inline-flex h-8 shrink-0 items-center justify-center text-muted-foreground">
                                                        <GripVerticalIcon className="h-4 w-4" />
                                                    </span>
                                                )}
                                            />
                                        </div>
                                    ) : activeSubtaskDragTask ? (
                                        <div className="w-[min(40rem,calc(100vw-2rem))] rounded-md bg-card shadow-xl pointer-events-none">
                                            <SubtaskItem
                                                task={activeSubtaskDragTask}
                                                onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
                                                onArchive={() => {}}
                                                onDelete={() => {}}
                                                onEditTask={() => {}}
                                                onViewTask={() => {}}
                                                dragHandle={(
                                                    <span aria-hidden="true" className="inline-flex h-8 shrink-0 items-center justify-center text-muted-foreground">
                                                        <GripVerticalIcon className="h-4 w-4" />
                                                    </span>
                                                )}
                                            />
                                        </div>
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        ) : (
                            <div className="space-y-4">
                                {sortedParentTasks.map((task) => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        onDelete={() => handleDeleteTask(task.id)}
                                        onCreateSubtask={handleCreateTask}
                                        onArchive={() => handleArchiveTask(task.id)}
                                        onUnarchive={() => handleUnarchiveTask(task.id)}
                                        onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
                                        onEditTask={onEditTask}
                                        onViewTask={onViewTask}
                                    />
                                ))}
                            </div>
                        )
                    )}

                    {(sortedParentTasks.length > 0 || showCreateForm) && taskDisplay === 'kanban' && (
                        <TaskKanbanBoard
                            parentTasks={sortedParentTasks}
                            tasks={projectTasks}
                            onCreateSubtask={handleCreateTask}
                            onViewTask={onViewTask}
                            onUpdateTask={updateTask}
                            onArchiveTask={handleArchiveTask}
                            onUnarchiveTask={handleUnarchiveTask}
                            onDeleteTask={handleDeleteTask}
                            showBillableBadges={allowBillableToggle}
                            fallbackSortBy={secondaryTaskSort}
                            createColumnProps={showCreateForm ? {
                                newTaskTitle,
                                setNewTaskTitle,
                                newTaskNote,
                                setNewTaskNote,
                                newTaskStartDate,
                                setNewTaskStartDate,
                                newTaskRecurring,
                                setNewTaskRecurring,
                                onSubmit: handleCreateMainTask,
                                onCancel: cancelCreate,
                            } : null}
                        />
                    )}

                    {/* Recurring Tasks Section */}
                    {remainingRecurringTasks.length > 0 && (
                        <div className="mt-8 border-t pt-6">
                            <button
                                onClick={() => setShowRecurringTasks(!showRecurringTasks)}
                                className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 cursor-pointer"
                            >
                                {showRecurringTasks ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Recurring Tasks ({remainingRecurringTasks.length})
                            </button>

                            {showRecurringTasks && (
                                <div className="space-y-2 scrollable-container">
                                    {remainingRecurringTasks.map((task) => (
                                        <TaskItem
                                            key={task.id}
                                            task={task}
                                            onDelete={() => handleDeleteTask(task.id)}
                                            onCreateSubtask={null}
                                            onArchive={() => handleArchiveTask(task.id)}
                                            onUnarchive={() => handleUnarchiveTask(task.id)}
                                            onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
                                            onEditTask={onEditTask}
                                            onViewTask={onViewTask}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Archived Tasks Section */}
                    {sortedArchivedTasks.length > 0 && (
                        <div className="mt-8 border-t pt-6">
                            <button
                                onClick={() => setShowArchivedTasks(!showArchivedTasks)}
                                className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4 cursor-pointer"
                            >
                                {showArchivedTasks ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                Archived Tasks ({sortedArchivedTasks.length})
                            </button>

                            {showArchivedTasks && (
                                taskDisplay === 'kanban' ? (
                                    <TaskKanbanBoard
                                        parentTasks={sortedArchivedTasks}
                                        tasks={sortedArchivedTasks}
                                        onCreateSubtask={null}
                                        onViewTask={onViewTask}
                                        onUpdateTask={updateTask}
                                        onUnarchiveTask={handleUnarchiveTask}
                                        onDeleteTask={handleDeleteTask}
                                        showBillableBadges={allowBillableToggle}
                                        fallbackSortBy={secondaryTaskSort}
                                        dragDisabled={true}
                                    />
                                ) : (
                                    <div className="space-y-2 scrollable-container">
                                        {sortedArchivedTasks.map((task) => (
                                            <TaskItem
                                                key={task.id}
                                                task={task}
                                                onDelete={() => handleDeleteTask(task.id)}
                                                onCreateSubtask={task.recurring ? null : handleCreateTask}
                                                onUnarchive={() => handleUnarchiveTask(task.id)}
                                                onToggleBillable={allowBillableToggle ? handleToggleBillable : null}
                                                onEditTask={onEditTask}
                                                onViewTask={onViewTask}
                                            />
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={Boolean(pendingDeleteTaskId)}
                onClose={closeDeleteTaskModal}
                title="Delete task?"
                description="This will permanently remove the task and any related time entries."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeleteTaskModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteTask}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <div className="space-y-3">
                    <Notice
                        title={pendingDeleteTask
                            ? `Deleting "${pendingDeleteTask.title}" cannot be undone.`
                            : 'Deleting this task cannot be undone.'}
                        variant="destructive"
                    />
                    <DeleteTaskWarnings
                        summary={deleteBillingSummary}
                        taskCount={pendingDeleteTaskIds.length}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default React.memo(TaskTree);
