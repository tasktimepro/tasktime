/**
 * TaskActionsMenu - Three-dot menu for task edit/delete actions.
 */

import { useMemo, useState } from 'react';
import { ArchiveBoxIcon, MoreHorizontalIcon, PencilIcon, TrashIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Modal from '@/components/Modal';
import { useTasks } from '@/hooks/useTasks';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useProjects } from '@/hooks/useProjects';
import { getTaskDeletionBillingSummary, getTaskIdsToDelete } from '@/utils/taskUtils.ts';
import DeleteTaskWarnings from './DeleteTaskWarnings';

/**
 * @param {Object} props
 * @param {Object} props.task
 * @param {(task: Object) => void} props.onEdit
 * @param {(task: Object) => void} props.onDelete
 * @param {(task: Object) => void} props.onArchive
 */
const TaskActionsMenu = ({ task, onEdit, onDelete, onArchive = null }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const { tasks } = useTasks({ includeArchived: Boolean(task?.archived) });
    const { entries: timeEntries } = useTimeEntries();
    const { projects } = useProjects();
    const canArchive = Boolean(onArchive) && !task.projectId && !task.archived;

    const taskIdsToDelete = useMemo(() => {
        if (!task?.id) return [];
        return task.parentTaskId ? [task.id] : getTaskIdsToDelete(task.id, tasks);
    }, [task, tasks]);

    const deleteBillingSummary = useMemo(() => {
        return getTaskDeletionBillingSummary(taskIdsToDelete, tasks, timeEntries, projects);
    }, [taskIdsToDelete, tasks, timeEntries, projects]);

    const closeDeleteModal = () => {
        setShowDeleteConfirm(false);
    };

    const confirmDelete = () => {
        setShowDeleteConfirm(false);
        onDelete(task);
    };

    const closeArchiveModal = () => {
        setShowArchiveConfirm(false);
    };

    const confirmArchive = () => {
        setShowArchiveConfirm(false);
        if (onArchive) {
            onArchive(task);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                        title="More actions"
                        aria-label="More actions"
                    >
                        <MoreHorizontalIcon className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        onClick={() => onEdit(task)}
                        className="cursor-pointer hover:bg-accent focus:bg-accent"
                    >
                        <PencilIcon className="h-4 w-4 mr-2" />
                        <span>Edit</span>
                    </DropdownMenuItem>
                    {canArchive && (
                        <DropdownMenuItem
                            onClick={() => setShowArchiveConfirm(true)}
                            className="cursor-pointer hover:bg-accent focus:bg-accent"
                        >
                            <ArchiveBoxIcon className="h-4 w-4 mr-2" />
                            <span>Archive</span>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        onClick={() => setShowDeleteConfirm(true)}
                        className="status-danger-action cursor-pointer"
                    >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        <span>Delete</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Modal
                isOpen={showArchiveConfirm}
                onClose={closeArchiveModal}
                title="Archive task?"
                description="Archived tasks will no longer appear on the dashboard, but remain in past planner views."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeArchiveModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmArchive}
                        >
                            Archive
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={`Archive "${task.title}"?`}
                />
            </Modal>

            <Modal
                isOpen={showDeleteConfirm}
                onClose={closeDeleteModal}
                title="Delete task?"
                description="This will permanently remove the task and its time entries."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeleteModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <div className="space-y-3">
                    <Notice
                        title={`Deleting "${task.title}" cannot be undone.`}
                        variant="destructive"
                    />
                    <DeleteTaskWarnings
                        summary={deleteBillingSummary}
                        taskCount={taskIdsToDelete.length}
                    />
                </div>
            </Modal>
        </>
    );
};

export default TaskActionsMenu;
