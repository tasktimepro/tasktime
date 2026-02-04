/**
 * WeekAddPopover - Dropdown menu for attaching items to the current week
 */

import { useState, isValidElement, cloneElement } from 'react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserIcon, DocumentTextIcon, CheckIcon, GoalIcon } from '@/components/ui/icons';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Trigger element
 * @param {Function} props.onSelectType - Called with (type) when user selects an item type
 * @param {Function} props.onSetWeeklyGoal - Called when user selects Weekly goals
 */
const WeekAddPopover = ({ children, onSelectType, onSetWeeklyGoal }) => {

    const [open, setOpen] = useState(false);

    const handleSelect = (type) => {
        setOpen(false);
        onSelectType(type);
    };

    const trigger = isValidElement(children)
        ? cloneElement(children, {
            className: cn(children.props.className, open && 'opacity-100 ring-1 ring-primary/40'),
            'data-open': open ? 'true' : 'false',
        })
        : children;

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                {trigger}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => handleSelect('task')}>
                    <CheckIcon className="h-4 w-4 text-muted-foreground" />
                    Attach task
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => handleSelect('project')}>
                    <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                    Attach project
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => handleSelect('client')}>
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    Attach client
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                    setOpen(false);
                    onSetWeeklyGoal?.();
                }}>
                    <GoalIcon className="h-4 w-4 text-muted-foreground" />
                    Weekly goals
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default WeekAddPopover;
