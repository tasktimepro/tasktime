import SubtaskItem from './SubtaskItem';
import SubtaskCreateForm from './SubtaskCreateForm';
import { useTasks } from '../../../hooks/useTasks';
import { useTimeEntries } from '../../../hooks/useTimeEntries';
import { useTimers } from '../../../hooks/useTimers';
import { getTaskIdsToDelete } from '../../../utils/taskUtils.ts';

/**
 * SubtaskSection component - Renders subtasks list and create form.
 * Uses Yjs hooks directly for state management.
 * @param {Object} props
 */
const SubtaskSection = ({
    subtasks,
    task,
    onToggleBillable,
    onCreateSubtask,
    showCreateSubtaskForm,
    setShowCreateSubtaskForm,
    newSubtaskTitle,
    setNewSubtaskTitle,
    newSubtaskStartDate,
    setNewSubtaskStartDate,
    newSubtaskRecurring,
    setNewSubtaskRecurring,
    handleCreateSubtask,
    cancelCreateSubtask,
    isArchived,
    anyTimerActive,
    isRelatedToActiveTimer,
    showSuccess,
    onEditTask
}) => {
    // Yjs hooks for state
    const { tasks, deleteTask } = useTasks();
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { timers, clearTimer } = useTimers();
    
    if (isArchived || (subtasks.length === 0 && !onCreateSubtask)) {
        return null;
    }

    /**
     * Handle subtask deletion with cleanup
     */
    const handleDeleteSubtask = (subtaskId, subtaskTitle) => {
        if (window.confirm('Are you sure you want to delete this subtask?')) {
            // Delete time entries for this subtask
            const entriesToDelete = timeEntries.filter(e => e.taskId === subtaskId);
            entriesToDelete.forEach(e => deleteEntry(e.id));
            
            // Clear timer if active on this subtask
            const activeTimer = timers.find(timer => timer.taskId === subtaskId);
            if (activeTimer) {
                clearTimer(activeTimer.projectId);
            }
            
            // Delete the subtask
            deleteTask(subtaskId);
            
            showSuccess(`Subtask "${subtaskTitle}" deleted successfully`);
        }
    };

    return (
        <div className="border-t border-border bg-muted/40 rounded-b-lg">
            <div className="pl-8 pr-4 py-2 space-y-2">
                {subtasks.map((subtask) => (
                    <SubtaskItem
                        key={subtask.id}
                        task={subtask}
                        onToggleBillable={onToggleBillable}
                        onDelete={() => handleDeleteSubtask(subtask.id, subtask.title)}
                        onEditTask={onEditTask}
                    />
                ))}

                {!task.completed && onCreateSubtask && (
                    showCreateSubtaskForm ? (
                        <SubtaskCreateForm
                            newSubtaskTitle={newSubtaskTitle}
                            setNewSubtaskTitle={setNewSubtaskTitle}
                            newSubtaskStartDate={newSubtaskStartDate}
                            setNewSubtaskStartDate={setNewSubtaskStartDate}
                            newSubtaskRecurring={newSubtaskRecurring}
                            setNewSubtaskRecurring={setNewSubtaskRecurring}
                            onCreateSubtask={handleCreateSubtask}
                            onCancel={cancelCreateSubtask}
                        />
                    ) : (
                        <div className={`${
                            (anyTimerActive && isRelatedToActiveTimer)
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
