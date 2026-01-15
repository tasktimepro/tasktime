import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { formatActiveTimer, formatDurationWithSeconds } from '../utils/dateUtils';
import { checkTimerStartOverlap } from '../utils/timeValidationUtils';
import TaskTimer from './TaskTimer.jsx';
import { useToast } from '../hooks/useToast';

/**
 * GlobalTimer component - Shows active timer in the header
 * @param {Object} props - Component props
 * @param {Object} props.currentTimer - Current active timer object
 * @param {Function} props.setCurrentTimer - Function to update current timer
 * @param {Array} props.tasks - All tasks array
 * @param {Array} props.projects - All projects array
 * @param {Function} props.setTimeEntries - Function to update time entries
 * @param {boolean} props.isPaused - Global pause state
 * @param {Function} props.setIsPaused - Function to set global pause state
 * @param {number} props.pausedElapsedTime - Global paused elapsed time
 * @param {Function} props.setPausedElapsedTime - Function to set global paused elapsed time
 * @param {Function} props.navigateToProject - Function to navigate to project page
 * @param {Function} props.onClose - Function called when timer is closed
 */
const GlobalTimer = ({
    currentTimer,
    setCurrentTimer,
    tasks,
    projects,
    setTimeEntries,
    isPaused,
    setIsPaused,
    pausedElapsedTime,
    setPausedElapsedTime,
    navigateToProject,
    onClose,
    setTasks,
    timeEntries = [] // Add timeEntries prop for validation
}) => {
    const { showSuccess, showError } = useToast();
    const [currentTime, setCurrentTime] = useState('');
    const [pausedTime, setPausedTime] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [startTimeInput, setStartTimeInput] = useState('');
    const [noteInput, setNoteInput] = useState('');

    // Find the task associated with the current timer
    const currentTask = tasks.find(task => task.id === currentTimer?.taskId);
    
    // Find the project associated with the current task
    const currentProject = currentTask ? projects.find(project => project.id === currentTask.projectId) : null;

    /**
     * Handle clicking on task title to navigate to project
     */
    const handleTaskTitleClick = () => {
        if (currentProject && navigateToProject) {
            navigateToProject(currentProject.id);
        }
    };

    /**
     * Initialize start time input when timer changes
     */
    useEffect(() => {
        if (currentTimer) {
            const startDate = new Date(currentTimer.startTime);
            const timeString = startDate.toTimeString().slice(0, 8); // HH:MM:SS format
            setStartTimeInput(timeString);
            
            // Initialize note from timer if it exists
            setNoteInput(currentTimer.note || '');
        }
    }, [currentTimer]);

    /**
     * Handle form submission (update both start time and note)
     */
    const handleSubmitChanges = () => {
        if (!currentTimer) return;

        try {
            // Parse and validate start time if it was changed
            const [hours, minutes, seconds] = startTimeInput.split(':').map(Number);
            const currentDate = new Date(currentTimer.startTime);
            const newStartTime = new Date(currentDate);
            newStartTime.setHours(hours, minutes, seconds || 0);

            // Validate that the new start time is not in the future
            if (newStartTime.getTime() > Date.now()) {
                showError('Start time cannot be in the future');
                return;
            }

            // Get the project ID for the current task
            const currentTask = tasks.find(task => task.id === currentTimer.taskId);
            if (!currentTask) {
                showError('Task not found');
                return;
            }

            // Check for overlaps with existing time entries
            const overlapCheck = checkTimerStartOverlap(
                newStartTime.getTime(),
                Date.now(), // Current time as potential end time
                currentTask.projectId,
                timeEntries,
                tasks
            );

            if (!overlapCheck.isValid) {
                showError(overlapCheck.error);
                return;
            }

            // Update the timer with both start time and note
            setCurrentTimer({
                ...currentTimer,
                startTime: newStartTime.getTime(),
                note: noteInput.trim() || undefined
            });

            showSuccess('Timer updated successfully');
            setIsExpanded(false); // Collapse the expanded view
        } catch {
            showError('Invalid time format. Please use HH:MM:SS format');
        }
    };

    // Update timer display every second
    useEffect(() => {
        if (!currentTimer) return;
        
        // Don't return early for isPaused, we still want the initial update

        const updateTimer = () => {
            if (isPaused) return; // Only skip subsequent updates when paused
            // Calculate elapsed time in ms for active timer
            const elapsedMs = Date.now() - currentTimer.startTime;
            const formattedTime = formatActiveTimer(elapsedMs);
            setCurrentTime(formattedTime);
        };

        // Update immediately
        updateTimer();

        // Then update every second
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [currentTimer, isPaused]);

    // Initialize paused time display when component mounts and timer is already paused
    useEffect(() => {
        if (isPaused && pausedElapsedTime > 0) {
            const formattedPausedTime = formatDurationWithSeconds(pausedElapsedTime);
            setPausedTime(formattedPausedTime);
        }
    }, [isPaused, pausedElapsedTime]);

    // When paused, save the current time display (for transitions from running to paused)
    useEffect(() => {
        if (isPaused && currentTime) {
            setPausedTime(currentTime);
        }
    }, [isPaused, currentTime]);

    if (!currentTimer || !currentTask) {
        return null;
    }

    // Determine styles based on timer state
    // const bgColor = isPaused ? 'bg-yellow-50' : 'bg-red-50';
    const borderColor = isPaused ? 'border-yellow-200' : 'border-red-200';
    const dotColor = isPaused ? 'bg-yellow-500' : 'bg-red-500';
    const dotAnimation = isPaused ? '' : 'animate-pulse';
    const textColor = isPaused ? 'text-yellow-900' : 'text-red-900';
    const timeColor = isPaused ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100';

    return (
        <div className={`border ${borderColor} rounded-lg px-4 py-2 ${isExpanded ? 'space-y-3' : ''}`}>
            {/* Main timer row */}
            <div className="flex items-center space-x-3">
                {/* Timer info */}
                <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 ${dotColor} rounded-full ${dotAnimation}`}></div>
                    {currentProject ? (
                        <button
                            onClick={handleTaskTitleClick}
                            className={`text-sm font-medium ${textColor} max-w-[150px] truncate hover:underline cursor-pointer transition-colors`}
                            title={`${currentTask.title} - Click to open ${currentProject.title}`}
                        >
                            {currentTask.title}
                        </button>
                    ) : (
                        <span 
                            className={`text-sm font-medium ${textColor} max-w-[150px] truncate`} 
                            title={currentTask.title}
                        >
                            {currentTask.title}
                        </span>
                    )}
                    <span className={`text-sm font-mono ${timeColor} px-2 py-1 rounded-md min-w-[32px] inline-block text-center`}>
                        {isPaused ? pausedTime : currentTime}
                    </span>
                </div>

                {/* Control buttons and options toggle */}
                <div className="flex items-center space-x-2">
                    {/* Control buttons - using TaskTimer component */}
                    <TaskTimer
                        task={currentTask}
                        setTimeEntries={setTimeEntries}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        isGlobalTimer={true}
                        isPaused={isPaused}
                        setIsPaused={setIsPaused}
                        pausedElapsedTime={pausedElapsedTime}
                        setPausedElapsedTime={setPausedElapsedTime}
                        showTimeDisplay={false}
                        setTasks={setTasks}
                        onComplete={() => {
                            // Call onClose when timer is completely stopped
                            if (onClose) onClose();
                        }}
                    />
                    
                    {/* Options toggle button */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`p-1 ${textColor} hover:bg-gray-100 rounded-md transition-colors`}
                        title={isExpanded ? "Hide options" : "Show timer options"}
                    >
                        {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4" />
                        ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>

            {/* Expanded options */}
            {isExpanded && (
                <div className="border-t border-gray-200 pt-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Start Time Input */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Start Time
                            </label>
                            <input
                                type="time"
                                step="1"
                                value={startTimeInput}
                                onChange={(e) => setStartTimeInput(e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 px-2.5 py-1.5"
                            />
                        </div>

                        {/* Note Input */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Note
                            </label>
                            <input
                                type="text"
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                placeholder="What are you working on..."
                                className="w-full text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 px-2.5 py-1.5"
                            />
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmitChanges}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                        >
                            Update Timer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalTimer;
