/**
 * WeekHeader - Navigation header for the weekly planner
 * 
 * Shows the current month/year and navigation controls
 */

import { format, isSameMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/**
 * @param {Object} props
 * @param {Date} props.weekStart - Monday of the displayed week
 * @param {Date} props.weekEnd - Sunday of the displayed week
 * @param {number} props.weekNumber - Week number for the year
 * @param {() => void} props.onPrevious - Navigate to previous week
 * @param {() => void} props.onNext - Navigate to next week
 * @param {() => void} props.onToday - Jump to current week
 * @param {boolean} props.isCurrentWeek - Whether viewing the current week
 * @param {Object | null} props.weekSummary
 * @param {string} props.weekSummary.hoursText
 * @param {string} props.weekSummary.earningsText
 * @param {boolean} props.weekSummary.hasGoals
 * @param {React.ReactNode} props.weekAddControl
 */
const WeekHeader = ({
    weekStart,
    weekEnd,
    weekNumber,
    onPrevious,
    onNext,
    onToday,
    isCurrentWeek = false,
    isMobile = false,
    weekSummary = null,
    weekAddControl = null,
}) => {

    // Format the month display
    // If week spans two months, show both (e.g., "January - February")
    const formatMonthDisplay = () => {
        if (isSameMonth(weekStart, weekEnd)) {
            return format(weekStart, 'MMMM');
        }
        // Different months
        const startMonth = format(weekStart, 'MMMM');
        const endMonth = format(weekEnd, 'MMMM');
        return `${startMonth} - ${endMonth}`;
    };

    const summaryNode = weekSummary && (
        <div
            className={cn(
                'flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground',
                weekSummary.hasGoals && 'text-foreground'
            )}
        >
            <span>{weekSummary.hoursText}</span>
            <span>•</span>
            <span className="sensitive-data">{weekSummary.earningsText}</span>
        </div>
    );

    const controlsNode = (
        <div className="flex items-center gap-1">
            {weekAddControl}
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={onPrevious}
                aria-label="Previous week"
            >
                <ChevronLeftIcon className="h-4 w-4" />
            </Button>

            <Button
                variant="ghost"
                size="icon-sm"
                onClick={onNext}
                aria-label="Next week"
            >
                <ChevronRightIcon className="h-4 w-4" />
            </Button>
        </div>
    );

    if (isMobile) {
        const mobileSummaryNode = weekSummary && (
            <div
                className="flex min-w-0 flex-col items-end justify-center text-right"
                data-testid="week-header-mobile-summary"
            >
                <span className={cn('text-sm font-semibold text-foreground', weekSummary.hasGoals && 'text-foreground')}>
                    {weekSummary.hoursText}
                </span>
                <span className="text-sm text-muted-foreground sensitive-data">
                    {weekSummary.earningsText}
                </span>
            </div>
        );

        return (
            <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Week {weekNumber}
                        </p>
                        <h2 className="text-2xl font-semibold text-foreground">
                            {formatMonthDisplay()}
                        </h2>
                    </div>

                    {mobileSummaryNode}
                </div>

                <div className="flex items-center justify-between gap-3">
                    {!isCurrentWeek ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onToday}
                        >
                            Today
                        </Button>
                    ) : (
                        <div className="text-xs font-medium text-muted-foreground">Current week</div>
                    )}

                    {controlsNode}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                    Week {weekNumber}, {formatMonthDisplay()}
                </h2>
                {summaryNode}
            </div>

            <div className="flex items-center gap-2">
                {!isCurrentWeek && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToday}
                    >
                        Today
                    </Button>
                )}

                {controlsNode}
            </div>
        </div>
    );
};

export default WeekHeader;
