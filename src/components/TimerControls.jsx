import React, { useCallback, useRef } from 'react';
import { PlayIcon, PauseIcon, StopIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { useToast } from '../hooks/useToast.ts';
import { useTimers } from '../hooks/useTimers.ts';
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
    onStart = null,
    timer = null,
}) {
    const { showError } = useToast();
    const pausePointerDownAtRef = useRef(null);
    
    // Use Yjs hooks directly
    const {
        getTimerForTask,
        startTimer: timerStart,
        pauseTimer: timerPause,
        resumeTimer: timerResume,
        stopTimer,
    } = useTimers();
    
    const { updateTask } = useTasks();
    
    const projectId = task.projectId;
    const timerKey = projectId || task.id;
    const projectTimer = timer || getTimerForTask(task.id, projectId);
    const isTimerActive = !!projectTimer && projectTimer.taskId === task.id;
    const isTimerPaused = isTimerActive && projectTimer.isPaused;

    /**
     * Start timer for current task
     */
    const handleStart = useCallback(async () => {
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
            try {
                if (!await stopTimer(timerKey)) {
                    showError('Could not stop the existing timer.');
                    return;
                }
            } catch (error) {
                showError(error instanceof Error ? error.message : 'Could not stop the existing timer.');
                return;
            }
        }

        // Start new timer
        timerStart(task.id);
        if (onStart) {
            onStart();
        }
    }, [isTimerPaused, projectTimer, task.id, timerKey, timerResume, stopTimer, showError, timerStart, onStart]);

    /**
     * Pause the timer
     */
    const handlePause = useCallback(() => {
        if (!isTimerActive) return;

        const pauseTimestamp = pausePointerDownAtRef.current;
        pausePointerDownAtRef.current = null;
        timerPause(timerKey, pauseTimestamp ?? undefined);
        
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
    const handleStop = useCallback(async () => {
        if (!isTimerActive || !projectTimer) return;

        const now = Date.now();
        try {
            if (!await stopTimer(timerKey)) return;
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Could not stop the timer.');
            return;
        }
        
        // Update task's lastActive
        updateTask(task.id, { lastActive: now });
        
        // Call completion callback
        if (onComplete) {
            onComplete();
        }
    }, [isTimerActive, projectTimer, task.id,
        stopTimer, updateTask, onComplete, showError, timerKey]);

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
                        onPointerDown={() => {
                            const displayedPauseTime = projectTimer
                                && typeof projectTimer.startTime === 'number'
                                && typeof projectTimer.elapsedTime === 'number'
                                ? projectTimer.startTime + projectTimer.elapsedTime
                                : Date.now();

                            pausePointerDownAtRef.current = displayedPauseTime;
                        }}
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
