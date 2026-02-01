/**
 * TaskPreviewModal - Quick preview modal for tasks in the planner
 * 
 * Shows task details with timer controls and quick actions.
 * Lightweight alternative to opening the full task edit modal.
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTimers } from '@/hooks/useTimers';
import { useTasks } from '@/hooks/useTasks';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useProjects } from '@/hooks/useProjects';
import { usePlannerAttachments } from '@/hooks/usePlannerAttachments';
import { useToast } from '@/hooks/useToast';
import { formatDuration } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object} props.task - Task entity to preview
 * @param {string} props.dateStr - Date context (for recurring completion)
 * @param {Object} props.attachment - PlannerAttachment if attached
 * @param {Function} props.onEdit - Called when user wants to edit the task
 * @param {Function} props.onDelete - Called when user wants to delete the task
 */
const TaskPreviewModal = ({
    isOpen,
    onClose,
    task,
    dateStr,
    attachment,
    onEdit,
    onDelete,
}) => {

    const { showSuccess, showError } = useToast();
    const { projects } = useProjects();
    const { updateTask, toggleRecurringCompletion, isCompletedOnDate } = useTasks();
    const { updateAttachment, deleteAttachment } = usePlannerAttachments();
    const { 
        getTimerForTask, 
        startTimer, 
        pauseTimer, 
        resumeTimer, 
        clearTimer 
    } = useTimers();
    const { createEntry } = useTimeEntries();

    // Local state for estimated hours input
    const [estimatedHours, setEstimatedHours] = useState('');

    // Sync estimated hours from attachment when it changes
    useEffect(() => {
        if (attachment?.estimatedHours) {
            setEstimatedHours(String(attachment.estimatedHours));
        } else {
            setEstimatedHours('');
        }
    }, [attachment]);

    // Get project info
    const project = useMemo(() => {
        if (!task?.projectId) return null;
        return projects.find(p => p.id === task.projectId) || null;
    }, [task, projects]);

    // Timer state
    const timer = useMemo(() => {
        if (!task) return null;
        return getTimerForTask(task.id, task.projectId);
    }, [task, getTimerForTask]);

    const isTimerActive = !!timer && timer.taskId === task?.id;
    const isTimerPaused = isTimerActive && timer?.isPaused;

    // Check completion state (for recurring tasks, check specific date)
    const isCompleted = useMemo(() => {
        if (!task) return false;
        if (task.recurring && dateStr) {
            return isCompletedOnDate(task, dateStr);
        }
        return task.completed;
    }, [task, dateStr, isCompletedOnDate]);

    // Calculate elapsed time for active timer
    const elapsedTime = useMemo(() => {
        if (!timer) return 0;
        if (timer.isPaused) {
            return timer.pausedDuration || 0;
        }
        // If running, calculate from start time
        return Date.now() - timer.startTime + (timer.pausedDuration || 0);
    }, [timer]);

    // Timer handlers
    const handleStart = useCallback(() => {
        if (!task) return;
        startTimer(task.id, task.projectId);
        showSuccess('Timer started');
    }, [task, startTimer, showSuccess]);

    const handlePause = useCallback(() => {
        if (!task) return;
        pauseTimer(task.projectId || task.id);
        showSuccess('Timer paused');
    }, [task, pauseTimer, showSuccess]);

    const handleResume = useCallback(() => {
        if (!task) return;
        resumeTimer(task.projectId || task.id);
        showSuccess('Timer resumed');
    }, [task, resumeTimer, showSuccess]);

    const handleStop = useCallback(() => {
        if (!task || !timer) return;
        
        const timerKey = task.projectId || task.id;
        const endTime = Date.now();
        const startTime = timer.startTime;
        
        // Create time entry
        createEntry({
            taskId: task.id,
            start: startTime,
            end: endTime,
            note: '',
        });
        
        // Clear timer
        clearTimer(timerKey);
        showSuccess('Time entry created');
    }, [task, timer, createEntry, clearTimer, showSuccess]);

    // Toggle completion
    const handleToggleComplete = useCallback(() => {
        if (!task) return;
        
        if (task.recurring && dateStr) {
            toggleRecurringCompletion(task.id, dateStr);
            showSuccess(isCompleted ? 'Marked as incomplete' : 'Marked as complete');
        } else {
            updateTask(task.id, { completed: !task.completed });
            showSuccess(task.completed ? 'Marked as incomplete' : 'Marked as complete');
        }
    }, [task, dateStr, isCompleted, toggleRecurringCompletion, updateTask, showSuccess]);

    // Edit handler
    const handleEdit = useCallback(() => {
        onClose();
        onEdit?.(task);
    }, [task, onClose, onEdit]);

    // Delete handler
    const handleDelete = useCallback(() => {
        onClose();
        onDelete?.(task);
    }, [task, onClose, onDelete]);

    // Save estimated hours to attachment
    const handleSaveEstimatedHours = useCallback(() => {
        if (!attachment) return;
        
        const hours = parseFloat(estimatedHours);
        if (estimatedHours && (isNaN(hours) || hours < 0)) {
            showError('Please enter a valid number of hours');
            return;
        }

        updateAttachment(attachment.id, { 
            estimatedHours: estimatedHours ? hours : null 
        });
        showSuccess('Estimated hours updated');
    }, [attachment, estimatedHours, updateAttachment, showSuccess, showError]);

    // Remove attachment from planner
    const handleRemoveFromPlanner = useCallback(() => {
        if (!attachment) return;
        deleteAttachment(attachment.id);
        showSuccess('Removed from planner');
        onClose();
    }, [attachment, deleteAttachment, showSuccess, onClose]);

    if (!task) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className={cn(
                        "flex items-start gap-2",
                        isCompleted && "text-muted-foreground"
                    )}>
                        <span className={cn(isCompleted && "line-through")}>
                            {task.title}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {/* Task metadata */}
                <div className="space-y-2 text-sm">
                    {project && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="truncate">{project.title}</span>
                        </div>
                    )}

                    {task.recurring && (
                        <div className="text-muted-foreground">
                            {task.recurring.frequency === 'daily' && 'Recurring: Daily'}
                            {task.recurring.frequency === 'weekly' && `Recurring: Weekly on ${task.recurring.daysOfWeek?.join(', ')}`}
                            {task.recurring.frequency === 'monthly' && 'Recurring: Monthly'}
                        </div>
                    )}

                    {task.startDate && !task.recurring && (
                        <div className="text-muted-foreground">
                            Start date: {task.startDate}
                        </div>
                    )}

                    {task.note && (
                        <p className="text-muted-foreground whitespace-pre-wrap">
                            {task.note}
                        </p>
                    )}
                </div>

                {/* Timer controls */}
                <div className="flex items-center gap-2 py-2 border-t border-b">
                    {!isTimerActive ? (
                        <Button 
                            variant="default" 
                            size="sm" 
                            className="flex-1"
                            onClick={handleStart}
                        >
                            Start Timer
                        </Button>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 flex-1">
                                <span className="font-mono text-sm">
                                    {formatDuration(Math.floor(elapsedTime / 1000))}
                                </span>
                            </div>
                            
                            {isTimerPaused ? (
                                <Button 
                                    variant="outline" 
                                    onClick={handleResume}
                                >
                                    Resume
                                </Button>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    onClick={handlePause}
                                >
                                    Pause
                                </Button>
                            )}
                            
                            <Button 
                                variant="outline" 
                                onClick={handleStop}
                            >
                                Stop
                            </Button>
                        </>
                    )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2">
                    <Button
                        variant={isCompleted ? "secondary" : "outline"}
                        size="sm"
                        onClick={handleToggleComplete}
                        className="flex-1"
                    >
                        {isCompleted ? 'Undo' : 'Complete'}
                    </Button>
                    
                    <Button
                        variant="outline"
                        onClick={handleEdit}
                    >
                        Edit
                    </Button>
                    
                    <Button
                        variant="outline"
                        onClick={handleDelete}
                    >
                        Delete
                    </Button>
                </div>

                {/* Planner attachment settings */}
                {attachment && (
                    <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="estimated-hours" className="text-sm text-muted-foreground whitespace-nowrap">
                                Estimated hours
                            </Label>
                            <Input
                                id="estimated-hours"
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="e.g. 2"
                                value={estimatedHours}
                                onChange={(e) => setEstimatedHours(e.target.value)}
                                onBlur={handleSaveEstimatedHours}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveEstimatedHours();
                                    }
                                }}
                                className="w-24 h-8"
                            />
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveFromPlanner}
                            className="text-muted-foreground hover:text-destructive w-full"
                        >
                            Remove from planner
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default TaskPreviewModal;
