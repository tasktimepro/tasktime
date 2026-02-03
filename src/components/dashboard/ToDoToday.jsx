/**
 * ToDoToday component - Shows overdue, today, and upcoming tasks.
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, ListTodoIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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
 * @param {Function} props.handleProjectTitleClick
 * @param {Function} props.onEditTask
 * @param {Function} props.onDeleteTask
 * @param {Function} props.onArchiveTask
 */
const ToDoToday = ({
    overdueTasks,
    tasksForToday,
    upcomingTasks,
    handleCompleteTask,
    getTaskCompletedStatus,
    renderTaskTitle,
    renderTaskControls,
    handleProjectTitleClick,
    onEditTask,
    onDeleteTask,
    onArchiveTask
}) => {
    const { getTimerForTask } = useTimers();
    const [showUpcoming, setShowUpcoming] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);

    // Combine and deduplicate tasks (a task might be both overdue and planned for today)
    const combinedTasks = [...overdueTasks, ...tasksForToday].reduce((acc, current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    const sortedTasks = combinedTasks.sort((a, b) => {
        const aCompleted = getTaskCompletedStatus(a);
        const bCompleted = getTaskCompletedStatus(b);

        if (aCompleted === bCompleted) return 0;
        return aCompleted ? 1 : -1;
    });
    const incompleteCount = combinedTasks.filter((task) => !getTaskCompletedStatus(task)).length;

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
            <div key={task.id} className={`px-3 py-3 hover:bg-muted ${shouldDisable ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                    <CustomCheckbox
                        checked={isCompleted}
                        onChange={(checked) => handleCompleteTask(task, checked)}
                        disabled={shouldDisable}
                    />
                    <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                        {renderTaskTitle(task, isCompleted)}
                    </div>
                    <StartDateBadge
                        startDate={task.startDate}
                        recurring={task.recurring}
                        completed={isCompleted}
                        recurringOverdue={Boolean(task.recurringStatus?.isOverdue)}
                    />
                    {(task.recentTime || 0) > 0 && (
                        <div className={`flex-shrink-0 text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                            {formatDurationWithSeconds(task.recentTime || 0)}
                        </div>
                    )}
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
            </div>
        );
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                    <ListTodoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                    To Do Today ({incompleteCount})
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="divide-y divide-border">
                    {combinedTasks.length > 0 ? (
                        <div className="py-2">
                            {sortedTasks.map(renderTaskRow)}
                        </div>
                    ) : (
                        <EmptyState
                            icon={ListTodoIcon}
                            title="Nothing due today"
                            description="You're all caught up."
                            className="pt-0 pb-6"
                        />
                    )}

                    {upcomingTasks.length > 0 && (
                        <div className="py-2">
                            <button
                                onClick={() => setShowUpcoming(!showUpcoming)}
                                className="flex items-center w-full text-left text-sm font-medium text-foreground hover:text-foreground transition-colors pt-2 cursor-pointer"
                            >
                                {showUpcoming ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                <span>Upcoming ({upcomingTasks.length})</span>
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
