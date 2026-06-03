/**
 * DayColumn - A single day column in the weekly planner
 * 
 * Contains header and list of items for that day
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CheckIcon, DocumentTextIcon, PlusIcon, UserIcon, GoalIcon } from '@/components/ui/icons';
import { format } from 'date-fns';
import PlannerItem from './PlannerItem';
import AddItemPopover from './AddItemPopover';
import DailyGoalProgress from './DailyGoalProgress';
import {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
} from '@/components/ui/context-menu';

/**
 * @param {Object} props
 * @param {Date} props.date - The date for this column
 * @param {string} props.dateStr - ISO date string (YYYY-MM-DD)
 * @param {boolean} props.isLastColumn - Whether this is the last column in the week
 * @param {boolean} props.isToday - Whether this is today's column
 * @param {Array} props.items - Items to display in this column
 * @param {number} props.totalTimeMs - Total time worked on this day in milliseconds
 * @param {number} props.totalEarnings - Total earnings for this day (in default currency)
 * @param {Object | null} props.dailyGoal - Daily goal for this weekday
 * @param {string} props.currency - Default currency code
 * @param {(dateStr: string, type: string, mode: string) => void} props.onAddClick - Handler for attach button
 * @param {(dateStr: string) => void} props.onCreateTask - Handler for creating a new task
 * @param {(item: any) => void} props.onItemClick - Handler for item clicks
 * @param {(item: any, dateStr: string) => void} props.onEditItem - Handler for editing planner options
 * @param {(item: any) => void} props.onRemoveItem - Handler for removing item from planner
 * @param {(dateStr: string) => void} props.onSetDailyGoal - Handler for daily goals
 */
const DayColumn = ({
    date,
    dateStr,
    isLastColumn = false,
    isToday = false,
    items = [],
    totalTimeMs = 0,
    totalEarnings = 0,
    dailyGoal = null,
    currency,
    onAddClick,
    onCreateTask,
    onItemClick,
    onEditItem,
    onRemoveItem,
    onSetDailyGoal,
}) => {

    const dayName = format(date, 'EEE'); // Mon, Tue, etc.
    const dayNumber = format(date, 'd'); // 1, 2, ... 31

    const handleAddSelect = (type) => {
        onAddClick?.(dateStr, type);
    };

    const handleCreateTask = () => {
        onCreateTask?.(dateStr);
    };

    const handleSetDailyGoal = () => {
        onSetDailyGoal?.(dateStr);
    };

    const popoverAlign = isLastColumn ? 'end' : 'start';
    const columnBackgroundClass = isToday ? 'bg-muted/80 dark:bg-muted/10' : 'bg-card';
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

    // Calculate total estimated hours from items
    const totalEstimatedHours = items.reduce((sum, item) => {
        return sum + (item.estimatedHours || 0);
    }, 0);

    // Determine effective target hours (manual goal takes precedence, otherwise sum of items)
    const effectiveTargetHours = (dailyGoal?.targetHours && dailyGoal.targetHours > 0) 
        ? dailyGoal.targetHours 
        : totalEstimatedHours;

    const shouldShowProgress = Boolean(effectiveTargetHours > 0)
        || Boolean(dailyGoal?.targetEarnings)
        || totalEarnings > 0
        || totalTimeMs > 0;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        "group flex flex-col h-full rounded-lg border relative",
                        "transition-shadow",
                        columnBackgroundClass,
                        isToday && "border-t-2 border-t-black dark:border-t-white"
                    )}
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
                                    ? "bg-muted text-foreground border border-border dark:border-transparent dark:bg-muted/40" 
                                    : "text-foreground"
                            )}>
                                {dayNumber}
                            </span>
                        </div>

                        <AddItemPopover
                            onSelectType={handleAddSelect}
                            onSetDailyGoal={handleSetDailyGoal}
                            onCreateTask={handleCreateTask}
                            align={popoverAlign}
                        >
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Attach item to ${format(date, 'EEEE')}`}
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
                                heightPercent={item.heightPercent}
                                isTimerActive={item.isTimerActive}
                                amount={item.amount}
                                amountType={item.amountType}
                                currency={item.currency}
                                supplierName={item.supplierName}
                                projectStatusMode={item.type === 'project' ? item.entity.statusMode : undefined}
                                projectDeadline={item.type === 'project' ? item.entity.deadline : undefined}
                                projectDeadlineResolvedAt={item.type === 'project' ? item.entity.deadlineResolvedAt : undefined}
                                isProjectDeadlineItem={item.type === 'project' ? item.isDeadlineItem : false}
                                isPreview={item.isPreview}
                                hasAttachment={!!item.attachment}
                                onClick={!item.isPreview || item.type === 'expense'
                                    ? () => onItemClick?.(item)
                                    : undefined}
                                onEdit={() => onEditItem?.(item, dateStr)}
                                onRemove={() => onRemoveItem?.(item)}
                            />
                        ))}
                    </div>

                    {/* Footer - Daily goals progress */}
                    {shouldShowProgress && (
                        <div
                            className={cn(
                                "px-2 pb-2 transition-opacity absolute bottom-0 left-0 w-full z-10 rounded-b-lg",
                                isToday ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                !isToday && "pointer-events-none group-hover:pointer-events-auto"
                            )}
                        >
                            <DailyGoalProgress
                                targetHours={effectiveTargetHours || null}
                                actualHours={totalTimeMs / 3600000}
                                targetEarnings={dailyGoal?.targetEarnings ?? null}
                                actualEarnings={totalEarnings}
                                currency={currency}
                                onEditGoal={handleSetDailyGoal}
                            />
                        </div>
                    )}

                    {/* Footer - Daily total time */}
                    {!shouldShowProgress && formattedTime && (
                        <div
                            className={cn(
                                "px-2 py-1.5 absolute bottom-0 left-0 w-full z-10 rounded-b-lg"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex items-center justify-center gap-1.5 rounded-md border border-border",
                                    "px-2 py-2 text-xs text-muted-foreground backdrop-blur-sm transition-colors",
                                    "hover:bg-card/95"
                                )}
                            >
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
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuItem onSelect={handleCreateTask}>
                    <PlusIcon className="h-4 w-4" />
                    New task
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => handleAddSelect('task')}>
                    <CheckIcon className="h-4 w-4" />
                    Attach task
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => handleAddSelect('project')}>
                    <DocumentTextIcon className="h-4 w-4" />
                    Attach project
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => handleAddSelect('client')}>
                    <UserIcon className="h-4 w-4" />
                    Attach client
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={handleSetDailyGoal}>
                    <GoalIcon className="h-4 w-4" />
                    Daily goals
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

export default DayColumn;
