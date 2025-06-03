import { 
    getTodayRange, 
    getThisWeekRange, 
    getThisMonthRange, 
    getLastMonthRange, 
    getThisYearRange,
    formatDuration,
    millisecondsToHours
} from '../utils/dateUtils';

/**
 * MetricsDisplay component - Shows time and earnings metrics for different periods
 */
const MetricsDisplay = ({ project, tasks, timeEntries }) => {
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

        const totalHours = millisecondsToHours(totalTime);

        const totalEarnings = totalHours * project.hourlyRate;

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
            <h2 className="text-lg font-medium text-gray-900 mb-6">Project Metrics</h2>

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

                            <div className="text-sm text-gray-600">
                                ${metric.earnings.toFixed(2)}
                            </div>
                        </dd>
                    </div>
                ))}
            </div>

            {/* Summary Stats */}
            <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                        <dt className="text-sm font-medium text-gray-500">
                            Total Tasks
                        </dt>

                        <dd className="mt-1 text-2xl font-semibold text-gray-900">
                            {tasks.length}
                        </dd>
                    </div>

                    <div className="text-center">
                        <dt className="text-sm font-medium text-gray-500">
                            Total Time Entries
                        </dt>

                        <dd className="mt-1 text-2xl font-semibold text-gray-900">
                            {timeEntries.length}
                        </dd>
                    </div>

                    <div className="text-center">
                        <dt className="text-sm font-medium text-gray-500">
                            Hourly Rate
                        </dt>

                        <dd className="mt-1 text-2xl font-semibold text-gray-900">
                            ${project.hourlyRate}/{project.currency}
                        </dd>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MetricsDisplay;
