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
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide sm:-mx-5 sm:px-5">
            {weekDays.map((day) => {
                const isSelected = day.dateStr === selectedDateStr;
                const isToday = isSameDay(day.date, today);
                
                return (
                    <Button
                        key={day.dateStr}
                        variant={isSelected ? "secondary" : "outline"}
                        size="sm"
                        className={cn(
                            'flex h-auto min-w-[4.5rem] flex-shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-2.5',
                            isToday && !isSelected && 'text-foreground',
                            isSelected && 'shadow-sm'
                        )}
                        onClick={() => onSelectDay(day.dateStr)}
                        aria-pressed={isSelected}
                    >
                        <span className="text-[11px] font-medium uppercase tracking-wide">
                            {format(day.date, 'EEE')}
                        </span>
                        <span className="text-base font-semibold sm:text-lg">
                            {format(day.date, 'd')}
                        </span>
                    </Button>
                );
            })}
        </div>
    );
};

export default MobileDaySelector;
