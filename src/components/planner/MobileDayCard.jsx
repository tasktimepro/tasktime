/**
 * MobileDayCard - Full-screen day view for mobile planner
 * 
 * Shows a single day's items in a mobile-friendly layout.
 * Includes swipe gestures for day navigation.
 */

import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import PlannerItem from './PlannerItem';
import AddItemPopover from './AddItemPopover';
import { useTimeProgress, getProgressGradientStyle } from './hooks/useTimeProgress';
import { cn } from '@/lib/utils';
import DailyGoalProgress from './DailyGoalProgress';

/**
 * @param {Object} props
 * @param {Date} props.date
 * @param {string} props.dateStr
 * @param {boolean} props.isToday
 * @param {Array} props.items
 * @param {number} props.totalTimeMs - Total time worked on this day in milliseconds
 * @param {number} props.totalEarnings - Total earnings for this day in default currency
 * @param {Object | null} props.dailyGoal - Daily goal for this weekday
 * @param {string} props.currency - Default currency code
 * @param {boolean} props.hasPrev
 * @param {boolean} props.hasNext
 * @param {() => void} props.onPrev
 * @param {() => void} props.onNext
 * @param {(dateStr: string, type: string) => void} props.onAddClick
 * @param {(dateStr: string) => void} props.onCreateTask
 * @param {(item: any) => void} props.onItemClick
 * @param {(item: any, dateStr: string) => void} props.onEditItem - Handler for editing planner options
 * @param {(item: any) => void} props.onRemoveItem - Handler for removing item from planner
 * @param {(dateStr: string) => void} props.onSetDailyGoal - Handler for daily goals
 */
const MobileDayCard = ({
    date,
    dateStr,
    isToday = false,
    items = [],
    totalTimeMs = 0,
    totalEarnings = 0,
    dailyGoal = null,
    currency,
    hasPrev = true,
    hasNext = true,
    onPrev,
    onNext,
    onAddClick,
    onCreateTask,
    onItemClick,
    onEditItem,
    onRemoveItem,
    onSetDailyGoal,
}) => {

    // Time progress for today
    const progress = useTimeProgress();
    const progressStyle = isToday ? getProgressGradientStyle(progress) : {};

    const dayName = format(date, 'EEEE');
    const monthDay = format(date, 'MMMM d');

    const handleAddSelect = (type) => {
        onAddClick?.(dateStr, type);
    };

    const handleCreateTask = () => {
        onCreateTask?.(dateStr);
    };

    const handleSetDailyGoal = () => {
        onSetDailyGoal?.(dateStr);
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
    const shouldShowProgress = Boolean(dailyGoal?.targetHours)
        || Boolean(dailyGoal?.targetEarnings)
        || totalEarnings > 0
        || totalTimeMs > 0;

    return (
        <div 
            className={cn(
                "flex flex-col min-h-[50vh] rounded-lg border bg-card"
            )}
            style={progressStyle}
        >
            {/* Header with navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrev}
                    disabled={!hasPrev}
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </Button>

                <div className="text-center">
                    <div className={cn(
                        "text-sm font-medium",
                        isToday ? "text-foreground" : "text-muted-foreground"
                    )}>
                        {isToday ? 'Today' : dayName}
                    </div>
                    <div className="text-lg font-semibold">
                        {monthDay}
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNext}
                    disabled={!hasNext}
                >
                    <ChevronRightIcon className="h-5 w-5" />
                </Button>
            </div>

            {/* Items list */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                        <p className="text-sm">No items for this day</p>
                    </div>
                ) : (
                    items.map((item) => (
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
                            hasAttachment={!!item.attachment}
                            onClick={() => onItemClick?.(item)}
                            onEdit={() => onEditItem?.(item, dateStr)}
                            onRemove={() => onRemoveItem?.(item)}
                        />
                    ))
                )}
            </div>

            {/* Footer - Daily goals progress and add button */}
            <div className="p-4 border-t">
                {shouldShowProgress && (
                    <div className="mb-3">
                        <DailyGoalProgress
                            targetHours={dailyGoal?.targetHours ?? null}
                            actualHours={totalTimeMs / 3600000}
                            targetEarnings={dailyGoal?.targetEarnings ?? null}
                            actualEarnings={totalEarnings}
                            currency={currency}
                            onEditGoal={handleSetDailyGoal}
                        />
                    </div>
                )}
                {!shouldShowProgress && formattedTime && (
                    <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-3">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span className="font-medium">{formattedTime} worked</span>
                    </div>
                )}
                <AddItemPopover
                    onSelectType={handleAddSelect}
                    onSetDailyGoal={handleSetDailyGoal}
                    onCreateTask={handleCreateTask}
                >
                    <Button variant="outline" className="w-full">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Attach item
                    </Button>
                </AddItemPopover>
            </div>
        </div>
    );
};

export default MobileDayCard;
