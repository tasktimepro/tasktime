/**
 * FloatingActionButton - Quick task creation button
 */

import { PlusIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * @param {Object} props
 * @param {Function} props.onTaskClick
 * @param {Function} props.onExpenseClick
 */
const FloatingActionButton = ({ onTaskClick, onExpenseClick }) => {

    if (!onExpenseClick) {
        return (
            <Button
                onClick={onTaskClick}
                className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg"
                variant="default"
                size="icon"
                title="Create new task"
                aria-label="Create new task"
            >
                <PlusIcon className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg"
                    variant="default"
                    size="icon"
                    title="Create new item"
                    aria-label="Create new item"
                >
                    <PlusIcon className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="min-w-[180px]">
                <DropdownMenuItem onClick={onTaskClick}>
                    New Task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExpenseClick}>
                    New Expense
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default FloatingActionButton;
