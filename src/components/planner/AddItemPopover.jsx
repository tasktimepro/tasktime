/**
 * AddItemPopover - Dropdown menu for adding items to a planner day
 * 
 * Shows options to add a client, project, or task to a specific day.
 * Schedule selection (this day only / every weekday) is handled in EntityPickerModal.
 */

import { useState, isValidElement, cloneElement } from 'react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { UserIcon, DocumentTextIcon, CheckIcon } from '@/components/ui/icons';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Trigger element
 * @param {Function} props.onSelectType - Called with (type) when user selects an item type
 */
const AddItemPopover = ({ children, onSelectType }) => {

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
            <DropdownMenuContent align="start" className="w-38">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Add to planner
                </DropdownMenuLabel>
                
                <DropdownMenuItem onClick={() => handleSelect('client')}>
                    <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                    Client
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => handleSelect('project')}>
                    <DocumentTextIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                    Project
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => handleSelect('task')}>
                    <CheckIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                    Task
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default AddItemPopover;
