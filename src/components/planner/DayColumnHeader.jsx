/**
 * DayColumnHeader - Header for each day column in the planner
 * 
 * Shows day name, date number, and add button
 */

import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * @param {Object} props
 * @param {Date} props.date - The date for this column
 * @param {boolean} props.isToday - Whether this is today's column
 * @param {() => void} props.onAddClick - Handler for add button click
 */
const DayColumnHeader = ({
    date,
    isToday = false,
    onAddClick,
}) => {

    const dayName = format(date, 'EEE'); // Mon, Tue, etc.
    const dayNumber = format(date, 'd'); // 1, 2, ... 31

    return (
        <div className="flex items-center justify-between px-2 py-2 border-b border-border">
            <div className="flex items-center gap-2">
                <span className={cn(
                    "text-xs font-medium uppercase",
                    isToday ? "text-foreground" : "text-muted-foreground"
                )}>
                    {dayName}
                </span>
                <span className={cn(
                    "flex items-center justify-center w-7 h-7 text-sm font-semibold rounded-full",
                    isToday 
                        ? "bg-muted text-foreground" 
                        : "text-foreground"
                )}>
                    {dayNumber}
                </span>
            </div>

            <Button
                variant="ghost"
                size="icon-xs"
                onClick={onAddClick}
                aria-label={`Add item to ${format(date, 'EEEE')}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <PlusIcon className="h-4 w-4" />
            </Button>
        </div>
    );
};

export default DayColumnHeader;
