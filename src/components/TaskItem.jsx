import { useState, useEffect } from 'react';
import { 
    PencilIcon, 
    TrashIcon,
    ArchiveBoxIcon,
    ClockIcon
} from '@heroicons/react/24/outline';
import TimerControls from './TimerControls.jsx';
import CustomCheckbox from './CustomCheckbox.jsx';
import TimeEditModal from './TimeEditModal.jsx';
import { formatDuration, formatDurationWithSeconds, formatActiveTimer } from '../utils/dateUtils';

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
    onDelete,
    onCreateSubtask,
    onArchive,
    allTasks
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [showTimeEditModal, setShowTimeEditModal] = useState(false);
    const [showCreateSubtaskForm, setShowCreateSubtaskForm] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

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

    // Debug logging for parent tasks (temporary)
    if (!task.parentTaskId && (taskTime > 0 || subtaskTime > 0 || taskTimeEntries.length > 0)) {
        console.log(`Parent Task "${task.title}":`, {
            taskTime,
            subtaskTime,
            totalTime,
            taskTimeEntries: taskTimeEntries.length,
            subtaskTimeEntries: subtaskTimeEntries.length
        });
        
        // Log problematic entries
        const problematicEntries = taskTimeEntries.filter(entry => 
            !entry || typeof entry.start !== 'number' || typeof entry.end !== 'number' || 
            isNaN(entry.start) || isNaN(entry.end)
        );
        if (problematicEntries.length > 0) {
            console.log(`Problematic entries for "${task.title}":`, problematicEntries);
        }
    }

    // Check if this task's timer is active
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    // Check if any timer is active (to dim other tasks)
    const anyTimerActive = currentTimer !== null;

    // Check if any subtask timer is active
    const subtaskTimerActive = subtasks.some(subtask => 
        currentTimer && currentTimer.taskId === subtask.id
    );

    // Don't dim parent task if its subtask timer is active
    const shouldDimTask = anyTimerActive && !isTimerActive && !subtaskTimerActive;

    // Check if task is completed or archived
    const isCompleted = task.completed || false;

    const isArchived = task.archived || false;

    /**
     * Toggle task completion status
     */
    const handleToggleComplete = () => {
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, completed: !isCompleted } : t
        );

        setTasks(updatedTasks);
    };

    /**
     * Handle editing time for task
     */
    const handleTimeEdit = (newTime) => {
        // Calculate the difference between new and old time
        const timeDifference = newTime - totalTime;

        if (timeDifference !== 0) {
            // Create a new time entry to adjust the total time
            const adjustmentEntry = {
                id: `adjustment-${Date.now()}`,
                taskId: task.id,
                start: Date.now() - Math.abs(timeDifference),
                end: Date.now()
            };

            // If we need to reduce time, create a negative entry by swapping start/end
            if (timeDifference < 0) {
                adjustmentEntry.start = Date.now();

                adjustmentEntry.end = Date.now() - Math.abs(timeDifference);
            }

            setTimeEntries([...timeEntries, adjustmentEntry]);
        }
    };

    /**
     * Update task title
     */
    const handleUpdateTitle = (e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, title: editTitle.trim() } : t
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

    // Calculate active timer display
    const activeTimerDisplay = isTimerActive ? formatActiveTimer(currentTimer.startTime) : null;

    return (
        <div className={`border border-gray-200 rounded-lg hover:shadow-md transition-shadow ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-gray-50' : ''}`}>
            {/* Main Task */}
            <div className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* Completion Checkbox */}
                        <div className="flex-shrink-0">
                            <CustomCheckbox
                                checked={isCompleted}
                                onChange={handleToggleComplete}
                                disabled={isEditing}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            {isEditing ? (
                                <form onSubmit={handleUpdateTitle} className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="flex-1 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 px-5 py-1.5"
                                        autoFocus
                                        disabled={isCompleted}
                                    />

                                    <button
                                        type="submit"
                                        className="text-green-600 hover:text-green-800 text-sm"
                                    >
                                        Save
                                    </button>

                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="text-gray-600 hover:text-gray-800 text-sm"
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
                                        {totalTime > 0 && (
                                            <button
                                                onClick={() => setShowTimeEditModal(true)}
                                                className="hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                                title="Click to edit time"
                                                disabled={isCompleted}
                                            >
                                                {formatDurationWithSeconds(totalTime)}
                                            </button>
                                        )}
                                        
                                        {/* Active Timer Display */}
                                        {activeTimerDisplay && (
                                            <span className="text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
                                                {activeTimerDisplay}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="flex items-center space-x-1">
                            {/* Show timer controls and action buttons conditionally */}
                            {isTimerActive ? (
                                /* Only show timer controls when timer is active */
                                <TimerControls
                                    task={task}
                                    timeEntries={timeEntries}
                                    setTimeEntries={setTimeEntries}
                                    currentTimer={currentTimer}
                                    setCurrentTimer={setCurrentTimer}
                                />
                            ) : isCompleted ? (
                                /* Only show archive button when completed */
                                !task.parentTaskId && onArchive && (
                                    <button
                                        onClick={onArchive}
                                        className="p-1 text-yellow-600 hover:bg-yellow-100 rounded-full transition-colors group"
                                        title="Archive Task"
                                    >
                                        <ArchiveBoxIcon className="h-5 w-5 group-hover:text-yellow-700" />
                                    </button>
                                )
                            ) : (
                                /* Show all action buttons when not completed and timer not active */
                                <>
                                    <TimerControls
                                        task={task}
                                        timeEntries={timeEntries}
                                        setTimeEntries={setTimeEntries}
                                        currentTimer={currentTimer}
                                        setCurrentTimer={setCurrentTimer}
                                    />

                                    {totalTime > 0 && (
                                        <button
                                            onClick={() => setShowTimeEditModal(true)}
                                            className="p-1 text-gray-400 hover:bg-blue-100 rounded-full transition-colors group"
                                            title="Edit Time"
                                        >
                                            <ClockIcon className="h-5 w-5 group-hover:text-blue-600" />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="p-1 text-gray-400 hover:bg-yellow-100 rounded-full transition-colors group"
                                        title="Edit Task"
                                    >
                                        <PencilIcon className="h-5 w-5 group-hover:text-yellow-600" />
                                    </button>

                                    <button
                                        onClick={onDelete}
                                        className="p-1 text-gray-400 hover:bg-red-100 rounded-full transition-colors group"
                                        title="Delete Task"
                                    >
                                        <TrashIcon className="h-5 w-5 group-hover:text-red-600" />
                                    </button>
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
                currentTime={totalTime}
                onSave={handleTimeEdit}
                taskTitle={task.title}
            />

            {/* Subtasks */}
            {(subtasks.length > 0 || (!task.completed && onCreateSubtask)) && (
                <div className="border-t border-gray-100 bg-gray-50">
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
                                onDelete={() => {
                                    if (window.confirm('Are you sure you want to delete this subtask?')) {
                                        const updatedTasks = tasks.filter(t => t.id !== subtask.id);

                                        setTasks(updatedTasks);

                                        // Remove time entries for this subtask
                                        setTimeEntries(timeEntries.filter(entry => entry.taskId !== subtask.id));

                                        // Clear current timer if it's for this subtask
                                        if (currentTimer && currentTimer.taskId === subtask.id) {
                                            setCurrentTimer(null);
                                        }
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
                                            className="flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-1.5"
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
                                <button
                                    onClick={() => setShowCreateSubtaskForm(true)}
                                    className="w-full text-left py-2 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors border border-dashed border-gray-300 hover:border-gray-400"
                                >
                                    + Add subtask
                                </button>
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
    onDelete
}) => {
    const [isEditing, setIsEditing] = useState(false);

    const [editTitle, setEditTitle] = useState(task.title);

    const [currentTime, setCurrentTime] = useState(Date.now());

    const [showTimeEditModal, setShowTimeEditModal] = useState(false);

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

    const shouldDimTask = anyTimerActive && !isTimerActive;

    // Check if subtask is completed
    const isCompleted = task.completed || false;

    /**
     * Toggle subtask completion status
     */
    const handleToggleComplete = () => {
        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, completed: !isCompleted } : t
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
            // Create a new time entry to adjust the total time
            const adjustmentEntry = {
                id: `adjustment-${Date.now()}`,
                taskId: task.id,
                start: Date.now() - Math.abs(timeDifference),
                end: Date.now()
            };

            // If we need to reduce time, create a negative entry by swapping start/end
            if (timeDifference < 0) {
                adjustmentEntry.start = Date.now();

                adjustmentEntry.end = Date.now() - Math.abs(timeDifference);
            }

            setTimeEntries([...timeEntries, adjustmentEntry]);
        }
    };

    /**
     * Update subtask title
     */
    const handleUpdateTitle = (e) => {
        e.preventDefault();

        if (!editTitle.trim()) return;

        const updatedTasks = tasks.map(t =>
            t.id === task.id ? { ...t, title: editTitle.trim() } : t
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

    // Calculate active timer display
    const activeTimerDisplay = isTimerActive ? formatActiveTimer(currentTimer.startTime) : null;

    return (
        <div className={`flex items-center justify-between py-2 ${shouldDimTask ? 'opacity-50 pointer-events-none' : ''} ${isCompleted ? 'bg-gray-50' : ''}`}>
            <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Completion Checkbox */}
                <div className="flex-shrink-0">
                    <CustomCheckbox
                        checked={isCompleted}
                        onChange={handleToggleComplete}
                        disabled={isEditing}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <form onSubmit={handleUpdateTitle} className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="flex-1 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 px-5 py-1.5"
                                autoFocus
                                disabled={isCompleted}
                            />

                            <button
                                type="submit"
                                className="text-green-600 hover:text-green-800 text-xs"
                            >
                                Save
                            </button>

                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="text-gray-600 hover:text-gray-800 text-xs"
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
                                        className="hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                        title="Click to edit time"
                                        disabled={isCompleted}
                                    >
                                        {formatDurationWithSeconds(totalTime)}
                                    </button>
                                )}
                                
                                {/* Active Timer Display */}
                                {activeTimerDisplay && (
                                    <span className="text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
                                        {activeTimerDisplay}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!isEditing && (
                <div className="flex items-center space-x-1">
                    {/* Show timer controls and action buttons conditionally */}
                    {isTimerActive ? (
                        /* Only show timer controls when timer is active */
                        <TimerControls
                            task={task}
                            timeEntries={timeEntries}
                            setTimeEntries={setTimeEntries}
                            currentTimer={currentTimer}
                            setCurrentTimer={setCurrentTimer}
                        />
                    ) : !isCompleted ? (
                        /* Show all action buttons when not completed and timer not active */
                        <>
                            <TimerControls
                                task={task}
                                timeEntries={timeEntries}
                                setTimeEntries={setTimeEntries}
                                currentTimer={currentTimer}
                                setCurrentTimer={setCurrentTimer}
                            />

                            {totalTime > 0 && (
                                <button
                                    onClick={() => setShowTimeEditModal(true)}
                                    className="p-1 text-gray-400 hover:bg-blue-100 rounded-full transition-colors group"
                                    title="Edit Time"
                                >
                                    <ClockIcon className="h-5 w-5 group-hover:text-blue-600" />
                                </button>
                            )}
                            
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-1 text-gray-400 hover:bg-yellow-100 rounded-full transition-colors group"
                                title="Edit Subtask"
                            >
                                <PencilIcon className="h-5 w-5 group-hover:text-yellow-600" />
                            </button>

                            <button
                                onClick={onDelete}
                                className="p-1 text-gray-400 hover:bg-red-100 rounded-full transition-colors group"
                                title="Delete Subtask"
                            >
                                <TrashIcon className="h-5 w-5 group-hover:text-red-600" />
                            </button>
                        </>
                    ) : null}
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
