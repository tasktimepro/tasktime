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

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                    Week {weekNumber}, {formatMonthDisplay()}
                </h2>
                {weekSummary && (
                    <div
                        className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded-md text-xs",
                            "bg-muted text-muted-foreground",
                            weekSummary.hasGoals && "text-foreground"
                        )}
                    >
                        <span>{weekSummary.hoursText}</span>
                        <span>•</span>
                        <span className="sensitive-data">{weekSummary.earningsText}</span>
                    </div>
                )}
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
            </div>
        </div>
    );
};

export default WeekHeader;
