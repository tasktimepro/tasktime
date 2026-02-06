/**
 * DailyGoalProgress - Displays daily earnings and hours with optional goal progress bars
 */

import { cn } from '@/lib/utils';
import { ClockIcon } from '@/components/ui/icons';
import { formatCurrency } from '@/utils/currencyUtils';

/**
 * @param {Object} props
 * @param {number | null} props.targetHours
 * @param {number} props.actualHours
 * @param {number | null} props.targetEarnings
 * @param {number} props.actualEarnings
 * @param {string} props.currency
 * @param {() => void} props.onEditGoal
 */
const DailyGoalProgress = ({
    targetHours,
    actualHours,
    targetEarnings,
    actualEarnings,
    currency,
    onEditGoal,
}) => {
    const hasEarningsGoal = typeof targetEarnings === 'number' && targetEarnings > 0;
    const hasHoursGoal = typeof targetHours === 'number' && targetHours > 0;

    const shouldShowEarnings = hasEarningsGoal || actualEarnings > 0;
    const shouldShowHours = hasHoursGoal || actualHours > 0;

    const getPercent = (actual, target) => {
        if (!target || target <= 0) return 0;
        return Math.min(100, Math.round((actual / target) * 100));
    };

    const earningsPercent = getPercent(actualEarnings, targetEarnings);
    const hoursPercent = getPercent(actualHours, targetHours);

    const getCurrencyDecimals = (value) => {
        if (typeof value !== 'number') return 2;
        return Number.isInteger(value) ? 0 : 2;
    };

    const earningsDecimals = getCurrencyDecimals(actualEarnings);
    const targetEarningsDecimals = getCurrencyDecimals(targetEarnings);

    if (!shouldShowEarnings && !shouldShowHours) return null;

    return (
        <button
            type="button"
            onClick={onEditGoal}
            className={cn(
                "w-full text-left space-y-2 rounded-md border border-dashed border-border",
                "px-2 py-2 hover:bg-muted/40 transition-colors"
            )}
        >
            {shouldShowEarnings && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            <span className="sensitive-data">
                                {formatCurrency(actualEarnings, currency, earningsDecimals)}
                            </span>
                            {hasEarningsGoal && (
                                <>
                                    <span className="mx-1">/</span>
                                    <span className="sensitive-data">
                                        {formatCurrency(targetEarnings || 0, currency, targetEarningsDecimals)}
                                    </span>
                                </>
                            )}
                        </span>
                        {hasEarningsGoal && (
                            <span
                                className={cn(
                                    "font-medium"
                                )}
                            >
                                {earningsPercent}%
                            </span>
                        )}
                    </div>
                    {hasEarningsGoal && (
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-muted-foreground/50 transition-all"
                                style={{ width: `${earningsPercent}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            {shouldShowHours && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" aria-hidden="true" />
                            <span>
                                {actualHours.toFixed(1)}h
                                {hasHoursGoal && ` / ${targetHours}h`}
                            </span>
                        </span>
                        {hasHoursGoal && (
                            <span
                                className={cn(
                                    "font-medium"
                                )}
                            >
                                {hoursPercent}%
                            </span>
                        )}
                    </div>
                    {hasHoursGoal && (
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-muted-foreground/50 transition-all"
                                style={{ width: `${hoursPercent}%` }}
                            />
                        </div>
                    )}
                </div>
            )}
        </button>
    );
};

export default DailyGoalProgress;
