import { useCallback, useMemo, useState } from 'react';
import SubtaskItem from './SubtaskItem';
import SubtaskCreateForm from './SubtaskCreateForm';
import Modal from '../../Modal';
import { Notice } from '@/components/ui/notice';
import { Button } from '@/components/ui/button';
import { useTasks } from '../../../hooks/useTasks';
import { useTimeEntries } from '../../../hooks/useTimeEntries';
import { useTimers } from '../../../hooks/useTimers';

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
    handleCreateSubtask,
    cancelCreateSubtask,
    isArchived,
    anyTimerActive,
    isRelatedToActiveTimer,
    showSuccess,
    onEditTask,
    onViewTask
}) => {
    // Yjs hooks for state
    const { tasks, deleteTask } = useTasks();
    const { entries: timeEntries, deleteEntry } = useTimeEntries();
    const { timers, clearTimer } = useTimers();
    const [pendingDeleteSubtaskId, setPendingDeleteSubtaskId] = useState(null);

    const sortedSubtasks = useMemo(() => {
        return [...subtasks].sort((a, b) => {
            const aCompleted = a.completed === true;
            const bCompleted = b.completed === true;

            if (aCompleted !== bCompleted) {
                return aCompleted ? 1 : -1;
            }

            const aLastActive = a.lastActive || a.createdAt || 0;
            const bLastActive = b.lastActive || b.createdAt || 0;

            return bLastActive - aLastActive;
        });
    }, [subtasks]);

    const pendingDeleteSubtask = useMemo(() => {

        if (!pendingDeleteSubtaskId) return null;

        return tasks.find((item) => item.id === pendingDeleteSubtaskId)
            || subtasks.find((item) => item.id === pendingDeleteSubtaskId)
            || null;
    }, [tasks, subtasks, pendingDeleteSubtaskId]);
    
    if (isArchived || (subtasks.length === 0 && !onCreateSubtask)) {
        return null;
    }

    /**
     * Handle subtask deletion with cleanup
     */
    const handleDeleteSubtask = useCallback((subtaskId) => {

        setPendingDeleteSubtaskId(subtaskId);
    }, []);

    const closeDeleteSubtaskModal = useCallback(() => {

        setPendingDeleteSubtaskId(null);
    }, []);

    const confirmDeleteSubtask = useCallback(() => {

        if (!pendingDeleteSubtaskId) return;

        const subtaskToDelete = pendingDeleteSubtask
            || subtasks.find((item) => item.id === pendingDeleteSubtaskId)
            || null;

        const subtaskTitle = subtaskToDelete?.title || 'Subtask';

        const entriesToDelete = timeEntries.filter((entry) => entry.taskId === pendingDeleteSubtaskId);
        entriesToDelete.forEach((entry) => deleteEntry(entry.id));

        const activeTimer = timers.find((timer) => timer.taskId === pendingDeleteSubtaskId);
        if (activeTimer) {
            clearTimer(activeTimer.projectId);
        }

        deleteTask(pendingDeleteSubtaskId);
        showSuccess(`Subtask "${subtaskTitle}" deleted successfully`);
        setPendingDeleteSubtaskId(null);
    }, [pendingDeleteSubtaskId, pendingDeleteSubtask, subtasks, timeEntries, timers, deleteEntry, clearTimer, deleteTask, showSuccess]);

    return (
        <div className="border-t border-border bg-muted/40 rounded-b-lg">
            <div className="pl-8 pr-2 py-2 space-y-2">
                {sortedSubtasks.map((subtask) => (
                    <SubtaskItem
                        key={subtask.id}
                        task={subtask}
                        onToggleBillable={onToggleBillable}
                        onDelete={() => handleDeleteSubtask(subtask.id)}
                        onEditTask={onEditTask}
                        onViewTask={onViewTask}
                    />
                ))}

                {!task.completed && onCreateSubtask && (
                    showCreateSubtaskForm ? (
                        <SubtaskCreateForm
                            newSubtaskTitle={newSubtaskTitle}
                            setNewSubtaskTitle={setNewSubtaskTitle}
                            newSubtaskStartDate={newSubtaskStartDate}
                            setNewSubtaskStartDate={setNewSubtaskStartDate}
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

            <Modal
                isOpen={Boolean(pendingDeleteSubtaskId)}
                onClose={closeDeleteSubtaskModal}
                title="Delete task?"
                description="This will permanently remove the task and any related time entries."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeleteSubtaskModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteSubtask}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={pendingDeleteSubtask
                        ? `Deleting "${pendingDeleteSubtask.title}" cannot be undone.`
                        : 'Deleting this task cannot be undone.'}
                    variant="destructive"
                />
            </Modal>
        </div>
    );
};

export default SubtaskSection;
