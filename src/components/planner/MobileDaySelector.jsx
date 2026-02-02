/**
 * MobileDaySelector - Day tabs for mobile planner view
 * 
 * Shows horizontal scrollable day tabs for mobile screens.
 * Highlights today and allows selecting a day to view.
 */

import { format, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTodayDate } from '@/hooks/useDayRollover';

/**
 * @param {Object} props
 * @param {Array<{date: Date, dateStr: string, isToday: boolean}>} props.weekDays
 * @param {string} props.selectedDateStr - Currently selected day
 * @param {(dateStr: string) => void} props.onSelectDay
 */
const MobileDaySelector = ({
    weekDays,
    selectedDateStr,
    onSelectDay,
}) => {

    const today = useTodayDate();

    return (
        <div className="flex overflow-x-auto gap-1 pb-2 -mx-4 px-4 scrollbar-hide">
            {weekDays.map((day) => {
                const isSelected = day.dateStr === selectedDateStr;
                const isToday = isSameDay(day.date, today);
                
                return (
                    <Button
                        key={day.dateStr}
                        variant={isSelected ? "secondary" : "outline"}
                        size="sm"
                        className={cn(
                            "flex-shrink-0 flex flex-col items-center px-3 py-2 h-auto",
                            isToday && !isSelected && "text-foreground",
                        )}
                        onClick={() => onSelectDay(day.dateStr)}
                    >
                        <span className="text-xs uppercase">
                            {format(day.date, 'EEE')}
                        </span>
                        <span className="text-lg font-semibold">
                            {format(day.date, 'd')}
                        </span>
                    </Button>
                );
            })}
        </div>
    );
};

export default MobileDaySelector;
