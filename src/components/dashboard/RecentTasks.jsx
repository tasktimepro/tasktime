import { useState } from 'react';
import { ClockIcon, LayoutListIcon, ListFilterIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CustomCheckbox from '../CustomCheckbox';
import { formatDurationWithSeconds } from '../../utils/dateUtils.ts';
import { useTimers } from '../../hooks/useTimers';
import useIsMobileLayout from '../../hooks/useIsMobileLayout';
import StartDateBadge from '../task/StartDateBadge';
import TaskActionsMenu from '../task/TaskActionsMenu';
import TimeEntriesModal from '../TimeEntriesModal';
import { TASK_FILTER_OPTIONS } from './dashboardOverviewUtils.ts';
import CardSearchControl from './CardSearchControl';

/**
 * RecentTasks component - Recent task list with search and controls.
 * @param {Object} props
 */
const RecentTasks = ({
    recentTasks,
    taskFilter,
    setTaskFilter,
    taskSearchQuery,
    setTaskSearchQuery,
    isLoading = false,
    handleCompleteTask,
    getTaskCompletedStatus,
    renderTaskTitle,
    renderTaskControls,
    onEditTask,
    onDeleteTask,
    onArchiveTask
}) => {
    const { getTimerForTask } = useTimers();
    const isMobileLayout = useIsMobileLayout();
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);
    const emptyStateMessage = taskSearchQuery
        ? 'No tasks found matching your search'
        : {
            recent: 'No recent tasks found',
            recurring: 'No recurring tasks found',
            completed: 'No completed tasks found',
            archived: 'No archived tasks found',
        }[taskFilter];

    const handleOpenTimeEntries = (task) => {
        setSelectedTask(task);
        setShowTimeEntriesModal(true);
    };

    const closeTimeEntries = () => {
        setShowTimeEntriesModal(false);
        setSelectedTask(null);
    };

    const renderTaskRow = (task, options = {}) => {
        const projectTimer = options.projectTimer ?? getTimerForTask(task.id, task.projectId);
        const taskForActions = options.taskForActions ?? task;
        const isTimerActive = !!projectTimer && projectTimer.taskId === task.id;
        const shouldDisable = !!projectTimer && !projectTimer.isPaused && !isTimerActive;
        const hideActions = !!projectTimer;
        const isCompleted = getTaskCompletedStatus(task);

        return (
            <div key={task.id} className={`px-2 py-2 hover:bg-muted sm:px-3 sm:py-2.5 ${shouldDisable ? 'opacity-50' : ''}`}>
                {isMobileLayout ? (
                    <div className="flex items-start gap-3">
                        {!task.recurring && (
                            <CustomCheckbox
                                checked={isCompleted}
                                onChange={(checked) => handleCompleteTask(task, checked)}
                                disabled={shouldDisable}
                            />
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5 overflow-hidden">
                            {renderTaskTitle(task, isCompleted)}
                            <div className="flex w-full flex-wrap items-center justify-end gap-2">
                                <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                                    {(task.startDate || task.recurring) && (
                                        <StartDateBadge
                                            startDate={task.startDate}
                                            recurring={task.recurring}
                                            completed={isCompleted}
                                        />
                                    )}
                                    {task.recentTime > 0 && (
                                        <div className={`text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                            {formatDurationWithSeconds(task.recentTime)}
                                        </div>
                                    )}
                                </div>
                                {(!shouldDisable || !hideActions) && (
                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                        {renderTaskControls(task, shouldDisable)}
                                        {!hideActions && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    title="Add time entry"
                                                    onClick={() => handleOpenTimeEntries(taskForActions)}
                                                >
                                                    <ClockIcon className="h-5 w-5" />
                                                </Button>
                                                <TaskActionsMenu
                                                    task={taskForActions}
                                                    onEdit={onEditTask}
                                                    onDelete={onDeleteTask}
                                                    onArchive={onArchiveTask}
                                                />
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {!task.recurring && (
                            <CustomCheckbox
                                checked={isCompleted}
                                onChange={(checked) => handleCompleteTask(task, checked)}
                                disabled={shouldDisable}
                            />
                        )}
                        <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                            {renderTaskTitle(task, isCompleted)}
                        </div>
                        {(task.startDate || task.recurring) && (
                            <StartDateBadge
                                startDate={task.startDate}
                                recurring={task.recurring}
                                completed={isCompleted}
                            />
                        )}
                        {task.recentTime > 0 && (
                            <div className={`flex-shrink-0 text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                {formatDurationWithSeconds(task.recentTime)}
                            </div>
                        )}
                        {(!shouldDisable || !hideActions) && (
                            <div className="flex flex-shrink-0 space-x-1">
                                {renderTaskControls(task, shouldDisable)}
                                {!hideActions && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            title="Add time entry"
                                            onClick={() => handleOpenTimeEntries(taskForActions)}
                                        >
                                            <ClockIcon className="h-5 w-5" />
                                        </Button>
                                        <TaskActionsMenu
                                            task={taskForActions}
                                            onEdit={onEditTask}
                                            onDelete={onDeleteTask}
                                            onArchive={onArchiveTask}
                                        />
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card>
            <CardHeader className="px-3 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="order-1 mr-auto flex items-center text-lg">
                        <LayoutListIcon className="status-info-text-strong mr-2 h-5 w-5" />
                        Tasks
                    </CardTitle>
                    <CardSearchControl
                        value={taskSearchQuery}
                        onChange={setTaskSearchQuery}
                        placeholder="Search tasks"
                        buttonLabel="Search tasks"
                        inputAriaLabel="Search tasks"
                        buttonClassName="order-2"
                        inputClassName="order-4 basis-full sm:order-3 sm:basis-auto"
                    />
                    <Select value={taskFilter} onValueChange={setTaskFilter}>
                            <SelectTrigger
                                className={isMobileLayout ? 'order-3 h-9 w-9' : 'order-4 w-[148px]'}
                                aria-label="Filter tasks"
                                leadingIcon={ListFilterIcon}
                                hideCaret={isMobileLayout}
                                iconOnly={isMobileLayout}
                            >
                                {isMobileLayout ? (
                                    <span className="sr-only">
                                        <SelectValue placeholder="Filter tasks" />
                                    </span>
                                ) : (
                                    <SelectValue placeholder="Filter tasks" />
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                {TASK_FILTER_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                </div>
            </CardHeader>
            <CardContent className="px-3 pb-2.5 pt-0 sm:px-5 sm:pb-4 max-h-96 overflow-y-auto">
                {isLoading ? (
                    <div className="px-6 py-8 text-center text-muted-foreground">
                        <LayoutListIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm">Loading archived tasks</p>
                    </div>
                ) : recentTasks.length > 0 ? (
                    <div className="divide-y divide-border">
                        {recentTasks.map((task) => {
                            const projectTimer = getTimerForTask(task.id, task.projectId);

                            return (
                                <div key={task.id}>
                                    {renderTaskRow(task, { projectTimer })}
                                    {/* Render subtasks if present */}
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <div className="ml-8 mt-2">
                                            {task.subtasks.map(subtask => {
                                                const subtaskWithProject = { ...subtask, project: task.project };

                                                return (
                                                    <div key={subtask.id}>
                                                        {renderTaskRow(subtaskWithProject, {
                                                            projectTimer,
                                                            taskForActions: subtaskWithProject,
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="px-6 py-8 text-center text-muted-foreground">
                        <LayoutListIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm">
                            {emptyStateMessage}
                        </p>
                    </div>
                )}
            </CardContent>

            {selectedTask && (
                <TimeEntriesModal
                    isOpen={showTimeEntriesModal}
                    onClose={closeTimeEntries}
                    task={selectedTask}
                />
            )}
        </Card>
    );
};

export default RecentTasks;
