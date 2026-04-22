import { 
    getTodayRange, 
    getThisWeekRange, 
    getThisMonthRange, 
    getLastMonthRange,
    formatDuration,
    millisecondsToHours
} from '../utils/dateUtils.ts';
import { getCurrencySymbol, getPreferredCurrency } from '../utils/currencyUtils.ts';
import { ClockIcon, CurrencyDollarIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePreferences } from '@/hooks/usePreferences';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import { getBillableDurationMs } from '../utils/timeEntryDurationUtils.ts';

/**
 * MetricsDisplay component - Shows time and earnings metrics for different periods
 */
const MetricsDisplay = ({ project, timeEntries, clients = [], currency, showTitle = true, title = "Project Metrics" }) => {
    const { preferences } = usePreferences();
    const isMobileLayout = useIsMobileLayout();
    const weekStartsOn = typeof preferences.weekStartsOn === 'number' ? preferences.weekStartsOn : 1;
    
    // Helper function to get currency for display
    const getDisplayCurrency = () => {
        if (currency) return currency;
        
        if (project && project.preferredClientId && clients.length > 0) {
            const client = clients.find(c => c.id === project.preferredClientId);
            return client?.defaultCurrency || getPreferredCurrency();
        }
        
        return getPreferredCurrency();
    };

    const displayCurrency = getDisplayCurrency();
    /**
     * Calculate metrics for a given date range
     */
    const calculateMetrics = (startTime, endTime) => {
        const entriesInRange = timeEntries.filter(entry => 
            entry.start >= startTime && entry.end <= endTime
        );

        const totalTime = entriesInRange.reduce((total, entry) => {
            return total + (entry.end - entry.start);
        }, 0);

        // Use task-by-task rounding for consistency with invoice generation
        // Group entries by task first
        const taskTimeMap = {};
        entriesInRange.forEach(entry => {
            if (!taskTimeMap[entry.taskId]) {
                taskTimeMap[entry.taskId] = 0;
            }
            taskTimeMap[entry.taskId] += (entry.end - entry.start);
        });

        const taskRateTimeMap = {};
        entriesInRange.forEach(entry => {
            const rate = entry.billedHourlyRate ?? (project?.hourlyRate ?? 0);
            const key = `${entry.taskId}-${rate}`;

            if (!taskRateTimeMap[key]) {
                taskRateTimeMap[key] = {
                    totalTime: 0,
                    rate: rate
                };
            }

            taskRateTimeMap[key].totalTime += getBillableDurationMs(entry);
        });

        // Calculate total rounded hours (matching invoice calculation)
        const totalHours = Object.values(taskTimeMap).reduce((total, taskTime) => {
            const taskHours = millisecondsToHours(taskTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            return total + roundedTaskHours;
        }, 0);

        const totalEarnings = Object.values(taskRateTimeMap).reduce((total, entryGroup) => {
            const hours = millisecondsToHours(entryGroup.totalTime);
            const roundedHours = Math.round(hours * 100) / 100; // Round to 2 decimal places
            return total + (roundedHours * (entryGroup.rate || 0));
        }, 0);

        return {
            time: totalTime,
            hours: totalHours,
            earnings: totalEarnings
        };
    };

    // Calculate metrics for different periods
    const todayRange = getTodayRange();

    const todayMetrics = calculateMetrics(todayRange.start, todayRange.end);

    const weekRange = getThisWeekRange(weekStartsOn);

    const weekMetrics = calculateMetrics(weekRange.start, weekRange.end);

    const monthRange = getThisMonthRange();

    const monthMetrics = calculateMetrics(monthRange.start, monthRange.end);

    const lastMonthRange = getLastMonthRange();

    const lastMonthMetrics = calculateMetrics(lastMonthRange.start, lastMonthRange.end);

    // Calculate last 90 days range (matching dashboard reports)
    const getLast90DaysRange = () => {
        const now = new Date();
        const end = now.getTime();
        // Create new date for start calculation to avoid mutating the 'now' used for other things if any
        // (though in this function scope it's local)
        const start = new Date(now);
        start.setDate(start.getDate() - 90);
        start.setHours(0, 0, 0, 0);
        
        return { start: start.getTime(), end };
    };

    const last90DaysRange = getLast90DaysRange();

    const last90DaysMetrics = calculateMetrics(last90DaysRange.start, last90DaysRange.end);

    const metrics = [
        { 
            label: 'Today',
            ...todayMetrics 
        },
        { 
            label: 'This Week',
            ...weekMetrics 
        },
        { 
            label: 'This Month',
            ...monthMetrics 
        },
        { 
            label: 'Last Month',
            ...lastMonthMetrics 
        },
        { 
            label: 'Last 90 Days',
            ...last90DaysMetrics 
        }
    ];

    return (
        <Card>
            {showTitle && (
                <CardHeader className={cn('pb-0', isMobileLayout && 'px-3 py-3')}>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
            )}
            
            <CardContent className={cn(showTitle ? 'pt-6' : 'pt-6', isMobileLayout && (showTitle ? 'px-3 pb-3 pt-0' : 'p-3'))}>
                <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6', isMobileLayout && 'gap-4')}>
                    {metrics.map((metric) => {
                        return (
                            <Card key={metric.label}>
                                <CardContent className={cn(isMobileLayout ? 'p-3' : 'pt-5')}>
                                    <div className="flex flex-col">
                                        <dt className="text-sm font-medium text-muted-foreground truncate mb-3">
                                            {metric.label}
                                        </dt>
                                        
                                        <dd className="flex items-center">
                                            <ClockIcon className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
                                            <span className="text-lg font-medium">
                                                {formatDuration(metric.time)}
                                            </span>
                                        </dd>
                                        
                                        {project && project.hourlyRate && (
                                            <dd className="flex items-center mt-1">
                                                <CurrencyDollarIcon className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
                                                <span className="font-medium sensitive-data">
                                                    {`${getCurrencySymbol(displayCurrency)}${metric.earnings.toFixed(2)}`}
                                                </span>
                                            </dd>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default MetricsDisplay;
