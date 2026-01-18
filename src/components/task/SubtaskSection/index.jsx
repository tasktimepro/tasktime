import SubtaskItem from './SubtaskItem';
import SubtaskCreateForm from './SubtaskCreateForm';
import { deleteTaskWithCleanup } from '../../../utils/taskUtils.ts';

/**
 * SubtaskSection component - Renders subtasks list and create form.
 * @param {Object} props
 */
const SubtaskSection = ({
    subtasks,
    task,
    tasks,
    setTasks,
    timeEntries,
    setTimeEntries,
    currentTimer,
    setCurrentTimer,
    isPaused,
    setIsPaused,
    pausedElapsedTime,
    setPausedElapsedTime,
    isGlobalTimer,
    onToggleBillable,
    allTasks,
    onCreateSubtask,
    showCreateSubtaskForm,
    setShowCreateSubtaskForm,
    newSubtaskTitle,
    setNewSubtaskTitle,
    handleCreateSubtask,
    cancelCreateSubtask,
    isArchived,
    anyTimerActive,
    isRelatedToActiveTimer,
    showSuccess
}) => {
    if (isArchived || (subtasks.length === 0 && !onCreateSubtask)) {
        return null;
    }

    return (
        <div className="border-t border-border bg-muted/40 rounded-b-lg">
            <div className="pl-8 pr-4 py-2 space-y-2">
                {subtasks.map((subtask) => (
                    <SubtaskItem
                        key={subtask.id}
                        task={subtask}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        setTimeEntries={setTimeEntries}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        isPaused={isPaused}
                        setIsPaused={setIsPaused}
                        pausedElapsedTime={pausedElapsedTime}
                        setPausedElapsedTime={setPausedElapsedTime}
                        isGlobalTimer={isGlobalTimer}
                        onToggleBillable={onToggleBillable}
                        allTasks={allTasks}
                        onDelete={() => {
                            if (window.confirm('Are you sure you want to delete this subtask?')) {
                                const result = deleteTaskWithCleanup(
                                    subtask.id,
                                    tasks,
                                    timeEntries,
                                    currentTimer,
                                    setTasks,
                                    setTimeEntries,
                                    setCurrentTimer
                                );

                                showSuccess(`Subtask "${result.taskTitle}" deleted successfully`);
                            }
                        }}
                    />
                ))}

                {!task.completed && onCreateSubtask && (
                    showCreateSubtaskForm ? (
                        <SubtaskCreateForm
                            newSubtaskTitle={newSubtaskTitle}
                            setNewSubtaskTitle={setNewSubtaskTitle}
                            onCreateSubtask={handleCreateSubtask}
                            onCancel={cancelCreateSubtask}
                        />
                    ) : (
                        <div className={`${
                            (anyTimerActive && !isPaused && isRelatedToActiveTimer)
                                ? 'opacity-50 pointer-events-none'
                                : ''
                        }`}>
                            <button
                                onClick={() => setShowCreateSubtaskForm(true)}
                                className="w-full text-left py-2 px-3 text-sm text-muted-foreground cursor-pointer rounded-md transition-colors border border-dashed border-border hover:bg-muted/40"
                            >
                                + Add subtask
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default SubtaskSection;
