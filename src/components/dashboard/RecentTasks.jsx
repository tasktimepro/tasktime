import { DocumentCheckIcon, MagnifyingGlassIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import CustomCheckbox from '../CustomCheckbox';
import { formatDurationWithSeconds } from '../../utils/dateUtils.ts';
import { useTimer } from '../../hooks/useTimer';

/**
 * RecentTasks component - Recent task list with search and controls.
 * @param {Object} props
 */
const RecentTasks = ({
    recentTasks,
    taskSearchQuery,
    setTaskSearchQuery,
    handleCompleteTask,
    renderTaskTitle,
    handleTaskTitleClick,
    renderTaskControls
}) => {
    const { isActive: isTimerRunning, taskId: timerTaskId, isPaused } = useTimer();

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-lg">
                        <DocumentCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
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
                            // Determine if this task should be disabled
                            // If any timer is running (not paused) and it's not for this task, disable the task
                            const isTimerActive = timerTaskId === task.id;
                            const shouldDisable = isTimerRunning && !isPaused && !isTimerActive;

                            return (
                                <div key={task.id} className={`px-3 py-3 hover:bg-muted ${task.completed ? 'bg-muted' : ''} ${shouldDisable ? 'opacity-50' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <CustomCheckbox
                                            checked={task.completed}
                                            onChange={(checked) => handleCompleteTask(task, checked)}
                                            disabled={shouldDisable}
                                        />
                                        <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                                            {renderTaskTitle(task, task.completed)}
                                            <p className={`text-xs truncate ${task.completed ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                                {task.parentTaskId ? (
                                                    <span>
                                                        Subtask of: {task.parentTask ? task.parentTask.title : 'Unknown Parent'} <span className="mx-1">•</span> {task.project ? (
                                                            <button
                                                                onClick={() => handleTaskTitleClick(task)}
                                                                className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                                                title={`Click to open ${task.project.title} project`}
                                                            >
                                                                {task.project.title}
                                                            </button>
                                                        ) : 'Unknown Project'}
                                                    </span>
                                                ) : (
                                                    task.project ? (
                                                        <button
                                                            onClick={() => handleTaskTitleClick(task)}
                                                            className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                                            title={`Click to open ${task.project.title} project`}
                                                        >
                                                            {task.project.title}
                                                        </button>
                                                    ) : 'Unknown Project'
                                                )}
                                            </p>
                                        </div>
                                        <div className={`flex-shrink-0 text-xs ${task.completed ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                            {formatDurationWithSeconds(task.recentTime)}
                                        </div>
                                        <div className="flex flex-shrink-0 space-x-1">
                                            {renderTaskControls(task, shouldDisable)}
                                        </div>
                                    </div>
                                    {/* Render subtasks if present */}
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <div className="ml-8 mt-2">
                                            {task.subtasks.map(subtask => {
                                                const subtaskTimerActive = timerTaskId === subtask.id;
                                                const subtaskShouldDisable = isTimerRunning && !isPaused && !subtaskTimerActive;
                                                const subtaskWithProject = { ...subtask, project: task.project };

                                                return (
                                                    <div key={subtask.id} className={`flex items-center gap-3 py-2 ${subtaskShouldDisable ? 'opacity-50' : ''}`}>
                                                        <CustomCheckbox
                                                            checked={subtask.completed}
                                                            onChange={(checked) => handleCompleteTask(subtask, checked)}
                                                            disabled={subtaskShouldDisable}
                                                        />
                                                        <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                                                            {renderTaskTitle(subtaskWithProject, subtask.completed)}
                                                            <p className={`text-xs truncate ${subtask.completed ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                                                {task.project ? (
                                                                    <button
                                                                        onClick={() => handleTaskTitleClick(subtaskWithProject)}
                                                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:underline cursor-pointer"
                                                                        title={`Click to open ${task.project.title} project`}
                                                                    >
                                                                        {task.project.title}
                                                                    </button>
                                                                ) : 'Unknown Project'}
                                                            </p>
                                                        </div>
                                                        <div className={`flex-shrink-0 text-xs ${subtask.completed ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                                            {formatDurationWithSeconds(subtask.recentTime)}
                                                        </div>
                                                        <div className="flex flex-shrink-0 space-x-1">
                                                            {renderTaskControls(subtask, subtaskShouldDisable)}
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
                        <DocumentCheckIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm">
                            {taskSearchQuery ? 'No tasks found matching your search' : 'No recent tasks found'}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default RecentTasks;
