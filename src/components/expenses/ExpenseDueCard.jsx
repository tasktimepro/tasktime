import { useMemo } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowPathIcon, CheckIcon, HandCoinsIcon } from '@/components/ui/icons';
import StartDateBadge from '../task/StartDateBadge';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { parseStoredDate } from '@/utils/dateUtils.ts';
import { getOrdinalSuffix } from '@/utils/recurringUtils.ts';

/**
 * ExpenseDueCard - Compact expense card with quick pay action
 */
const ExpenseDueCard = ({
    expense,
    onView,
    onMarkPaid,
    isOverdue = false,
    isToday = false,
    isPreview = false,
    recurrence = null,
}) => {
    const isVariable = expense.amountType === 'variable';
    const hasAmount = typeof expense.amount === 'number' && expense.amount > 0;
    const isPaid = expense.paymentStatus === 'paid';
    const isAutoPayment = expense.paymentMode === 'auto';
    const isClickable = Boolean(onView);
    const canMarkPaid = Boolean(onMarkPaid) && !isPreview && !isAutoPayment && (!isVariable || hasAmount);

    const amountLabel = useMemo(() => {
        if (!hasAmount) {
            return null;
        }

        const prefix = isVariable ? '~' : '';
        return `${prefix}${formatCurrency(expense.amount || 0, expense.currency)} ${expense.currency}`;
    }, [expense.amount, expense.currency, hasAmount, isVariable]);

    const metaLine = useMemo(() => {
        const supplier = expense.supplierName?.trim();
        const note = expense.note?.trim();
        if (supplier && note) {
            return `${supplier} • ${note}`;
        }
        return supplier || note || '';
    }, [expense.note, expense.supplierName]);

    const recurringLabel = useMemo(() => {
        if (!recurrence?.repeat) return '';

        if (recurrence.repeat === 'monthly') {
            if (recurrence.monthlyType === 'first') return 'Monthly (1st)';
            if (recurrence.monthlyType === 'last') return 'Monthly (last)';
            const day = recurrence.monthlyDay || 1;
            return `Monthly (${day}${getOrdinalSuffix(day)})`;
        }

        if (recurrence.repeat === 'yearly') {
            const parsed = parseStoredDate(recurrence.startDate);
            if (!parsed) return 'Yearly';
            return `Yearly (${format(parsed, 'MMM d')})`;
        }

        return '';
    }, [recurrence]);

    const dateBadge = recurrence ? (
        isOverdue ? (
            <Badge variant="warning">
                Overdue
            </Badge>
        ) : (
            <Badge variant="secondary" className="flex items-center">
                <ArrowPathIcon className="h-3 w-3 mr-1" />
                {recurringLabel || 'Recurring'}
            </Badge>
        )
    ) : (
        <StartDateBadge
            startDate={expense.date}
            recurring={null}
            completed={false}
            recurringOverdue={Boolean(isOverdue)}
        />
    );

    const dateBadgeNode = isOverdue && isClickable ? (
        <button
            type="button"
            onClick={() => onView?.(expense)}
            className="cursor-pointer"
            title="Open expense details"
            aria-label="Open expense details"
        >
            {dateBadge}
        </button>
    ) : (
        dateBadge
    );

    return (
        <div
            className={`px-3 py-3 hover:bg-muted ${isOverdue ? 'opacity-90' : ''}`}
        >
            <div className="flex items-center gap-3">
                <HandCoinsIcon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                    {isClickable ? (
                        <button
                            type="button"
                            onClick={() => onView?.(expense)}
                            className="block w-full text-sm font-medium truncate text-left transition-colors text-foreground hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                            title="Open expense details"
                        >
                            <span className={isPaid ? 'line-through text-muted-foreground' : ''}>{expense.title}</span>
                            {amountLabel && (
                                <span className="ml-2 text-sm text-muted-foreground sensitive-data">
                                    {amountLabel}
                                </span>
                            )}
                        </button>
                    ) : (
                        <div className="text-sm font-medium text-foreground truncate">
                            <span className={isPaid ? 'line-through text-muted-foreground' : ''}>{expense.title}</span>
                            {amountLabel && (
                                <span className="ml-2 text-sm text-muted-foreground sensitive-data">
                                    {amountLabel}
                                </span>
                            )}
                        </div>
                    )}
                    {metaLine && (
                        <p className={`text-xs text-muted-foreground truncate ${isPaid ? 'line-through' : ''}`}>
                            {metaLine}
                        </p>
                    )}
                </div>
                {dateBadgeNode}
                {canMarkPaid && (
                    <Button
                        size="xs"
                        className="h-6 px-3"
                        aria-label="Mark as paid"
                        title="Mark as paid"
                        onClick={() => onMarkPaid?.()}
                        leadingIcon={CheckIcon}
                        type="button"
                    >
                        Mark Paid
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ExpenseDueCard;
