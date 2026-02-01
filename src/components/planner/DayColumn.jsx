/**
 * DayColumn - A single day column in the weekly planner
 * 
 * Contains header and list of items for that day
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@/components/ui/icons';
import { format } from 'date-fns';
import PlannerItem from './PlannerItem';
import AddItemPopover from './AddItemPopover';
import { useTimeProgress, getProgressGradientStyle } from './hooks/useTimeProgress';

/**
 * @param {Object} props
 * @param {Date} props.date - The date for this column
 * @param {string} props.dateStr - ISO date string (YYYY-MM-DD)
 * @param {boolean} props.isToday - Whether this is today's column
 * @param {Array} props.items - Items to display in this column
 * @param {number} props.totalTimeMs - Total time worked on this day in milliseconds
 * @param {(dateStr: string, type: string, mode: string) => void} props.onAddClick - Handler for add button
 * @param {(item: any) => void} props.onItemClick - Handler for item clicks
 * @param {(item: any) => void} props.onRemoveItem - Handler for removing item from planner
 * @param {(item: any) => void} props.onSetEstimatedHours - Handler for setting estimated hours
 */
const DayColumn = ({
    date,
    dateStr,
    isToday = false,
    items = [],
    totalTimeMs = 0,
    onAddClick,
    onItemClick,
    onRemoveItem,
    onSetEstimatedHours,
}) => {

    // Time progress for today's column
    const progress = useTimeProgress();
    const progressStyle = isToday ? getProgressGradientStyle(progress) : {};

    const dayName = format(date, 'EEE'); // Mon, Tue, etc.
    const dayNumber = format(date, 'd'); // 1, 2, ... 31

    const handleAddSelect = (type) => {
        onAddClick?.(dateStr, type);
    };

    // Format total time as Xh Ym
    const formatTotalTime = (ms) => {
        if (!ms || ms <= 0) return null;
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 0 && minutes > 0) {
            return `${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            return `${minutes}m`;
        }
    };

    const formattedTime = formatTotalTime(totalTimeMs);

    return (
        <div
            className={cn(
                "group flex flex-col h-full rounded-lg border bg-card",
                "transition-shadow"
            )}
            style={progressStyle}
        >
            {/* Header */}
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

                <AddItemPopover onSelectType={handleAddSelect}>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Add item to ${format(date, 'EEEE')}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <PlusIcon className="h-4 w-4" />
                    </Button>
                </AddItemPopover>
            </div>

            {/* Items */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {items.map((item) => (
                    <PlannerItem
                        key={item.key}
                        type={item.type}
                        title={item.title}
                        isCompleted={item.isCompleted}
                        isStatic={item.attachment?.mode === 'static' || item.attachment?.mode === 'weekday'}
                        subtype={item.subtype}
                        color={item.color}
                        estimatedHours={item.estimatedHours}
                        actualTimeMs={item.actualTimeMs}
                        hasAttachment={!!item.attachment}
                        onClick={() => onItemClick?.(item)}
                        onRemove={() => onRemoveItem?.(item)}
                        onSetEstimatedHours={() => onSetEstimatedHours?.(item)}
                    />
                ))}
            </div>

            {/* Footer - Daily total time */}
            {formattedTime && (
                <div className="px-2 py-1.5 border-t border-border">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-3.5 h-3.5"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span className="font-medium">{formattedTime}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DayColumn;
