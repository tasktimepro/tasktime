import { 
    getTodayRange, 
    getThisWeekRange, 
    getThisMonthRange, 
    getLastMonthRange, 
    getThisYearRange,
    formatDuration,
    millisecondsToHours
} from '../utils/dateUtils';
import { getCurrencySymbol, getPreferredCurrency } from '../utils/currencyUtils';
import { ClockIcon, CurrencyDollarIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * MetricsDisplay component - Shows time and earnings metrics for different periods
 */
const MetricsDisplay = ({ project, timeEntries, clients = [], currency, showTitle = true, title = "Project Metrics" }) => {
    
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

        // Calculate total rounded hours (matching invoice calculation)
        const totalHours = Object.values(taskTimeMap).reduce((total, taskTime) => {
            const taskHours = millisecondsToHours(taskTime);
            const roundedTaskHours = Math.round(taskHours * 100) / 100; // Round to 2 decimal places
            return total + roundedTaskHours;
        }, 0);

        const totalEarnings = (project && project.hourlyRate) ? totalHours * project.hourlyRate : 0;

        return {
            time: totalTime,
            hours: totalHours,
            earnings: totalEarnings
        };
    };

    // Calculate metrics for different periods
    const todayRange = getTodayRange();

    const todayMetrics = calculateMetrics(todayRange.start, todayRange.end);

    const weekRange = getThisWeekRange();

    const weekMetrics = calculateMetrics(weekRange.start, weekRange.end);

    const monthRange = getThisMonthRange();

    const monthMetrics = calculateMetrics(monthRange.start, monthRange.end);

    const lastMonthRange = getLastMonthRange();

    const lastMonthMetrics = calculateMetrics(lastMonthRange.start, lastMonthRange.end);

    const yearRange = getThisYearRange();

    const yearMetrics = calculateMetrics(yearRange.start, yearRange.end);

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
            label: 'This Year',
            ...yearMetrics 
        }
    ];

    return (
        <Card>
            {showTitle && (
                <CardHeader className="pb-0">
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
            )}
            
            <CardContent className={showTitle ? "pt-6" : "pt-6"}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    {metrics.map((metric) => {
                        return (
                            <Card key={metric.label}>
                                <CardContent className="pt-5">
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
                                                <span className="font-medium">
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
