import React from 'react';
import { PlayIcon, PauseIcon, StopIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { generateId } from '../utils/idUtils.ts';
import { checkTimeOverlap } from '../utils/timeValidationUtils.ts';
import { useToast } from '../hooks/useToast.ts';

/**
 * TimerControls component - Handles task timer functionality
 * @param {Object} props - Component props
 * @param {Object} props.task - Task object
 * @param {Array} props.timeEntries - All time entries for validation
 * @param {Function} props.setTimeEntries - Function to update time entries
 * @param {Array} props.tasks - All tasks for overlap validation
 * @param {Object} props.currentTimer - Current active timer
 * @param {Function} props.setCurrentTimer - Function to update current timer
 * @param {string} props.size - Size variant ('sm' or normal)
 * @param {boolean} props.isGlobalTimer - Whether this is being used in global timer (affects styling)
 * @param {boolean} props.isPaused - Whether the timer is paused
 * @param {Function} props.setIsPaused - Function to set paused state
 * @param {number} props.pausedElapsedTime - Time elapsed when timer was paused
 * @param {Function} props.onComplete - Function called when timer is completely stopped
 */
function TimerControls({
    task,
    timeEntries = [],
    setTimeEntries,
    tasks = [],
    currentTimer,
    setCurrentTimer,
    size = 'normal',
    // New props for handling paused state
    isGlobalTimer = false,
    isPaused = false,
    setIsPaused = null,
    pausedElapsedTime = 0,
    setPausedElapsedTime = null,
    onComplete = null,
    setTasks = null
}) {
    const { showError } = useToast();
    const isTimerActive = currentTimer && currentTimer.taskId === task.id;

    /**
     * Validate and create a time entry with overlap checking
     * @param {string} taskId - Task ID for the entry
     * @param {number} startTime - Start timestamp
     * @param {number} endTime - End timestamp
     * @param {string} note - Optional note
     * @returns {boolean} - Whether the entry was created successfully
     */
    const createValidatedTimeEntry = (taskId, startTime, endTime, note) => {
        // Find the task to get its project ID
        const entryTask = tasks.find(t => t.id === taskId) || task;
        const projectId = entryTask?.projectId;

        // Only validate if we have tasks data for proper overlap checking
        if (tasks.length > 0 && projectId) {
            const overlapCheck = checkTimeOverlap(
                startTime,
                endTime,
                projectId,
                timeEntries,
                tasks
            );

            if (!overlapCheck.isValid) {
                showError(overlapCheck.error);
                return false;
            }
        }

        // Create the time entry
        const timeEntry = {
            id: generateId(),
            taskId: taskId,
            start: startTime,
            end: endTime,
            note: note
        };
        setTimeEntries(prevEntries => [...prevEntries, timeEntry]);
        return true;
    };

    /**
     * Start timer for current task
     */
    const startTimer = () => {
        // If there's a paused timer, we should resume it instead of creating a new one
        if (isPaused && currentTimer && currentTimer.taskId === task.id && setIsPaused) {
            resumeTimer();
            return;
        }
        
        // Stop any existing timer first
        if (currentTimer) {
            // Check if the existing timer is paused (for a different task)
            if (isPaused && setIsPaused && setPausedElapsedTime) {
                // For paused timer of different task, create time entry with paused time
                const created = createValidatedTimeEntry(
                    currentTimer.taskId,
                    currentTimer.startTime,
                    currentTimer.startTime + pausedElapsedTime,
                    currentTimer.note
                );
                if (!created) return; // Don't start new timer if validation failed
                
                // Reset paused state
                setIsPaused(false);
                setPausedElapsedTime(0);
            } else {
                // For running timer, create time entry with current time
                const created = createValidatedTimeEntry(
                    currentTimer.taskId,
                    currentTimer.startTime,
                    Date.now(),
                    currentTimer.note
                );
                if (!created) return; // Don't start new timer if validation failed
            }
        }

        // Start new timer
        setCurrentTimer({
            taskId: task.id,
            startTime: Date.now(),
            note: undefined // Initialize with no note
        });
        
        // If we have access to the isPaused state, make sure it's set to false
        if (setIsPaused) {
            setIsPaused(false);
        }
        
        // Reset paused elapsed time if we have access to it
        if (setPausedElapsedTime) {
            setPausedElapsedTime(0);
        }
    };

    /**
     * Resume a paused timer
     */
    const resumeTimer = () => {
        if (!currentTimer || !isPaused || currentTimer.taskId !== task.id) return;
        
        // When resuming, continue the existing timer from where it was paused
        // We need to adjust the startTime to account for the pause duration
        
        // Calculate how much time has passed during the pause
        const pauseDuration = Date.now() - (currentTimer.startTime + pausedElapsedTime);
        
        // Adjust the startTime to make sure the timer continues from the pause point
        setCurrentTimer({
            ...currentTimer,
            startTime: currentTimer.startTime + pauseDuration,
            note: currentTimer.note
        });
        
        setIsPaused(false);
    };

    /**
     * Pause timer but don't create time entry
     * Instead, just mark it as paused and save the elapsed time
     */
    const pauseTimer = () => {
        if (!currentTimer || currentTimer.taskId !== task.id) return;

        const now = Date.now();
        
        // If we have access to the isPaused state setter, use it
        if (setIsPaused) {
            // Calculate elapsed time up to the pause moment
            const elapsedTime = now - currentTimer.startTime;
            
            // Store the elapsed time in the paused state
            // We'll create the time entry only when the timer is resumed or stopped
            if (typeof setPausedElapsedTime === 'function') {
                setPausedElapsedTime(elapsedTime);
            }
            
            setIsPaused(true);
            
            // Update the task's lastActive property to keep it at the top of recent tasks
            setTasks?.(prevTasks => 
                prevTasks.map(t =>
                    t.id === task.id ? { ...t, lastActive: now } : t
                )
            );
        } else {
            // Legacy behavior - create entry and stop timer with validation
            // This branch should only run if called from a component that doesn't support pausing
            const created = createValidatedTimeEntry(
                task.id,
                currentTimer.startTime,
                now,
                currentTimer.note
            );
            if (created) {
                setCurrentTimer(null);
            }
        }
    };

    /**
     * Stop timer completely and remove it
     */
    const stopTimer = () => {

        if (!currentTimer || currentTimer.taskId !== task.id) return;

        const now = Date.now();
        
        // Create the appropriate time entry based on the timer's state with validation
        let created = false;
        if (isPaused) {
            // For paused timer, use the paused elapsed time
            created = createValidatedTimeEntry(
                task.id,
                currentTimer.startTime,
                currentTimer.startTime + pausedElapsedTime,
                currentTimer.note
            );
        } else {
            // For active timer, calculate duration from start to now
            created = createValidatedTimeEntry(
                task.id,
                currentTimer.startTime,
                now,
                currentTimer.note
            );
        }
        
        // Only proceed with cleanup if entry was created successfully
        if (!created) return;
        
        // Update the task's lastActive property to keep it at the top of recent tasks
        if (setTasks) {
            setTasks(prevTasks => 
                prevTasks.map(t =>
                    t.id === task.id ? { ...t, lastActive: now } : t
                )
            );
        }

        // Remove the timer entirely
        setCurrentTimer(null);
        
        // Reset paused state and elapsed time if we have access to them
        if (setIsPaused) {
            setIsPaused(false);
        }
        
        if (setPausedElapsedTime) {
            setPausedElapsedTime(0);
        }
        
        // Call onComplete callback if provided
        if (onComplete) {
            onComplete();
        }
    };

    // Determine icon size based on size prop
    const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-5 w-5';

    return (
        <div className="flex items-center space-x-1">
            {!isTimerActive ? (
                // Start button - shown when no timer active for this task
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={startTimer}
                    className="h-8 w-8 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
                    title="Start Timer"
                >
                    <PlayIcon className={iconSize} />
                </Button>
            ) : isPaused ? (
                // For paused state, show resume and stop buttons
                <div className="flex space-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={resumeTimer}
                        className="h-8 w-8 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
                        title="Resume Timer"
                    >
                        <PlayIcon className={iconSize} />
                    </Button>
                    {isGlobalTimer && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={stopTimer}
                            className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-accent"
                            title="Save & Stop Timer"
                        >
                            <StopIcon className={iconSize} />
                        </Button>
                    )}
                </div>
            ) : (
                // For active (running) state, show pause and stop buttons
                <div className="flex space-x-1">
                    {isGlobalTimer ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={pauseTimer}
                            className="h-8 w-8 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-accent"
                            title="Pause Timer"
                        >
                            <PauseIcon className={iconSize} />
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={pauseTimer}
                            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-accent"
                            title="Pause Timer"
                            leadingIcon={PauseIcon}
                        >
                            Pause
                        </Button>
                    )}
                    {isGlobalTimer ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={stopTimer}
                            className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-accent"
                            title="Save & Stop Timer"
                        >
                            <StopIcon className={iconSize} />
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={stopTimer}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-accent"
                            title="Save & Stop Timer"
                            leadingIcon={StopIcon}
                        >
                            Stop
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

export default React.memo(TimerControls);
