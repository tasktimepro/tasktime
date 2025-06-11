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

/**
 * MetricsDisplay component - Shows time and earnings metrics for different periods
 */
const MetricsDisplay = ({ project, timeEntries, clients = [], currency, showTitle = true }) => {
    
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
        { label: 'Today', ...todayMetrics },
        { label: 'This Week', ...weekMetrics },
        { label: 'This Month', ...monthMetrics },
        { label: 'Last Month', ...lastMonthMetrics },
        { label: 'This Year', ...yearMetrics }
    ];

    return (
        <div className="bg-white shadow rounded-lg p-6">
            {showTitle && <h2 className="text-lg font-medium text-gray-900 mb-6">Project Metrics</h2>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {metrics.map((metric) => (
                    <div key={metric.label} className="text-center">
                        <dt className="text-sm font-medium text-gray-500 truncate">
                            {metric.label}
                        </dt>

                        <dd className="mt-1">
                            <div className="text-lg font-semibold text-gray-900">
                                {formatDuration(metric.time)}
                            </div>

                            {project && project.hourlyRate && (
                                <div className="text-sm text-gray-600">
                                    {`${getCurrencySymbol(displayCurrency)}${metric.earnings.toFixed(2)}`}
                                </div>
                            )}
                        </dd>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MetricsDisplay;
