import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';
import { formatActiveTimer, formatDurationWithSeconds } from '../utils/dateUtils';
import { checkTimerStartOverlap } from '../utils/timeValidationUtils';
import TaskTimer from './TaskTimer';
import { useToast } from '../hooks/useToast';
import { useTimer } from '../hooks/useTimer';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { TIMER_UPDATE_INTERVAL_MS } from '../constants/app';

/**
 * GlobalTimer component - Shows active timer in the header
 * Uses Yjs hooks for all state management
 * @param {Object} props - Component props
 * @param {Function} props.navigateToProject - Function to navigate to project page
 * @param {Function} props.onClose - Function called when timer is closed
 */
const GlobalTimer = ({
    navigateToProject,
    onClose
}) => {
    const { showSuccess, showError } = useToast();
    
    // Yjs hooks for state
    const { isActive, isPaused, taskId, elapsedTime, startTime, note, updateTimer } = useTimer();
    const { tasks } = useTasks();
    const { projects } = useProjects();
    const { entries: timeEntries } = useTimeEntries();
    
    const [displayTime, setDisplayTime] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [startTimeInput, setStartTimeInput] = useState('');
    const [noteInput, setNoteInput] = useState('');

    // Find the task associated with the current timer
    const currentTask = tasks.find(task => task.id === taskId);
    
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
        if (isActive && startTime) {
            const startDate = new Date(startTime);
            const timeString = startDate.toTimeString().slice(0, 8); // HH:MM:SS format
            setStartTimeInput(timeString);
            
            // Initialize note from timer if it exists
            setNoteInput(note || '');
        }
    }, [isActive, startTime, note]);

    /**
     * Handle form submission (update both start time and note)
     */
    const handleSubmitChanges = () => {
        if (!isActive || !startTime) return;

        try {
            // Parse and validate start time if it was changed
            const [hours, minutes, seconds] = startTimeInput.split(':').map(Number);
            const currentDate = new Date(startTime);
            const newStartTime = new Date(currentDate);
            newStartTime.setHours(hours, minutes, seconds || 0);

            // Validate that the new start time is not in the future
            if (newStartTime.getTime() > Date.now()) {
                showError('Start time cannot be in the future');
                return;
            }

            // Get the project ID for the current task
            const task = tasks.find(t => t.id === taskId);
            if (!task) {
                showError('Task not found');
                return;
            }

            // Check for overlaps with existing time entries
            const overlapCheck = checkTimerStartOverlap(
                newStartTime.getTime(),
                Date.now(), // Current time as potential end time
                task.projectId,
                timeEntries,
                tasks
            );

            if (!overlapCheck.isValid) {
                showError(overlapCheck.error);
                return;
            }

            // Update the timer with both start time and note
            updateTimer({
                startTime: newStartTime.getTime(),
                note: noteInput.trim() || undefined
            });

            showSuccess('Timer updated successfully');
            setIsExpanded(false); // Collapse the expanded view
        } catch {
            showError('Invalid time format. Please use HH:MM:SS format');
        }
    };

    // Update timer display every second (only when not paused)
    useEffect(() => {
        if (!isActive || !startTime) return;
        
        // When paused, don't update - just keep the frozen display time
        if (isPaused) return;

        const updateTimerDisplay = () => {
            // Calculate elapsed time in ms for active timer
            const elapsedMs = Date.now() - startTime;
            const formattedTime = formatActiveTimer(elapsedMs);
            setDisplayTime(formattedTime);
        };

        // Update immediately
        updateTimerDisplay();

        // Then update every second
        const interval = setInterval(updateTimerDisplay, TIMER_UPDATE_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isActive, startTime, isPaused]);

    // Initialize display time when component mounts with a paused timer
    // or when elapsedTime changes while paused
    useEffect(() => {
        if (isPaused && elapsedTime > 0) {
            const formattedPausedTime = formatDurationWithSeconds(elapsedTime);
            setDisplayTime(formattedPausedTime);
        }
    }, [isPaused, elapsedTime]);

    if (!isActive || !currentTask) {
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
                        {displayTime}
                    </span>
                </div>

                {/* Control buttons and options toggle */}
                <div className="flex items-center space-x-3">
                    {/* Control buttons - using TaskTimer component */}
                    <TaskTimer
                        task={currentTask}
                        isGlobalTimer={true}
                        showTimeDisplay={false}
                        onComplete={() => {
                            // Call onClose when timer is completely stopped
                            if (onClose) onClose();
                        }}
                    />
                    
                    {/* Options toggle button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`h-8 w-8 ${textColor} hover:bg-accent transition-colors`}
                        title={isExpanded ? "Hide options" : "Show timer options"}
                    >
                        {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4" />
                        ) : (
                            <ChevronDownIcon className="h-4 w-4" />
                        )}
                    </Button>
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
