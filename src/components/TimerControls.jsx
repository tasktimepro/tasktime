import React, { useCallback } from 'react';
import { PlayIcon, PauseIcon, StopIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { checkTimeOverlap } from '../utils/timeValidationUtils.ts';
import { useToast } from '../hooks/useToast.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { useTimeEntries } from '../hooks/useTimeEntries.ts';
import { useTasks } from '../hooks/useTasks.ts';

/**
 * TimerControls component - Handles task timer functionality using Yjs hooks directly
 * 
 * @param {Object} props - Component props
 * @param {Object} props.task - Task object for this timer
 * @param {string} props.size - Size variant ('sm' or normal)
 * @param {boolean} props.isGlobalTimer - Whether this is being used in global timer (affects styling)
 * @param {Function} props.onComplete - Function called when timer is completely stopped
 */
function TimerControls({
    task,
    size = 'normal',
    isGlobalTimer = false,
    onComplete = null
}) {
    const { showError } = useToast();
    
    // Use Yjs hooks directly
    const {
        getTimerForTask,
        startTimer: timerStart,
        pauseTimer: timerPause,
        resumeTimer: timerResume,
        clearTimer
    } = useTimers();
    
    const { entries, createEntry } = useTimeEntries();
    const { activeTasks, updateTask } = useTasks();
    
    const projectId = task.projectId;
    const timerKey = projectId || task.id;
    const projectTimer = getTimerForTask(task.id, projectId);
    const isTimerActive = !!projectTimer && projectTimer.taskId === task.id;
    const isTimerPaused = isTimerActive && projectTimer.isPaused;

    /**
     * Validate time entry doesn't overlap with existing entries
     */
    const validateTimeEntry = useCallback((taskId, entryStartTime, endTime) => {
        const entryTask = activeTasks.find(t => t.id === taskId) || task;
        const projectId = entryTask?.projectId;

        if (activeTasks.length > 0 && projectId) {
            const overlapCheck = checkTimeOverlap(
                entryStartTime,
                endTime,
                projectId,
                entries,
                activeTasks
            );

            if (!overlapCheck.isValid) {
                showError(overlapCheck.error);
                return false;
            }
        }
        return true;
    }, [activeTasks, entries, task, showError]);

    /**
     * Create a time entry with overlap validation
     */
    const createValidatedEntry = useCallback((taskId, start, end, entryNote) => {
        if (!validateTimeEntry(taskId, start, end)) {
            return false;
        }
        createEntry({ taskId, start, end, note: entryNote });
        return true;
    }, [validateTimeEntry, createEntry]);

    /**
     * Start timer for current task
     */
    const handleStart = useCallback(() => {
        // If this task's timer is paused, resume it
        if (isTimerPaused) {
            timerResume(timerKey);
            return;
        }
        
        // If another timer in this project is running, stop it first and create its entry
        if (projectTimer && projectTimer.taskId !== task.id) {
            const existingStart = projectTimer.startTime;
            const existingEnd = projectTimer.isPaused
                ? (existingStart + projectTimer.elapsedTime)
                : Date.now();

            if (!createValidatedEntry(projectTimer.taskId, existingStart, existingEnd, projectTimer.note)) {
                return;
            }
            clearTimer(timerKey);
        }

        // Start new timer
        timerStart(task.id);
    }, [isTimerPaused, projectTimer, task.id, timerKey, timerResume, createValidatedEntry, clearTimer, timerStart]);

    /**
     * Pause the timer
     */
    const handlePause = useCallback(() => {
        if (!isTimerActive) return;
        
        timerPause(timerKey);
        
        // Update task's lastActive
        updateTask(task.id, { lastActive: Date.now() });
    }, [isTimerActive, timerPause, updateTask, task.id, timerKey]);

    /**
     * Resume a paused timer
     */
    const handleResume = useCallback(() => {
        if (!isTimerPaused) return;
        timerResume(timerKey);
    }, [isTimerPaused, timerResume, timerKey]);

    /**
     * Stop timer and create time entry
     */
    const handleStop = useCallback(() => {
        if (!isTimerActive || !projectTimer) return;

        const now = Date.now();
        const entryStart = projectTimer.startTime;
        const entryEnd = projectTimer.isPaused
            ? entryStart + projectTimer.elapsedTime
            : now;
        
        // Validate and create entry
        if (!createValidatedEntry(task.id, entryStart, entryEnd, projectTimer.note)) {
            return; // Don't clear timer if validation failed
        }
        
        // Update task's lastActive
        updateTask(task.id, { lastActive: now });
        
        // Clear the timer
        clearTimer(timerKey);
        
        // Call completion callback
        if (onComplete) {
            onComplete();
        }
    }, [isTimerActive, projectTimer, task.id,
        createValidatedEntry, updateTask, clearTimer, onComplete, timerKey]);

    // Determine icon size based on size prop
    const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-5 w-5';

    return (
        <div className="flex items-center gap-2">
            {!isTimerActive ? (
                // Start button - shown when no timer active for this task
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStart}
                    className="h-8 w-8 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
                    title="Start Timer"
                >
                    <PlayIcon className={iconSize} />
                </Button>
            ) : isTimerPaused ? (
                // For paused state, show resume and stop buttons (icons only)
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleResume}
                        className="h-8 w-8 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900"
                        title="Resume Timer"
                    >
                        <PlayIcon className={iconSize} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleStop}
                        className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-accent"
                        title="Save & Stop Timer"
                    >
                        <StopIcon className={iconSize} />
                    </Button>
                </div>
            ) : (
                // For active (running) state, show pause and stop buttons
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePause}
                        className="h-8 w-8 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-accent"
                        title="Pause Timer"
                    >
                        <PauseIcon className={iconSize} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleStop}
                        className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-accent"
                        title="Save & Stop Timer"
                    >
                        <StopIcon className={iconSize} />
                    </Button>
                </div>
            )}
        </div>
    );
}

export default React.memo(TimerControls);
