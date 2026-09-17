import React, { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ExclamationCircleIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';
import { formatDurationWithSeconds, parseStoredDate, toDisplayDate, toStorageDate } from '../utils/dateUtils';
import { checkTimerStartOverlap } from '../utils/timeValidationUtils';
import TaskTimer from './TaskTimer';
import { useToast } from '../hooks/useToast';
import { useTimers } from '../hooks/useTimers';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useMasterClock } from '../hooks/useMasterClock';

/** Derive the preview and submitted interval from the same local-date draft. */
const getTimerEditPreview = (dateInput, timeInput, startTime, isPaused, elapsedTime, now) => {
    const [hours, minutes, seconds = 0] = timeInput.split(':').map(Number);
    const selectedDate = parseStoredDate(dateInput);
    if (!selectedDate || toStorageDate(selectedDate) !== dateInput
        || !/^\d{2}:\d{2}(?::\d{2})?$/.test(timeInput)
        || hours > 23 || minutes > 59 || seconds > 59) {
        return { error: 'Enter a valid start date and time' };
    }
    const originalDate = new Date(startTime);
    const timeUnchanged = dateInput === toStorageDate(originalDate)
        && timeInput === originalDate.toTimeString().slice(0, 8);
    // Preserve sub-second precision and the original occurrence of a repeated DST hour.
    const start = timeUnchanged ? startTime : selectedDate.setHours(hours, minutes, seconds, 0);
    const localStart = new Date(start);
    if (localStart.getHours() !== hours || localStart.getMinutes() !== minutes) {
        return { error: 'This start time does not exist on the selected date' };
    }
    if (!timeUnchanged && start > now) {
        return { error: 'Start time cannot be in the future' };
    }
    const end = isPaused ? startTime + elapsedTime : now;
    if (!timeUnchanged && start > end) {
        return { error: 'Start time cannot be after the timer was paused' };
    }
    return { start, end, timeUnchanged, duration: Math.max(0, end - start) };
};

const createInitialDraftState = (isActive, startTime, note) => {
    if (!isActive || !startTime) {
        return {
            startDateInput: '',
            startTimeInput: '',
            noteInput: '',
        };
    }

    const startDate = new Date(startTime);
    return {
        startDateInput: toStorageDate(startDate),
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
    const [isSaving, setIsSaving] = useState(false);
    const isExpanded = typeof isExpandedProp === 'boolean' ? isExpandedProp : isExpandedInternal;
    const [{ startDateInput, startTimeInput, noteInput }, setDraftState] = useState(() => createInitialDraftState(isActive, startTime, note));

    // Tick only while editing so paused timers also refresh their day labels at midnight.
    useMasterClock(isActive && isExpanded);
    const now = Date.now();
    const today = toStorageDate(new Date(now));
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = toStorageDate(yesterdayDate);
    const originalDay = startTime ? toStorageDate(new Date(startTime)) : '';
    // Keep absolute dates in the draft; midnight must never reinterpret a selection.
    const startDays = [...new Set([today, yesterday, originalDay, startDateInput].filter(Boolean))];
    const dayLabel = (date) => date === today ? 'Today' : date === yesterday ? 'Yesterday'
        : toDisplayDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
    const preview = getTimerEditPreview(startDateInput, startTimeInput, startTime, isPaused, elapsedTime, now);
    const rangeLabel = (timestamp) => {
        const date = new Date(timestamp);
        return `${dayLabel(toStorageDate(date))} ${date.toTimeString().slice(0, 8)}`;
    };

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
    const handleSubmitChanges = async () => {
        if (!isActive || !startTime || !projectId || isSaving) return;

        try {
            const submitted = getTimerEditPreview(startDateInput, startTimeInput, startTime, isPaused, elapsedTime, Date.now());
            if (submitted.error) {
                showError(submitted.error);
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
                submitted.start,
                submitted.end,
                task.projectId || task.id,
                timeEntries,
                tasks.map((candidate) => ({ ...candidate, projectId: candidate.projectId || candidate.id }))
            );

            if (!submitted.timeUnchanged && !overlapCheck.isValid) {
                showError(overlapCheck.error);
                return;
            }

            // Update the timer with both start time and note
            setIsSaving(true);
            await updateTimer(projectId, {
                startTime: submitted.start,
                note: noteInput.trim()
            });

            showSuccess('Timer updated successfully');
            if (onToggleExpanded) {
                onToggleExpanded(false);
            } else {
                setIsExpandedInternal(false);
            }
        } catch (error) {
            showError(error?.message || 'Unable to update timer');
        } finally {
            setIsSaving(false);
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
                    <div
                        aria-label="Timer active"
                        title="Timer active"
                        className={`h-3 w-3 shrink-0 ${dotColor} rounded-full ${dotAnimation}`}
                    />
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
                    <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                            <Label className="text-xs text-foreground" htmlFor="global-timer-start-day">
                                Start Day
                            </Label>
                            <Select
                                value={startDateInput}
                                disabled={isSaving}
                                onValueChange={(value) => setDraftState((prev) => ({ ...prev, startDateInput: value }))}
                            >
                                <SelectTrigger
                                    id="global-timer-start-day"
                                    aria-describedby="global-timer-preview"
                                    className="mt-1 h-8 min-w-0 text-sm"
                                    onKeyDown={(event) => event.stopPropagation()}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent onKeyDown={(event) => event.stopPropagation()}>
                                    {startDays.map((date) => <SelectItem key={date} value={date}>{dayLabel(date)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Start Time Input */}
                        <div>
                            <Label className="text-xs text-foreground" htmlFor="global-timer-start-time">
                                Start Time
                            </Label>
                            <TimePicker
                                id="global-timer-start-time"
                                aria-describedby="global-timer-preview"
                                aria-invalid={Boolean(preview.error)}
                                value={startTimeInput}
                                disabled={isSaving}
                                onChange={(e) => setDraftState((prev) => ({ ...prev, startTimeInput: e.target.value }))}
                                className="mt-1 h-8 text-sm"
                            />
                        </div>

                        <div id="global-timer-preview" role="group" aria-label="Timer preview" className={`col-span-2 text-xs ${preview.error ? '' : 'space-y-1 rounded-md bg-muted/50 px-3 py-2'}`}>
                            {preview.error ? (
                                <Notice
                                    compact
                                    variant="destructive"
                                    icon={ExclamationCircleIcon}
                                    description={preview.error}
                                    role="alert"
                                    className="[&_p]:text-xs [&_svg]:h-4 [&_svg]:w-4"
                                />
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <span className="text-muted-foreground">Timer duration</span>
                                        <strong className="text-sm font-medium tabular-nums">{formatDurationWithSeconds(preview.duration)}</strong>
                                    </div>
                                    <p className="text-muted-foreground">{rangeLabel(preview.start)} → {rangeLabel(preview.end)} ({isPaused ? 'paused' : 'now'})</p>
                                </>
                            )}
                        </div>
                        {/* Note Input */}
                        <div className="col-span-2">
                            <Label className="text-xs text-foreground" htmlFor="global-timer-note">
                                Note
                            </Label>
                            <Input
                                id="global-timer-note"
                                type="text"
                                value={noteInput}
                                disabled={isSaving}
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
                            disabled={isSaving || Boolean(preview.error)}
                        >
                            {isSaving ? 'Updating…' : 'Update Timer'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(GlobalTimer);
