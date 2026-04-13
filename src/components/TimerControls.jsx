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
 * @param {Function} props.onComplete - Function called when timer is completely stopped
 * @param {Function} props.onStart - Function called when timer is started or resumed
 */
function TimerControls({
    task,
    size = 'normal',
    onComplete = null,
    onStart = null
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
    const createValidatedEntry = useCallback((taskId, start, end, entryNote, stoppedTimerKey) => {
        if (!validateTimeEntry(taskId, start, end)) {
            return false;
        }
        createEntry({ taskId, start, end, note: entryNote, _stoppedTimerKey: stoppedTimerKey });
        return true;
    }, [validateTimeEntry, createEntry]);

    /**
     * Start timer for current task
     */
    const handleStart = useCallback(() => {
        // If this task's timer is paused, resume it
        if (isTimerPaused) {
            timerResume(timerKey);
            if (onStart) {
                onStart();
            }
            return;
        }
        
        // If another timer in this project is running, stop it first and create its entry
        if (projectTimer && projectTimer.taskId !== task.id) {
            const existingStart = projectTimer.startTime;
            const existingEnd = projectTimer.isPaused
                ? (existingStart + projectTimer.elapsedTime)
                : Date.now();

            if (!createValidatedEntry(projectTimer.taskId, existingStart, existingEnd, projectTimer.note, timerKey)) {
                return;
            }
            clearTimer(timerKey);
        }

        // Start new timer
        timerStart(task.id);
        if (onStart) {
            onStart();
        }
    }, [isTimerPaused, projectTimer, task.id, timerKey, timerResume, createValidatedEntry, clearTimer, timerStart, onStart]);

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
        if (onStart) {
            onStart();
        }
    }, [isTimerPaused, timerResume, timerKey, onStart]);

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
        if (!createValidatedEntry(task.id, entryStart, entryEnd, projectTimer.note, timerKey)) {
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
        <div className="flex shrink-0 items-center gap-2">
            {!isTimerActive ? (
                // Start button - shown when no timer active for this task
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStart}
                    className="status-success-action h-8 w-8 shrink-0 status-success-text-strong"
                    title="Start Timer"
                >
                    <PlayIcon className={iconSize} />
                </Button>
            ) : isTimerPaused ? (
                // For paused state, show resume and stop buttons (icons only)
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleResume}
                        className="status-success-action h-8 w-8 shrink-0 status-success-text-strong"
                        title="Resume Timer"
                    >
                        <PlayIcon className={iconSize} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleStop}
                        className="status-danger-action h-8 w-8 shrink-0 status-danger-text-strong"
                        title="Save & Stop Timer"
                    >
                        <StopIcon className={iconSize} />
                    </Button>
                </div>
            ) : (
                // For active (running) state, show pause and stop buttons
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePause}
                        className="status-warning-action h-8 w-8 shrink-0 status-warning-text-strong"
                        title="Pause Timer"
                    >
                        <PauseIcon className={iconSize} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleStop}
                        className="status-danger-action h-8 w-8 shrink-0 status-danger-text-strong"
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
