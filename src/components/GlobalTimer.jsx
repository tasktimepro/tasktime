import React, { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';
import { formatDurationWithSeconds } from '../utils/dateUtils';
import { checkTimerStartOverlap } from '../utils/timeValidationUtils';
import TaskTimer from './TaskTimer';
import { useToast } from '../hooks/useToast';
import { useTimers } from '../hooks/useTimers';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { useTimeEntries } from '../hooks/useTimeEntries';

const createInitialDraftState = (isActive, startTime, note) => {
    if (!isActive || !startTime) {
        return {
            startTimeInput: '',
            noteInput: '',
        };
    }

    const startDate = new Date(startTime);
    return {
        startTimeInput: startDate.toTimeString().slice(0, 8),
        noteInput: note || '',
    };
};

/**
 * GlobalTimer component - Shows active timer in the header
 * Uses Yjs hooks for all state management
 * @param {Object} props - Component props
 * @param {Function} props.navigateToProject - Function to navigate to project page
 * @param {(task: Object) => void} props.onOpenTaskView - Open task view modal
 */
const GlobalTimer = ({
    navigateToProject,
     onOpenTaskView,
    timer = null,
    isExpanded: isExpandedProp,
    onToggleExpanded
}) => {
    const { showSuccess, showError } = useToast();
    
    // Yjs hooks for state
    const { timers, updateTimer } = useTimers();
    const focusedTimer = timers[0] || null;
    const timerData = timer || focusedTimer;
    const isActive = !!timerData;
    const isPaused = timerData?.isPaused || false;
    const taskId = timerData?.taskId || null;
    const elapsedTime = timerData?.elapsedTime || 0;
    const startTime = timerData?.startTime || null;
    const note = timerData?.note || '';
    const projectId = timerData?.projectId || null;
    const { tasks } = useTasks();
    const { projects } = useProjects();
    const { entries: timeEntries } = useTimeEntries();
    
    // Display time is computed directly from the timer's elapsedTime (which is synced via master clock)
    const displayTime = useMemo(() => {
        if (!isActive || elapsedTime === 0) return '0s';
        return formatDurationWithSeconds(elapsedTime);
    }, [isActive, elapsedTime]);
    
    const [isExpandedInternal, setIsExpandedInternal] = useState(false);
    const isExpanded = typeof isExpandedProp === 'boolean' ? isExpandedProp : isExpandedInternal;
    const [{ startTimeInput, noteInput }, setDraftState] = useState(() => createInitialDraftState(isActive, startTime, note));

    // Find the task associated with the current timer
    const currentTask = tasks.find(task => task.id === taskId);
    
    // Find the project associated with the current task
    const currentProject = currentTask ? projects.find(project => project.id === currentTask.projectId) : null;

    /**
     * Handle clicking on task title
     */
    const handleTaskTitleClick = () => {
        if (currentTask && onOpenTaskView) {
            onOpenTaskView(currentTask);
            return;
        }

        if (currentProject && navigateToProject) {
            navigateToProject(currentProject.id);
        }
    };

    /**
     * Handle form submission (update both start time and note)
     */
    const handleSubmitChanges = () => {
        if (!isActive || !startTime || !projectId) return;

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
            updateTimer(projectId, {
                startTime: newStartTime.getTime(),
                note: noteInput.trim() || undefined
            });

            showSuccess('Timer updated successfully');
            if (onToggleExpanded) {
                onToggleExpanded(false);
            } else {
                setIsExpandedInternal(false);
            }
        } catch {
            showError('Invalid time format. Please use HH:MM:SS format');
        }
    };

    // Display time is now computed via useMemo from elapsedTime (synced via master clock)
    // No interval needed - useTimers already provides synchronized elapsedTime updates

    if (!isActive || !currentTask) {
        return null;
    }

    // Determine styles based on timer state - using semantic colors with dark mode support
    const borderColor = isPaused ? 'status-warning-border' : 'status-danger-border';
    const dotColor = isPaused ? 'status-warning-fill' : 'status-danger-fill';
    const dotAnimation = isPaused ? '' : 'animate-pulse';
    const timeColor = isPaused ? 'status-warning-text status-warning-surface' : 'status-danger-text status-danger-surface';

    return (
        <div className={`min-w-0 rounded-lg border px-4 py-2 ${borderColor} ${isExpanded ? 'space-y-3 max-w-full md:min-w-[26rem]' : ''}`}>
            {/* Main timer row */}
            <div className="flex min-w-0 items-center justify-between gap-3">
                {/* Left column: dot + task title */}
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <div className={`h-3 w-3 shrink-0 ${dotColor} rounded-full ${dotAnimation}`}></div>
                    <button
                        onClick={handleTaskTitleClick}
                        className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-medium text-foreground transition-colors hover:underline"
                        title={currentProject ? `${currentTask.title} - Click to open ${currentProject.title}` : currentTask.title}
                    >
                        {currentTask.title}
                    </button>
                </div>

                {/* Right column: time + controls + options toggle */}
                <div className="flex shrink-0 items-center justify-end gap-2">
                    <span className={`inline-block shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-center text-sm font-mono ${timeColor}`}>
                        {displayTime}
                    </span>
                    {/* Control buttons - using TaskTimer component */}
                    {/* Note: We don't call onClose here because the timer stack 
                        automatically handles visibility based on active timer count.
                        onClose should only be used for explicit user actions to hide the stack. */}
                    <TaskTimer
                        task={currentTask}
                        isGlobalTimer={true}
                        showTimeDisplay={false}
                        timer={timerData}
                    />
                    
                    {/* Options toggle button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            const nextValue = !isExpanded;
                            if (onToggleExpanded) {
                                onToggleExpanded(nextValue);
                            } else {
                                setIsExpandedInternal(nextValue);
                            }
                        }}
                        className="h-8 w-8 shrink-0 transition-colors hover:bg-accent"
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
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                        {/* Start Time Input */}
                        <div>
                            <Label className="text-xs text-foreground" htmlFor="global-timer-start-time">
                                Start Time
                            </Label>
                            <TimePicker
                                id="global-timer-start-time"
                                value={startTimeInput}
                                onChange={(e) => setDraftState((prev) => ({ ...prev, startTimeInput: e.target.value }))}
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
                                onChange={(e) => setDraftState((prev) => ({ ...prev, noteInput: e.target.value }))}
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
                            onClick={() => {
                                if (onToggleExpanded) {
                                    onToggleExpanded(false);
                                } else {
                                    setIsExpandedInternal(false);
                                }
                            }}
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
