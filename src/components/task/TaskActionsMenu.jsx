/**
 * TaskActionsMenu - Three-dot menu for task edit/delete actions.
 */

import { useState } from 'react';
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Modal from '@/components/Modal';

/**
 * @param {Object} props
 * @param {Object} props.task
 * @param {(task: Object) => void} props.onEdit
 * @param {(task: Object) => void} props.onDelete
 */
const TaskActionsMenu = ({ task, onEdit, onDelete }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const closeDeleteModal = () => {
        setShowDeleteConfirm(false);
    };

    const confirmDelete = () => {
        setShowDeleteConfirm(false);
        onDelete(task);
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
                    <DropdownMenuItem
                        onClick={() => setShowDeleteConfirm(true)}
                        className="cursor-pointer hover:bg-accent focus:bg-accent"
                    >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        <span>Delete</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

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
                <Notice
                    title={`Deleting "${task.title}" cannot be undone.`}
                    variant="destructive"
                />
            </Modal>
        </>
    );
};

export default TaskActionsMenu;
