import React, { useState, useCallback, useMemo } from 'react';
import { DocumentCheckIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon, SortIcon } from '@/components/ui/icons';
import TaskItem from './TaskItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Notice } from '@/components/ui/notice';
import Modal from './Modal';
import RecurringPicker from './task/RecurringPicker';
import { useToast } from '../hooks/useToast.ts';
import { useTasks } from '../hooks/useTasks.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useTimers } from '../hooks/useTimers.ts';
import DeleteTaskWarnings from './task/DeleteTaskWarnings';
import { getTaskDeletionBillingSummary, getTaskIdsToDelete } from '../utils/taskUtils.ts';
import { SORT_OPTIONS, sortItems } from '../utils/sortUtils.ts';
import { isRecurringTaskDueOnDate } from '../utils/recurringUtils.ts';
import { useTodayDate, useTodayString } from '../hooks/useDayRollover';
import { toStorageDate } from '../utils/dateUtils.ts';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';

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
    const [taskSort, setTaskSort] = useState('lastActive');
    const { showSuccess } = useToast();
    
    // Yjs hooks for state
    const { tasks, createTask, updateTask, deleteTask } = useTasks({ projectId: project.id });
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { getTimerForProject, clearTimer } = useTimers();
    const todayStr = useTodayString();
    const todayDate = useTodayDate();

    const allowBillableToggle = !project.isPersonal;

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

    const sortedParentTasks = useMemo(() => {

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
            sortBy: taskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [archivedTasks, taskSort]);

    const sortedRecurringTasks = useMemo(() => {

        return sortItems({
            items: recurringTasks,
            sortBy: taskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [recurringTasks, taskSort]);

    const dueTodayRecurringTasks = useMemo(() => {
        if (!todayStr) return [];

        const due = recurringTasks.filter(task => isRecurringTaskDueOnDate(todayDate, task.recurring));
        return sortItems({
            items: due,
            sortBy: taskSort,
            getName: (task) => task.title || '',
            getCreatedAt: (task) => task.createdAt,
            getLastActive: (task) => task.lastActive || task.createdAt,
        });
    }, [recurringTasks, taskSort, todayDate, todayStr]);

    const remainingRecurringTasks = useMemo(() => {
        if (!todayStr) return sortedRecurringTasks;
        const dueTodayIds = new Set(dueTodayRecurringTasks.map(task => task.id));
        return sortedRecurringTasks.filter(task => !dueTodayIds.has(task.id));
    }, [sortedRecurringTasks, dueTodayRecurringTasks, todayStr]);


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
        const newTask = createTask({
            projectId: project.id,
            parentTaskId: taskData.parentTaskId || null,
            title: taskData.title.trim(),
            note: taskData.note ? taskData.note.trim() : null,
            startDate: taskData.recurring ? null : (taskData.startDate || null),
            recurring: taskData.recurring || null,
            lastActive: Date.now(),
            lastBilledAt: null,
            billable: false,
            billableSetByUser: false
        });

        // If this is a subtask, also update the parent task's lastActive
        if (taskData.parentTaskId) {
            updateTask(taskData.parentTaskId, { lastActive: Date.now() });
        }
        
        return newTask;
    }, [createTask, updateTask, project.id]);

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
                    <Select value={taskSort} onValueChange={setTaskSort}>
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
                            {SORT_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

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
            {showCreateForm && (
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

                        <div className={cn('flex gap-2', isMobileLayout && 'justify-end')}>
                            <Button type="submit">
                                Create
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={cancelCreate}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tasks List */}
            {parentTasks.length === 0 && recurringTasks.length === 0 && archivedTasks.length === 0 ? (
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

                    {sortedParentTasks.length > 0 && (
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
