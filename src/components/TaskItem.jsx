import { useState, useEffect } from 'react';
import { 
    PlayIcon, 
    PauseIcon, 
    StopIcon, 
    PlusIcon, 
    PencilIcon, 
    TrashIcon,
    ArchiveBoxIcon 
} from '@heroicons/react/24/outline';
import TimerControls from './TimerControls.jsx';
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
        return total + (entry.end - entry.start);
    }, 0);

    const subtaskTime = subtaskTimeEntries.reduce((total, entry) => {
        return total + (entry.end - entry.start);
    }, 0);

    const totalTime = taskTime + subtaskTime;

    // Check if this task's timer is active
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    // Check if any timer is active (to dim other tasks)
    const anyTimerActive = currentTimer !== null;

    const shouldDimTask = anyTimerActive && !isTimerActive;

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

    // Calculate active timer display
    const activeTimerDisplay = isTimerActive ? formatActiveTimer(currentTimer.startTime) : null;

    return (
        <div className={`border border-gray-200 rounded-lg ${shouldDimTask ? 'opacity-50' : ''} ${isCompleted ? 'bg-gray-50' : ''}`}>
            {/* Main Task */}
            <div className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {/* Completion Checkbox */}
                        <div className="flex-shrink-0">
                            <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={handleToggleComplete}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                                        className="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                                            <span>{formatDurationWithSeconds(totalTime)}</span>
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
                        <div className="flex items-center space-x-2">
                            {/* Timer Controls - disabled if completed */}
                            <div className={isCompleted ? 'opacity-50 pointer-events-none' : ''}>
                                <TimerControls
                                    task={task}
                                    timeEntries={timeEntries}
                                    setTimeEntries={setTimeEntries}
                                    currentTimer={currentTimer}
                                    setCurrentTimer={setCurrentTimer}
                                />
                            </div>

                            {/* Action Buttons - disabled if completed */}
                            <div className={`flex items-center space-x-1 ${isCompleted ? 'opacity-50' : ''}`}>
                                <button
                                    onClick={onCreateSubtask}
                                    className="text-gray-400 hover:text-blue-600 p-1"
                                    title="Add Subtask"
                                    disabled={isCompleted}
                                >
                                    <PlusIcon className="h-4 w-4" />
                                </button>

                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                    title="Edit Task"
                                    disabled={isCompleted}
                                >
                                    <PencilIcon className="h-4 w-4" />
                                </button>

                                {/* Archive button for parent tasks */}
                                {!task.parentTaskId && onArchive && (
                                    <button
                                        onClick={onArchive}
                                        className="text-gray-400 hover:text-yellow-600 p-1"
                                        title="Archive Task"
                                        disabled={isCompleted}
                                    >
                                        <ArchiveBoxIcon className="h-4 w-4" />
                                    </button>
                                )}

                                <button
                                    onClick={onDelete}
                                    className="text-gray-400 hover:text-red-600 p-1"
                                    title="Delete Task"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Subtasks */}
            {subtasks.length > 0 && (
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
        return total + (entry.end - entry.start);
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
        <div className={`flex items-center justify-between py-2 ${shouldDimTask ? 'opacity-50' : ''} ${isCompleted ? 'bg-gray-50' : ''}`}>
            <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Completion Checkbox */}
                <div className="flex-shrink-0">
                    <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={handleToggleComplete}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                                className="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                        <div className="flex items-center justify-between">
                            <h4 className={`text-sm truncate ${
                                isCompleted ? 'line-through text-gray-500' : 'text-gray-700'
                            }`}>
                                {task.title}
                            </h4>

                            {/* Time Display */}
                            <div className="flex items-center space-x-2 text-xs text-gray-500 ml-3">
                                {totalTime > 0 && (
                                    <span>{formatDurationWithSeconds(totalTime)}</span>
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
                    {/* Timer Controls - disabled if completed */}
                    <div className={isCompleted ? 'opacity-50 pointer-events-none' : ''}>
                        <TimerControls
                            task={task}
                            timeEntries={timeEntries}
                            setTimeEntries={setTimeEntries}
                            currentTimer={currentTimer}
                            setCurrentTimer={setCurrentTimer}
                            size="sm"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className={`flex items-center space-x-1 ${isCompleted ? 'opacity-50' : ''}`}>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Edit Subtask"
                            disabled={isCompleted}
                        >
                            <PencilIcon className="h-3 w-3" />
                        </button>

                        <button
                            onClick={onDelete}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Delete Subtask"
                        >
                            <TrashIcon className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskItem;
