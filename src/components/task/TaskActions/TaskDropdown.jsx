import { PencilIcon, TrashIcon } from '@/components/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * TaskDropdown component - Edit/Delete dropdown menu.
 * @param {Object} props
 */
const TaskDropdown = ({ onEdit, onDelete }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="More actions"
                >
                    <MoreHorizontal className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={onEdit}
                    className="flex items-center space-x-2 hover:bg-accent hover:text-yellow-600 dark:hover:text-yellow-400"
                >
                    <PencilIcon className="h-4 w-4" />
                    <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={onDelete}
                    className="flex items-center space-x-2 hover:bg-accent hover:text-red-600 dark:hover:text-red-400"
                >
                    <TrashIcon className="h-4 w-4" />
                    <span>Delete</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default TaskDropdown;
