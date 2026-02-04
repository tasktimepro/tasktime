/**
 * AddItemPopover - Dropdown menu for attaching items to a planner day
 * 
 * Shows options to attach a client, project, or task to a specific day.
 * Schedule selection (this day only / every weekday) is handled in EntityPickerModal.
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
import { Button } from '@/components/ui/button';
import { UserIcon, DocumentTextIcon, CheckIcon, GoalIcon, PlusIcon } from '@/components/ui/icons';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Trigger element
 * @param {Function} props.onSelectType - Called with (type) when user selects an item type
 * @param {Function} props.onSetDailyGoal - Called when user selects Daily goals
 * @param {Function} props.onCreateTask - Called when user selects New task
 */
const AddItemPopover = ({ children, onSelectType, onSetDailyGoal, onCreateTask }) => {

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
            <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={() => {
                    setOpen(false);
                    onCreateTask?.();
                }}>
                    <PlusIcon className="h-4 w-4 text-muted-foreground" />
                    New task
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
                    onSetDailyGoal?.();
                }}>
                    <GoalIcon className="h-4 w-4 text-muted-foreground" />
                    Daily goals
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default AddItemPopover;
