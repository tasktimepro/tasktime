/**
 * ToDoToday component - Shows overdue, today, and upcoming tasks.
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, ListTodoIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CustomCheckbox from '../CustomCheckbox';
import StartDateBadge from '../task/StartDateBadge';
import TaskActionsMenu from '../task/TaskActionsMenu';
import TimeEntriesModal from '../TimeEntriesModal';
import { useTimers } from '../../hooks/useTimers';
import { formatDurationWithSeconds } from '../../utils/dateUtils.ts';

/**
 * @param {Object} props
 * @param {Array} props.overdueTasks
 * @param {Array} props.tasksForToday
 * @param {Array} props.upcomingTasks
 * @param {Function} props.handleCompleteTask
 * @param {Function} props.getTaskCompletedStatus
 * @param {Function} props.renderTaskTitle
 * @param {Function} props.renderTaskControls
 * @param {Function} props.handleTaskTitleClick
 * @param {Function} props.onEditTask
 * @param {Function} props.onDeleteTask
 */
const ToDoToday = ({
    overdueTasks,
    tasksForToday,
    upcomingTasks,
    handleCompleteTask,
    getTaskCompletedStatus,
    renderTaskTitle,
    renderTaskControls,
    handleTaskTitleClick,
    onEditTask,
    onDeleteTask
}) => {
    const { getTimerForTask } = useTimers();
    const [showUpcoming, setShowUpcoming] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);
    const combinedTasks = [...overdueTasks, ...tasksForToday];
    const allVisibleCount = combinedTasks.length;

    const handleOpenTimeEntries = (task) => {
        setSelectedTask(task);
        setShowTimeEntriesModal(true);
    };

    const closeTimeEntries = () => {
        setShowTimeEntriesModal(false);
        setSelectedTask(null);
    };

    const renderTaskRow = (task) => {
        const timer = getTimerForTask(task.id, task.projectId);
        const isTimerActive = !!timer && timer.taskId === task.id;
        const shouldDisable = !!timer && !timer.isPaused && !isTimerActive;
        const hideActions = !!timer;
        const isCompleted = getTaskCompletedStatus(task);

        return (
            <div key={task.id} className={`px-3 py-3 hover:bg-muted ${isCompleted ? 'bg-muted' : ''} ${shouldDisable ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                    <CustomCheckbox
                        checked={isCompleted}
                        onChange={(checked) => handleCompleteTask(task, checked)}
                        disabled={shouldDisable}
                    />
                    <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                        {renderTaskTitle(task, isCompleted)}
                        {(task.project || task.parentTaskId) && (
                            <p className="text-xs truncate text-muted-foreground">
                                {task.parentTaskId ? (
                                    <span>
                                        Subtask of: {task.parentTask ? task.parentTask.title : 'Unknown Parent'}
                                        {task.project && (
                                            <>
                                                <span className="mx-1">•</span>
                                                <button
                                                    onClick={() => handleTaskTitleClick(task)}
                                                    className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                                    title={`Click to open ${task.project.title} project`}
                                                >
                                                    {task.project.title}
                                                </button>
                                            </>
                                        )}
                                    </span>
                                ) : (
                                    task.project && (
                                        <button
                                            onClick={() => handleTaskTitleClick(task)}
                                            className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                            title={`Click to open ${task.project.title} project`}
                                        >
                                            {task.project.title}
                                        </button>
                                    )
                                )}
                            </p>
                        )}
                    </div>
                    <StartDateBadge
                        startDate={task.startDate}
                        recurring={task.recurring}
                        completed={isCompleted}
                    />
                    <div className={`flex-shrink-0 text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                        {formatDurationWithSeconds(task.recentTime || 0)}
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
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                    <ListTodoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                    To Do Today ({allVisibleCount})
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="divide-y divide-border">
                    {combinedTasks.length > 0 && (
                        <div className="py-2">
                            {combinedTasks.map(renderTaskRow)}
                        </div>
                    )}

                    {upcomingTasks.length > 0 && (
                        <div className="py-2">
                            <button
                                onClick={() => setShowUpcoming(!showUpcoming)}
                                className="flex items-center justify-between w-full text-left text-sm font-medium text-foreground hover:text-foreground transition-colors px-3 cursor-pointer"
                            >
                                <span>Upcoming ({upcomingTasks.length})</span>
                                {showUpcoming ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                            </button>

                            {showUpcoming && (
                                <div className="mt-2">
                                    {upcomingTasks.map(renderTaskRow)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
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

export default ToDoToday;
