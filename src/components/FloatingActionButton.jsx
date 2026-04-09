/**
 * FloatingActionButton - Quick create dropup for task and expense creation.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { ClipboardDocumentCheckIcon, HandCoinsIcon, PlusIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils.ts';

/**
 * @param {Object} props
 * @param {Function} props.onTaskClick
 * @param {Function} props.onExpenseClick
 * @param {string} [props.className]
 */
const FloatingActionButton = ({ onTaskClick, onExpenseClick, className = '' }) => {

    const [isOpen, setIsOpen] = useState(false);

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    className={cn(
                        'fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg',
                        isOpen && 'bg-primary/90',
                        className
                    )}
                    variant="default"
                    size="icon"
                    title="Quick create"
                    aria-label="Open quick create menu"
                >
                    <PlusIcon className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={12}
                className="w-48 rounded-2xl p-2"
            >
                <DropdownMenuItem
                    onSelect={onTaskClick}
                    className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium"
                >
                    <ClipboardDocumentCheckIcon className="h-4 w-4" />
                    <span>New Task</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                    onSelect={onExpenseClick}
                    className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium"
                >
                    <HandCoinsIcon className="h-4 w-4" />
                    <span>New Expense</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

FloatingActionButton.propTypes = {
    className: PropTypes.string,
    onExpenseClick: PropTypes.func.isRequired,
    onTaskClick: PropTypes.func.isRequired,
};

export default FloatingActionButton;
