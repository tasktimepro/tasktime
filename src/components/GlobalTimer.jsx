import React, { useState, useEffect, useMemo } from 'react';
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

/**
 * GlobalTimer component - Shows active timer in the header
 * Uses Yjs hooks for all state management
 * @param {Object} props - Component props
 * @param {Function} props.navigateToProject - Function to navigate to project page
 * @param {(task: Object) => void} props.onOpenTaskView - Open task view modal
 * @param {Function} props.onClose - Function called when timer is closed
 */
const GlobalTimer = ({
    navigateToProject,
     onOpenTaskView,
    onClose,
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
    const [startTimeInput, setStartTimeInput] = useState('');
    const [noteInput, setNoteInput] = useState('');

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
    const borderColor = isPaused ? 'border-yellow-300 dark:border-yellow-700' : 'border-red-300 dark:border-red-700';
    const dotColor = isPaused ? 'bg-yellow-500 dark:bg-yellow-400' : 'bg-red-500 dark:bg-red-400';
    const dotAnimation = isPaused ? '' : 'animate-pulse';
    const textColor = isPaused ? 'text-yellow-900 dark:text-yellow-100' : 'text-red-900 dark:text-red-100';
    const timeColor = isPaused ? 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900' : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900';

    return (
        <div className={`border ${borderColor} rounded-lg px-4 py-2 ${isExpanded ? 'space-y-3 min-w-[26rem] max-w-full' : ''}`}>
            {/* Main timer row */}
            <div className="flex items-center justify-between gap-4">
                {/* Left column: dot + task title */}
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-3 h-3 ${dotColor} rounded-full ${dotAnimation}`}></div>
                    <button
                        onClick={handleTaskTitleClick}
                        className={`text-sm font-medium ${textColor} max-w-[150px] truncate hover:underline cursor-pointer transition-colors`}
                        title={currentProject ? `${currentTask.title} - Click to open ${currentProject.title}` : currentTask.title}
                    >
                        {currentTask.title}
                    </button>
                </div>

                {/* Right column: time + controls + options toggle */}
                <div className="flex items-center gap-2 justify-end">
                    <span className={`text-sm font-mono ${timeColor} px-2 py-1 rounded-md min-w-[32px] inline-block text-center`}>
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
