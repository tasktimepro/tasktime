import { useMemo } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowPathIcon, CheckIcon, HandCoinsIcon } from '@/components/ui/icons';
import StartDateBadge from '../task/StartDateBadge';
import useIsMobileLayout from '../../hooks/useIsMobileLayout';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils.ts';
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
    const isMobileLayout = useIsMobileLayout();
    const isVariable = expense.amountType === 'variable';
    const hasAmount = typeof expense.amount === 'number' && expense.amount > 0;
    const isPaid = expense.paymentStatus === 'paid';
    const isAutoPayment = expense.paymentMode === 'auto' && expense.amountType !== 'variable';
    const todayStr = toStorageDate(new Date()) || '';
    const todayStart = parseStoredDate(todayStr);
    const expenseDate = parseStoredDate(expense.date);
    const isUpcomingAuto = isAutoPayment && expenseDate && todayStart && expenseDate > todayStart;
    const isPaidDisplay = isPaid && !isUpcomingAuto;
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
            className={`px-2 py-2 hover:bg-muted sm:px-3 sm:py-2.5 ${isOverdue ? 'opacity-90' : ''}`}
        >
            {isMobileLayout ? (
                <div className="flex items-start gap-3">
                    <HandCoinsIcon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0 space-y-1.5 overflow-hidden" data-testid={`expense-row-content-${expense.id}`}>
                        {isClickable ? (
                            <button
                                type="button"
                                onClick={() => onView?.(expense)}
                                className="hover-status-info-text-strong block w-full text-left text-sm font-medium text-foreground transition-colors cursor-pointer"
                                title="Open expense details"
                            >
                                <span className={`whitespace-normal break-words ${isPaidDisplay ? 'line-through text-muted-foreground' : ''}`}>
                                    {expense.title}
                                </span>
                                {amountLabel && (
                                    <span className="ml-2 text-sm text-muted-foreground sensitive-data whitespace-nowrap">
                                        {amountLabel}
                                    </span>
                                )}
                            </button>
                        ) : (
                            <div className="text-left text-sm font-medium text-foreground">
                                <span className={`whitespace-normal break-words ${isPaidDisplay ? 'line-through text-muted-foreground' : ''}`}>
                                    {expense.title}
                                </span>
                                {amountLabel && (
                                    <span className="ml-2 text-sm text-muted-foreground sensitive-data whitespace-nowrap">
                                        {amountLabel}
                                    </span>
                                )}
                            </div>
                        )}
                        {metaLine && (
                            <p className={`text-xs text-muted-foreground whitespace-normal break-words ${isPaidDisplay ? 'line-through' : ''}`}>
                                {metaLine}
                            </p>
                        )}
                        <div className="flex w-full flex-wrap items-center justify-end gap-2" data-testid={`expense-row-secondary-${expense.id}`}>
                            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                                {dateBadgeNode}
                            </div>
                            {canMarkPaid && (
                                <div className="flex flex-wrap items-center justify-end gap-2" data-testid={`expense-row-actions-${expense.id}`}>
                                    <Button
                                        size="xs"
                                        className="h-7 px-3"
                                        aria-label="Mark as paid"
                                        title="Mark as paid"
                                        onClick={() => onMarkPaid?.()}
                                        leadingIcon={CheckIcon}
                                        type="button"
                                    >
                                        Mark Paid
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <HandCoinsIcon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                        {isClickable ? (
                            <button
                                type="button"
                                onClick={() => onView?.(expense)}
                                className="hover-status-info-text-strong block w-full text-left text-sm font-medium text-foreground transition-colors cursor-pointer truncate"
                                title="Open expense details"
                            >
                                <span className={isPaidDisplay ? 'line-through text-muted-foreground' : ''}>{expense.title}</span>
                                {amountLabel && (
                                    <span className="ml-2 text-sm text-muted-foreground sensitive-data">
                                        {amountLabel}
                                    </span>
                                )}
                            </button>
                        ) : (
                            <div className="text-sm font-medium text-foreground truncate">
                                <span className={isPaidDisplay ? 'line-through text-muted-foreground' : ''}>{expense.title}</span>
                                {amountLabel && (
                                    <span className="ml-2 text-sm text-muted-foreground sensitive-data">
                                        {amountLabel}
                                    </span>
                                )}
                            </div>
                        )}
                        {metaLine && (
                            <p className={`text-xs text-muted-foreground truncate ${isPaidDisplay ? 'line-through' : ''}`}>
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
            )}
        </div>
    );
};

export default ExpenseDueCard;
