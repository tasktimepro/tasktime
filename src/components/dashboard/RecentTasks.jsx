import { useState } from 'react';
import { ClockIcon, LayoutListIcon, MagnifyingGlassIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import CustomCheckbox from '../CustomCheckbox';
import { formatDurationWithSeconds } from '../../utils/dateUtils.ts';
import { useTimers } from '../../hooks/useTimers';
import StartDateBadge from '../task/StartDateBadge';
import TaskActionsMenu from '../task/TaskActionsMenu';
import TimeEntriesModal from '../TimeEntriesModal';

/**
 * RecentTasks component - Recent task list with search and controls.
 * @param {Object} props
 */
const RecentTasks = ({
    recentTasks,
    taskSearchQuery,
    setTaskSearchQuery,
    handleCompleteTask,
    getTaskCompletedStatus,
    renderTaskTitle,
    handleProjectTitleClick,
    renderTaskControls,
    onEditTask,
    onDeleteTask,
    onArchiveTask
}) => {
    const { getTimerForTask } = useTimers();
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);

    const handleOpenTimeEntries = (task) => {
        setSelectedTask(task);
        setShowTimeEntriesModal(true);
    };

    const closeTimeEntries = () => {
        setShowTimeEntriesModal(false);
        setSelectedTask(null);
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-lg">
                        <LayoutListIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                        Recent Tasks
                    </CardTitle>
                    <div className="relative">
                        <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <Input
                            type="text"
                            placeholder="Search tasks"
                            value={taskSearchQuery}
                            onChange={(e) => setTaskSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 max-h-96 overflow-y-auto">
                {recentTasks.length > 0 ? (
                    <div className="divide-y divide-border">
                        {recentTasks.map((task) => {
                            const projectTimer = getTimerForTask(task.id, task.projectId);
                            const isTimerActive = !!projectTimer && projectTimer.taskId === task.id;
                            const shouldDisable = !!projectTimer && !projectTimer.isPaused && !isTimerActive;
                            const hideActions = !!projectTimer;
                            const isCompleted = getTaskCompletedStatus(task);

                            return (
                                <div key={task.id} className={`px-3 py-3 hover:bg-muted ${shouldDisable ? 'opacity-50' : ''}`}>
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
                                        <div className={`flex-shrink-0 text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                            {formatDurationWithSeconds(task.recentTime)}
                                        </div>
                                        <div className="flex flex-shrink-0 space-x-1">
                                            {renderTaskControls(task, shouldDisable)}
                                            {!hideActions && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        title="Add time entry"
                                                        onClick={() => handleOpenTimeEntries(task)}
                                                    >
                                                        <ClockIcon className="h-5 w-5" />
                                                    </Button>
                                                    <TaskActionsMenu
                                                        task={task}
                                                        onEdit={onEditTask}
                                                        onDelete={onDeleteTask}
                                                        onArchive={onArchiveTask}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {/* Render subtasks if present */}
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <div className="ml-8 mt-2">
                                            {task.subtasks.map(subtask => {
                                                // Use project timer to check if subtask should be disabled
                                                const subtaskTimerActive = !!projectTimer && projectTimer.taskId === subtask.id;
                                                const subtaskShouldDisable = !!projectTimer && !projectTimer.isPaused && !subtaskTimerActive;
                                                const subtaskHideActions = !!projectTimer;
                                                const subtaskWithProject = { ...subtask, project: task.project };
                                                const subtaskCompleted = getTaskCompletedStatus(subtask);

                                                return (
                                                    <div key={subtask.id} className={`flex items-center gap-3 py-2 ${subtaskShouldDisable ? 'opacity-50' : ''}`}>
                                                        {!subtask.recurring && (
                                                            <CustomCheckbox
                                                                checked={subtaskCompleted}
                                                                onChange={(checked) => handleCompleteTask(subtask, checked)}
                                                                disabled={subtaskShouldDisable}
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                                                            {renderTaskTitle(subtaskWithProject, subtaskCompleted)}
                                                        </div>
                                                        {(subtask.startDate || subtask.recurring) && (
                                                            <StartDateBadge
                                                                startDate={subtask.startDate}
                                                                recurring={subtask.recurring}
                                                                completed={subtaskCompleted}
                                                            />
                                                        )}
                                                        <div className={`flex-shrink-0 text-xs ${subtaskCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                                            {formatDurationWithSeconds(subtask.recentTime)}
                                                        </div>
                                                        <div className="flex flex-shrink-0 space-x-1">
                                                            {renderTaskControls(subtask, subtaskShouldDisable)}
                                                            {!subtaskHideActions && (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                        title="Add time entry"
                                                                        onClick={() => handleOpenTimeEntries(subtaskWithProject)}
                                                                    >
                                                                        <ClockIcon className="h-5 w-5" />
                                                                    </Button>
                                                                    <TaskActionsMenu
                                                                        task={subtaskWithProject}
                                                                        onEdit={onEditTask}
                                                                        onDelete={onDeleteTask}
                                                                        onArchive={onArchiveTask}
                                                                    />
                                                                </>
                                                            )}
                                                        </div>
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
                            {taskSearchQuery ? 'No tasks found matching your search' : 'No recent tasks found'}
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
