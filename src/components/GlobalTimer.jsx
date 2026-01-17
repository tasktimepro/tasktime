import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';
import { formatActiveTimer, formatDurationWithSeconds } from '../utils/dateUtils';
import { checkTimerStartOverlap } from '../utils/timeValidationUtils';
import TaskTimer from './TaskTimer.jsx';
import { useToast } from '../hooks/useToast';
import { TIMER_UPDATE_INTERVAL_MS } from '../constants/app';

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
        const interval = setInterval(updateTimer, TIMER_UPDATE_INTERVAL_MS);

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

    // Determine styles based on timer state - using semantic colors with dark mode support
    const borderColor = isPaused ? 'border-yellow-300 dark:border-yellow-700' : 'border-red-300 dark:border-red-700';
    const dotColor = isPaused ? 'bg-yellow-500 dark:bg-yellow-400' : 'bg-red-500 dark:bg-red-400';
    const dotAnimation = isPaused ? '' : 'animate-pulse';
    const textColor = isPaused ? 'text-yellow-900 dark:text-yellow-100' : 'text-red-900 dark:text-red-100';
    const timeColor = isPaused ? 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900' : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900';

    return (
        <div className={`border ${borderColor} rounded-lg px-4 py-2 ${isExpanded ? 'space-y-3 w-[26rem] max-w-full' : ''}`}>
            {/* Main timer row */}
            <div className="flex items-center justify-center space-x-3">
                {/* Timer info */}
                <div className="flex items-center space-x-3">
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
                <div className="flex items-center space-x-3">
                    {/* Control buttons - using TaskTimer component */}
                    <TaskTimer
                        task={currentTask}
                        timeEntries={timeEntries}
                        setTimeEntries={setTimeEntries}
                        tasks={tasks}
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
                        className={`p-1 ${textColor} hover:bg-muted rounded-md transition-colors`}
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
                <div className="border-t border-border pt-3 pb-2 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)] gap-3">
                        {/* Start Time Input */}
                        <div>
                            <Label className="text-xs text-foreground" htmlFor="global-timer-start-time">
                                Start Time
                            </Label>
                            <TimePicker
                                id="global-timer-start-time"
                                value={startTimeInput}
                                onChange={(e) => setStartTimeInput(e.target.value)}
                                className="mt-1 h-8 text-sm"
                            />
                        </div>

                        {/* Note Input */}
                        <div>
                            <Label className="text-xs text-foreground" htmlFor="global-timer-note">
                                Note
                            </Label>
                            <Input
                                id="global-timer-note"
                                type="text"
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                placeholder="What are you working on..."
                                className="mt-1 h-8 text-sm"
                            />
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end space-x-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmitChanges}
                        >
                            Update Timer
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(GlobalTimer);
