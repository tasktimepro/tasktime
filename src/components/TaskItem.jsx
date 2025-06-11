import { useState, useEffect, useMemo } from 'react';
import { 
    PencilIcon, 
    TrashIcon,
    ArchiveBoxIcon,
    ClockIcon,
    EllipsisHorizontalIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import TaskTimer from './TaskTimer.jsx';
import CustomCheckbox from './CustomCheckbox.jsx';
import TimeEditModal from './TimeEditModal.jsx';
import { formatDurationWithSeconds } from '../utils/dateUtils';
import { useToast } from '../hooks/useToast';
import { deleteTaskWithCleanup } from '../utils/taskUtils';

// Create a custom event for dropdown management
const DROPDOWN_TOGGLE_EVENT = 'dropdown-toggle';

/**
 * TaskItem component - Displays individual task with timer controls and subtasks
 */
const TaskItem = ({
    task,
    tasks,
    setTasks,
    timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    isPaused = false,
    setIsPaused = null,
    pausedElapsedTime = 0,
    setPausedElapsedTime = null,
    isGlobalTimer = false,
    onDelete,
    onCreateSubtask,
    onArchive,
    onUnarchive,
    onToggleBillable,
    allTasks
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const { showSuccess } = useToast();
    // eslint-disable-next-line no-unused-vars
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [showTimeEditModal, setShowTimeEditModal] = useState(false);
    const [showCreateSubtaskForm, setShowCreateSubtaskForm] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // Update current time every second for active timer display
    useEffect(() => {
        let interval;

        if (currentTimer && currentTimer.taskId === task.id) {
            interval = setInterval(() => {
                setCurrentTime(Date.now());
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentTimer, task.id]);

    // Close dropdown when clicking outside or when another dropdown opens
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && !event.target.closest('.dropdown-container')) {
                setShowDropdown(false);
            }
        };
        
        // Handle when another dropdown is opened
        const handleDropdownToggle = (event) => {
            // If this is not our dropdown being toggled (different task ID) and it's being opened, close this one
            if (event.detail.taskId !== task.id && event.detail.open) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener(DROPDOWN_TOGGLE_EVENT, handleDropdownToggle);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener(DROPDOWN_TOGGLE_EVENT, handleDropdownToggle);
        };
    }, [showDropdown, task.id]);

    // Get subtasks for this task
    const subtasks = allTasks.filter(t => t.parentTaskId === task.id);

    // Get time entries for this task
    const taskTimeEntries = timeEntries.filter(entry => entry.taskId === task.id);

    // Get time entries for subtasks
    const subtaskIds = subtasks.map(subtask => subtask.id);

    const subtaskTimeEntries = timeEntries.filter(entry => 
        subtaskIds.includes(entry.taskId)
    );

    // Calculate total time for this task (including subtasks)
    const taskTime = taskTimeEntries.reduce((total, entry) => {
        // Ensure both start and end are valid numbers
        if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' && 
            !isNaN(entry.start) && !isNaN(entry.end)) {
            return total + (entry.end - entry.start);
        }
        return total;
    }, 0);

    const subtaskTime = subtaskTimeEntries.reduce((total, entry) => {
        // Ensure both start and end are valid numbers
        if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' && 
            !isNaN(entry.start) && !isNaN(entry.end)) {
            return total + (entry.end - entry.start);
        }
        return total;
    }, 0);

    const totalTime = taskTime + subtaskTime;

    // For main tasks, distinguish between main task time and total time with subtasks
    const mainTaskTime = taskTime; // Time logged directly to this task
    const totalTimeWithSubtasks = totalTime; // Main task time + subtask time

    // Check if this task's timer is active
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    // Check if any timer is active (to dim other tasks)
    const anyTimerActive = currentTimer !== null;

    // Check if any subtask timer is active
    const subtaskTimerActive = subtasks.some(subtask => 
        currentTimer && currentTimer.taskId === subtask.id
    );

    // Check if task is completed or archived
    const isCompleted = task.completed || false;
    const isArchived = task.archived || false;

    // Task dimming logic:
    // 1. If this task's timer is active, don't dim it
    // 2. If this task's subtask has an active timer, don't dim this task
    // 3. If any timer is active (and not paused) and it's not related to this task, dim it
    // 4. Don't dim archived tasks regardless
    const isRelatedToActiveTimer = isTimerActive || subtaskTimerActive;
    const shouldDimTask = anyTimerActive && !isPaused && !isRelatedToActiveTimer && !isArchived;

    // Check if task has significant billable time since lastBilledAt (for auto-setting as billable)
    const hasSignificantBillableTime = useMemo(() => {
        const taskBillableEntries = taskTimeEntries.filter(entry => {
            if (!entry.end || entry.end <= entry.start) return false;
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            return entry.start > taskLastBilledAt;
        });
        
        // Calculate total time from billable entries
        const totalBillableTime = taskBillableEntries.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);
        
        // Only consider significant if 30 seconds or more (30,000 milliseconds)
        return totalBillableTime >= 30000;
    }, [taskTimeEntries, task.lastBilledAt, task.createdAt]);

    // Auto-set task as billable if it has significant billable time (and hasn't been explicitly set by user)
    useEffect(() => {
        // Only auto-set billable status if:
        // 1. Task has significant billable time, AND
        // 2. The billable status hasn't been explicitly set by the user
        if (hasSignificantBillableTime && !task.billableSetByUser && !task.billable) {
            const now = Date.now();
            const updatedTasks = tasks.map(t =>
                t.id === task.id ? { ...t, billable: true, lastActive: now } : t
            );
            setTasks(updatedTasks);
        }
    }, [hasSignificantBillableTime, task.billable, task.billableSetByUser, task.id, tasks, setTasks]);

    /**
     * Toggle task completion status
     */
    const handleToggleComplete = () => {
        const now = Date.now();
        
        // If timer is active for this task, stop it before completing
        if (isTimerActive && currentTimer) {
            const timeEntry = {
                id: `completion-${Date.now()}`,
                taskId: task.id,
                start: currentTimer.startTime,
                end: now
            };
            setTimeEntries([...timeEntries, timeEntry]);
            setCurrentTimer(null);
        }

        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, completed: !isCompleted, lastActive: now } : t
        );

        setTasks(updatedTasks);
    };

    /**
     * Handle editing time for task
     */
    const handleTimeEdit = (newTime) => {
        // For main tasks, only edit the main task's own time (not including subtasks)
        const currentEditableTime = !task.parentTaskId ? mainTaskTime : totalTimeWithSubtasks;
        
        // Calculate the difference between new and old time
        const timeDifference = newTime - currentEditableTime;

        if (timeDifference !== 0) {
            const now = Date.now();
            
            // Update the task's lastActive property to now
            setTasks(prevTasks => 
                prevTasks.map(t =>
                    t.id === task.id ? { ...t, lastActive: now } : t
                )
            );
            
            // Get billing cutoff date (same logic as invoice generation)
            // Use task-specific lastBilledAt, or task creation date if never billed
            const billingCutoffDate = task.lastBilledAt || task.createdAt || 0;
            
            if (timeDifference > 0) {
                // Adding time - ensure start time is after billing cutoff while preserving duration
                const proposedStartTime = now - timeDifference;
                
                if (proposedStartTime > billingCutoffDate) {
                    // Normal case - no adjustment needed
                    const adjustmentEntry = {
                        id: `adjustment-${now}`,
                        taskId: task.id,
                        start: proposedStartTime,
                        end: now
                    };
                    setTimeEntries([...timeEntries, adjustmentEntry]);
                } else {
                    // Start time would be before billing cutoff - adjust both start and end to preserve duration
                    const startTime = billingCutoffDate + 1;
                    const endTime = startTime + timeDifference;
                    
                    const adjustmentEntry = {
                        id: `adjustment-${now}`,
                        taskId: task.id,
                        start: startTime,
                        end: endTime
                    };
                    setTimeEntries([...timeEntries, adjustmentEntry]);
                }
            } else {
                // Reducing time - replace existing entries with a new single entry
                if (newTime > 0) {
                    // Remove existing entries for this task and create a new one with the exact time
                    const otherEntries = timeEntries.filter(entry => entry.taskId !== task.id);
                    const proposedStartTime = now - newTime;
                    
                    if (proposedStartTime > billingCutoffDate) {
                        // Normal case - no adjustment needed
                        const newEntry = {
                            id: `manual-${now}`,
                            taskId: task.id,
                            start: proposedStartTime,
                            end: now
                        };
                        setTimeEntries([...otherEntries, newEntry]);
                    } else {
                        // Start time would be before billing cutoff - adjust both start and end to preserve duration
                        const startTime = billingCutoffDate + 1;
                        const endTime = startTime + newTime;
                        
                        const newEntry = {
                            id: `manual-${now}`,
                            taskId: task.id,
                            start: startTime,
                            end: endTime
                        };
                        setTimeEntries([...otherEntries, newEntry]);
                    }
                } else {
                    // Remove all time entries for this task
                    const otherEntries = timeEntries.filter(entry => entry.taskId !== task.id);
                    setTimeEntries(otherEntries);
                }
            }
        }
    };

    /**
     * Update task title
     */
    const handleUpdateTitle = (e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        const now = Date.now();
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, title: editTitle.trim(), lastActive: now } : t
        );

        setTasks(updatedTasks);

        setIsEditing(false);
    };

    /**
     * Cancel editing
     */
    const cancelEdit = () => {
        setEditTitle(task.title);
        setIsEditing(false);
    };

    /**
     * Handle creating a subtask
     */
    const handleCreateSubtask = (e) => {
        e.preventDefault();
        
        if (!newSubtaskTitle.trim()) return;

        onCreateSubtask({
            parentTaskId: task.id,
            title: newSubtaskTitle
        });

        setNewSubtaskTitle('');
        setShowCreateSubtaskForm(false);
    };

    /**
     * Cancel subtask creation
     */
    const cancelCreateSubtask = () => {
        setNewSubtaskTitle('');
        setShowCreateSubtaskForm(false);
    };

    // Calculate active timer display - removed as requested
    // const activeTimerDisplay = isTimerActive ? formatActiveTimer(currentTimer.startTime) : null;

    return (
        <div className={`border border-gray-200 rounded-lg hover:shadow-md transition-shadow ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-gray-50' : ''}`}>
            {/* Main Task */}
            <div className={`p-4 transition-colors ${
                // If we have subtasks or can create them, only round the top corners
                // Otherwise round all corners for a standalone task
                (subtasks.length > 0 || (!task.completed && onCreateSubtask)) ? 'rounded-t-lg' : 'rounded-lg'
            } ${
                (subtaskTimerActive && !isPaused) && !isArchived
                ? 'bg-gray-100 opacity-50 pointer-events-none' 
                : 'hover:bg-gray-50'
            }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* Completion Checkbox */}
                        <div className="flex-shrink-0">
                            <CustomCheckbox
                                checked={isCompleted}
                                onChange={handleToggleComplete}
                                disabled={isEditing || isArchived}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            {isEditing ? (
                                <form onSubmit={handleUpdateTitle} className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="flex-1 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 px-2.5 py-1.5"
                                        autoFocus
                                        disabled={isCompleted}
                                    />

                                    <button
                                        type="submit"
                                        className="px-3 py-2 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Save
                                    </button>

                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Cancel
                                    </button>
                                </form>
                            ) : (
                                <div className="flex items-center space-x-3">
                                    <h3 className={`text-sm font-medium truncate ${
                                        isCompleted ? 'line-through text-gray-500' : 'text-gray-900'
                                    }`}>
                                        {task.title}
                                    </h3>

                                    {/* Time Display */}
                                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                                        {!task.parentTaskId ? (
                                            /* Main task - show both main task time and total time */
                                            <>
                                                {(mainTaskTime > 0 || totalTimeWithSubtasks > 0) && (
                                                    <div className="flex ml-2 items-center space-x-2">
                                                        {mainTaskTime > 0 && (
                                                            <button
                                                                onClick={() => setShowTimeEditModal(true)}
                                                                className="hover:bg-gray-100 rounded-md transition-colors"
                                                                title="Click to edit main task time (excluding subtasks)"
                                                                disabled={isCompleted}
                                                            >
                                                                <span className="text-gray-500">
                                                                    {formatDurationWithSeconds(mainTaskTime)}
                                                                </span>
                                                            </button>
                                                        )}
                                                        {(totalTimeWithSubtasks > mainTaskTime) && (mainTaskTime > 0) && (
                                                            <span>•</span>
                                                        )}
                                                        {totalTimeWithSubtasks > mainTaskTime && (
                                                            <span 
                                                                className="text-blue-600 font-medium"
                                                                title="Total time including subtasks"
                                                            >
                                                                Total: {formatDurationWithSeconds(totalTimeWithSubtasks)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            /* Subtask - show only subtask time */
                                            totalTimeWithSubtasks > 0 && (
                                                <button
                                                    onClick={() => setShowTimeEditModal(true)}
                                                    className="hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
                                                    title="Click to edit time"
                                                    disabled={isCompleted}
                                                >
                                                    {formatDurationWithSeconds(totalTimeWithSubtasks)}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="flex items-center space-x-1">
                            {/* Show timer controls and action buttons conditionally */}
                            {isTimerActive && !isPaused ? (
                                /* Show ONLY timer controls when this timer is actively running (not paused) */
                                <TaskTimer
                                    task={task}
                                    timeEntries={timeEntries}
                                    setTimeEntries={setTimeEntries}
                                    currentTimer={currentTimer}
                                    setCurrentTimer={setCurrentTimer}
                                    isPaused={isPaused}
                                    setIsPaused={setIsPaused}
                                    pausedElapsedTime={pausedElapsedTime}
                                    setPausedElapsedTime={setPausedElapsedTime}
                                    isGlobalTimer={isGlobalTimer}
                                    showTimeDisplay={false}
                                    setTasks={setTasks}
                                />
                            ) : isArchived ? (
                                /* Show unarchive and delete buttons for archived tasks in flex layout */
                                <div className="flex items-center space-x-2">
                                    {onUnarchive && (
                                        <button
                                            onClick={onUnarchive}
                                            className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md"
                                            title="Unarchive Task"
                                        >
                                            Unarchive
                                        </button>
                                    )}
                                    <button
                                        onClick={onDelete}
                                        className="text-xs text-red-600 hover:text-red-800 bg-red-50 px-2 py-1 rounded-md"
                                        title="Delete Task"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ) : isCompleted ? (
                                /* Only show archive button when completed */
                                !task.parentTaskId && onArchive && (
                                    <button
                                        onClick={onArchive}
                                        className="p-1 text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors group"
                                        title="Archive Task"
                                    >
                                        <ArchiveBoxIcon className="h-5 w-5 group-hover:text-yellow-700" />
                                    </button>
                                )
                            ) : anyTimerActive && !isPaused && !isTimerActive ? (
                                /* When any timer is actively running (not paused) and it's not this task's timer, hide all action buttons */
                                null
                            ) : (
                                /* Show all action buttons when not completed and no timer actively running */
                                <>
                                    <TaskTimer
                                        task={task}
                                        timeEntries={timeEntries}
                                        setTimeEntries={setTimeEntries}
                                        currentTimer={currentTimer}
                                        setCurrentTimer={setCurrentTimer}
                                        isPaused={isPaused}
                                        setIsPaused={setIsPaused}
                                        pausedElapsedTime={pausedElapsedTime}
                                        setPausedElapsedTime={setPausedElapsedTime}
                                        isGlobalTimer={isGlobalTimer}
                                        showTimeDisplay={false}
                                        setTasks={setTasks}
                                    />

                                    <button
                                        onClick={() => setShowTimeEditModal(true)}
                                        className="p-1 text-gray-400 hover:bg-yellow-100 rounded-md transition-colors group"
                                        title="Edit Time"
                                    >
                                        <ClockIcon className="h-5 w-5 group-hover:text-yellow-700" />
                                    </button>

                                    {/* Billable Toggle Button - Always show this button */}
                                    {onToggleBillable && (
                                        <button
                                            onClick={() => onToggleBillable(task.id)}
                                            className={`p-1 rounded-md transition-colors group ${
                                                task.billable
                                                    ? 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                                                    : 'text-gray-400 hover:bg-blue-100'
                                            }`}
                                            title={
                                                task.billable
                                                    ? 'Mark as not billable'
                                                    : 'Mark as billable'
                                            }
                                        >
                                            <CurrencyDollarIcon className={`h-5 w-5 ${
                                                task.billable
                                                    ? 'group-hover:text-blue-700'
                                                    : 'group-hover:text-blue-600'
                                            }`} />
                                        </button>
                                    )}

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <div className="relative dropdown-container">
                                        <button
                                            onClick={() => {
                                                setShowDropdown(!showDropdown);

                                                // Dispatch a custom event to close other dropdowns
                                                const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                                    detail: { taskId: task.id, open: !showDropdown }
                                                });
                                                document.dispatchEvent(event);
                                            }}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition-colors group"
                                            title="More actions"
                                        >
                                            <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                        </button>

                                        {showDropdown && (
                                            <div className="absolute right-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            setIsEditing(true);
                                                            setShowDropdown(false);
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors space-x-2"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            onDelete();
                                                            setShowDropdown(false);
                                                        }}
                                                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors space-x-2"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Time Edit Modal */}
            <TimeEditModal
                isOpen={showTimeEditModal}
                onClose={() => setShowTimeEditModal(false)}
                currentTime={!task.parentTaskId ? mainTaskTime : totalTimeWithSubtasks}
                onSave={handleTimeEdit}
                taskTitle={task.title}
            />

            {/* Subtasks */}
            {!isArchived && (subtasks.length > 0 || (!task.completed && onCreateSubtask)) && (
                <div className="border-t border-gray-100 bg-gray-50 rounded-b-lg">
                    <div className="pl-8 pr-4 py-2 space-y-2">
                        {subtasks.map((subtask) => (
                            <SubtaskItem
                                key={subtask.id}
                                task={subtask}
                                tasks={tasks}
                                setTasks={setTasks}
                                timeEntries={timeEntries}
                                setTimeEntries={setTimeEntries}
                                currentTimer={currentTimer}
                                setCurrentTimer={setCurrentTimer}
                                isPaused={isPaused}
                                setIsPaused={setIsPaused}
                                pausedElapsedTime={pausedElapsedTime}
                                setPausedElapsedTime={setPausedElapsedTime}
                                isGlobalTimer={isGlobalTimer}
                                onToggleBillable={onToggleBillable}
                                onDelete={() => {
                                    if (window.confirm('Are you sure you want to delete this subtask?')) {
                                        const result = deleteTaskWithCleanup(
                                            subtask.id,
                                            tasks,
                                            timeEntries,
                                            currentTimer,
                                            setTasks,
                                            setTimeEntries,
                                            setCurrentTimer
                                        );
                                        
                                        // Show success toast
                                        showSuccess(`Subtask "${result.taskTitle}" deleted successfully`);
                                    }
                                }}
                            />
                        ))}
                        
                        {/* Add Subtask Section */}
                        {!task.completed && onCreateSubtask && (
                            showCreateSubtaskForm ? (
                                <form onSubmit={handleCreateSubtask} className="space-y-3">
                                    <div className="flex space-x-3">
                                        <input
                                            type="text"
                                            value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            placeholder="Enter subtask title"
                                            className="flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                            autoFocus
                                        />
                                        <button
                                            type="submit"
                                            className="px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelCreateSubtask}
                                            className="px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className={`${
                                    (anyTimerActive && !isPaused && isRelatedToActiveTimer)
                                    ? 'opacity-50 pointer-events-none' 
                                    : ''
                                }`}>
                                    <button
                                        onClick={() => setShowCreateSubtaskForm(true)}
                                        className="w-full text-left py-2 px-3 text-sm text-gray-500 rounded-md transition-colors border border-dashed border-gray-300 hover:bg-gray-100"
                                    >
                                        + Add subtask
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * SubtaskItem component - Displays individual subtask
 */
const SubtaskItem = ({
    task,
    tasks,
    setTasks,
    timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    isPaused = false,
    setIsPaused = null,
    pausedElapsedTime = 0,
    setPausedElapsedTime = null,
    isGlobalTimer = false,
    onToggleBillable,
    onDelete
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    // eslint-disable-next-line no-unused-vars
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [showTimeEditModal, setShowTimeEditModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    // Update current time every second for active timer display
    useEffect(() => {
        let interval;

        if (currentTimer && currentTimer.taskId === task.id) {
            interval = setInterval(() => {
                setCurrentTime(Date.now());
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentTimer, task.id]);

    // Close dropdown when clicking outside or when another dropdown opens
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && !event.target.closest('.dropdown-container')) {
                setShowDropdown(false);
            }
        };
        
        // Handle when another dropdown is opened
        const handleDropdownToggle = (event) => {
            // If this is not our dropdown being toggled (different task ID) and it's being opened, close this one
            if (event.detail.taskId !== task.id && event.detail.open) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener(DROPDOWN_TOGGLE_EVENT, handleDropdownToggle);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener(DROPDOWN_TOGGLE_EVENT, handleDropdownToggle);
        };
    }, [showDropdown, task.id]);

    // Get time entries for this subtask
    const taskTimeEntries = timeEntries.filter(entry => entry.taskId === task.id);

    const totalTime = taskTimeEntries.reduce((total, entry) => {
        // Ensure both start and end are valid numbers
        if (entry && typeof entry.start === 'number' && typeof entry.end === 'number' && 
            !isNaN(entry.start) && !isNaN(entry.end)) {
            return total + (entry.end - entry.start);
        }
        return total;
    }, 0);

    // Check if this subtask's timer is active
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    // Check if any timer is active (to dim other tasks)
    const anyTimerActive = currentTimer !== null;
    
    // Check if subtask is completed
    const isCompleted = task.completed || false;

    // Check if subtask is archived (either the subtask itself or its parent task)
    const isArchived = task.archived || false;
    
    // For subtasks, we should:
    // 1. Not dim if this subtask's timer is active
    // 2. Only dim if any timer is actively running (not paused) and it's not this subtask's timer
    // 3. Don't dim if the task is archived
    const shouldDimTask = anyTimerActive && !isPaused && !isTimerActive && !isArchived;

    // Check if subtask has significant billable time since lastBilledAt (for auto-setting as billable)
    const hasSignificantBillableTime = useMemo(() => {
        const taskBillableEntries = taskTimeEntries.filter(entry => {
            if (!entry.end || entry.end <= entry.start) return false;
            const taskLastBilledAt = task.lastBilledAt || task.createdAt || 0;
            return entry.start > taskLastBilledAt;
        });
        
        // Calculate total time from billable entries
        const totalBillableTime = taskBillableEntries.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);
        
        // Only consider significant if 30 seconds or more (30,000 milliseconds)
        return totalBillableTime >= 30000;
    }, [taskTimeEntries, task.lastBilledAt, task.createdAt]);

    // Auto-set subtask as billable if it has significant billable time (and hasn't been explicitly set by user)
    useEffect(() => {
        // Only auto-set billable status if:
        // 1. Task has significant billable time, AND
        // 2. The billable status hasn't been explicitly set by the user
        if (hasSignificantBillableTime && !task.billableSetByUser && !task.billable) {
            const now = Date.now();
            const updatedTasks = tasks.map(t =>
                t.id === task.id ? { ...t, billable: true, lastActive: now } : t
            );
            setTasks(updatedTasks);
        }
    }, [hasSignificantBillableTime, task.billable, task.billableSetByUser, task.id, tasks, setTasks]);

    /**
     * Toggle subtask completion status
     */
    const handleToggleComplete = () => {
        const now = Date.now();
        
        // If timer is active for this subtask, stop it before completing
        if (isTimerActive && currentTimer) {
            const timeEntry = {
                id: `completion-${Date.now()}`,
                taskId: task.id,
                start: currentTimer.startTime,
                end: now
            };
            setTimeEntries([...timeEntries, timeEntry]);
            setCurrentTimer(null);
        }

        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, completed: !isCompleted, lastActive: now } : t
        );

        setTasks(updatedTasks);
    };

    /**
     * Handle editing time for subtask
     */
    const handleTimeEdit = (newTime) => {
        // Calculate the difference between new and old time
        const timeDifference = newTime - totalTime;

        if (timeDifference !== 0) {
            const now = Date.now();
            
            // Update the task's lastActive property to now
            setTasks(prevTasks => 
                prevTasks.map(t =>
                    t.id === task.id ? { ...t, lastActive: now } : t
                )
            );
            
            // Get billing cutoff date (same logic as invoice generation)
            // Use task-specific lastBilledAt, or task creation date if never billed
            const billingCutoffDate = task.lastBilledAt || task.createdAt || 0;
            
            if (timeDifference > 0) {
                // Adding time - ensure start time is after billing cutoff while preserving duration
                const proposedStartTime = now - timeDifference;
                
                if (proposedStartTime > billingCutoffDate) {
                    // Normal case - no adjustment needed
                    const adjustmentEntry = {
                        id: `adjustment-${now}`,
                        taskId: task.id,
                        start: proposedStartTime,
                        end: now
                    };
                    setTimeEntries([...timeEntries, adjustmentEntry]);
                } else {
                    // Start time would be before billing cutoff - adjust both start and end to preserve duration
                    const startTime = billingCutoffDate + 1;
                    const endTime = startTime + timeDifference;
                    
                    const adjustmentEntry = {
                        id: `adjustment-${now}`,
                        taskId: task.id,
                        start: startTime,
                        end: endTime
                    };
                    setTimeEntries([...timeEntries, adjustmentEntry]);
                }
            } else {
                // Reducing time - replace existing entries with a new single entry
                if (newTime > 0) {
                    // Remove existing entries for this task and create a new one with the exact time
                    const otherEntries = timeEntries.filter(entry => entry.taskId !== task.id);
                    const proposedStartTime = now - newTime;
                    
                    if (proposedStartTime > billingCutoffDate) {
                        // Normal case - no adjustment needed
                        const newEntry = {
                            id: `manual-${now}`,
                            taskId: task.id,
                            start: proposedStartTime,
                            end: now
                        };
                        setTimeEntries([...otherEntries, newEntry]);
                    } else {
                        // Start time would be before billing cutoff - adjust both start and end to preserve duration
                        const startTime = billingCutoffDate + 1;
                        const endTime = startTime + newTime;
                        
                        const newEntry = {
                            id: `manual-${now}`,
                            taskId: task.id,
                            start: startTime,
                            end: endTime
                        };
                        setTimeEntries([...otherEntries, newEntry]);
                    }
                } else {
                    // Remove all time entries for this task
                    const otherEntries = timeEntries.filter(entry => entry.taskId !== task.id);
                    setTimeEntries(otherEntries);
                }
            }
        }
    };

    /**
     * Update subtask title
     */
    const handleUpdateTitle = (e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        const now = Date.now();
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, title: editTitle.trim(), lastActive: now } : t
        );

        setTasks(updatedTasks);

        setIsEditing(false);
    };

    /**
     * Cancel editing
     */
    const cancelEdit = () => {
        setEditTitle(task.title);

        setIsEditing(false);
    };

    // Calculate active timer display - removed as requested
    // const activeTimerDisplay = isTimerActive ? formatActiveTimer(currentTimer.startTime) : null;

    return (
        <div className={`flex items-center justify-between py-2 rounded-md hover:bg-gray-50 transition-colors ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-gray-50' : ''}`}>
            <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Completion Checkbox */}
                <div className="flex-shrink-0">
                    <CustomCheckbox
                        checked={isCompleted}
                        onChange={handleToggleComplete}
                        disabled={isEditing || isArchived}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <form onSubmit={handleUpdateTitle} className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 px-2.5 py-1.5"
                                autoFocus
                                disabled={isCompleted}
                            />

                            <button
                                type="submit"
                                className="px-3 py-2 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Save
                            </button>

                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>
                        </form>
                    ) : (
                        <div className="flex items-center space-x-3">
                            <h4 className={`text-sm truncate ${
                                isCompleted ? 'line-through text-gray-500' : 'text-gray-700'
                            }`}>
                                {task.title}
                            </h4>

                            {/* Time Display - aligned left next to title */}
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                                {totalTime > 0 && (
                                    <button
                                        onClick={() => setShowTimeEditModal(true)}
                                        className="hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
                                        title="Click to edit time"
                                        disabled={isCompleted}
                                    >
                                        {formatDurationWithSeconds(totalTime)}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!isEditing && (
                <div className="flex items-center space-x-1">
                    {/* Show timer controls and action buttons conditionally */}
                    {isTimerActive && !isPaused ? (
                        /* Show ONLY timer controls when this timer is actively running (not paused) */
                        <TaskTimer
                            task={task}
                            timeEntries={timeEntries}
                            setTimeEntries={setTimeEntries}
                            currentTimer={currentTimer}
                            setCurrentTimer={setCurrentTimer}
                            isPaused={isPaused}
                            setIsPaused={setIsPaused}
                            pausedElapsedTime={pausedElapsedTime}
                            setPausedElapsedTime={setPausedElapsedTime}
                            isGlobalTimer={isGlobalTimer}
                            showTimeDisplay={false}
                            setTasks={setTasks}
                        />
                    ) : isCompleted ? (
                        /* No actions for completed subtasks */
                        null
                    ) : anyTimerActive && !isPaused && !isTimerActive ? (
                        /* When any timer is actively running (not paused) and it's not this task's timer, hide all action buttons */
                        null
                    ) : (
                        /* Show all action buttons when not completed and no timer actively running */
                        <>
                            <TaskTimer
                                task={task}
                                timeEntries={timeEntries}
                                setTimeEntries={setTimeEntries}
                                currentTimer={currentTimer}
                                setCurrentTimer={setCurrentTimer}
                                isPaused={isPaused}
                                setIsPaused={setIsPaused}
                                pausedElapsedTime={pausedElapsedTime}
                                setPausedElapsedTime={setPausedElapsedTime}
                                isGlobalTimer={isGlobalTimer}
                                showTimeDisplay={false}
                                setTasks={setTasks}
                            />

                            <button
                                onClick={() => setShowTimeEditModal(true)}
                                className="p-1 text-gray-400 hover:bg-yellow-100 rounded-md transition-colors group"
                                title="Edit Time"
                            >
                                <ClockIcon className="h-5 w-5 group-hover:text-yellow-700" />
                            </button>

                            {/* Billable Toggle Button - Always show this button */}
                            {onToggleBillable && (
                                <button
                                    onClick={() => onToggleBillable(task.id)}
                                    className={`p-1 rounded-md transition-colors group ${
                                        task.billable
                                            ? 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                                            : 'text-gray-400 hover:bg-blue-100'
                                    }`}
                                    title={
                                        task.billable
                                            ? 'Mark as not billable'
                                            : 'Mark as billable'
                                    }
                                >
                                    <CurrencyDollarIcon className={`h-5 w-5 ${
                                        task.billable
                                            ? 'group-hover:text-blue-700'
                                            : 'group-hover:text-blue-600'
                                    }`} />
                                </button>
                            )}
                            
                            {/* Three-dot dropdown menu for Edit and Delete */}
                            <div className="relative dropdown-container">
                                <button
                                    onClick={() => {
                                        setShowDropdown(!showDropdown);

                                        // Dispatch a custom event to close other dropdowns
                                        const event = new CustomEvent(DROPDOWN_TOGGLE_EVENT, {
                                            detail: { taskId: task.id, open: !showDropdown }
                                        });
                                        document.dispatchEvent(event);
                                    }}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition-colors group"
                                    title="More actions"
                                >
                                    <EllipsisHorizontalIcon className="h-5 w-5 group-hover:text-gray-600" />
                                </button>

                                {showDropdown && (
                                    <div className="absolute right-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                                        <div className="py-1">
                                            <button
                                                onClick={() => {
                                                    setIsEditing(true);
                                                    setShowDropdown(false);
                                                }}
                                                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors space-x-2"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    onDelete();
                                                    setShowDropdown(false);
                                                }}
                                                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors space-x-2"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                <span>Delete</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Time Edit Modal */}
            <TimeEditModal
                isOpen={showTimeEditModal}
                onClose={() => setShowTimeEditModal(false)}
                currentTime={totalTime}
                onSave={handleTimeEdit}
                taskTitle={task.title}
            />
        </div>
    );
};

export default TaskItem;
