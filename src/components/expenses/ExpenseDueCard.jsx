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
import { CategoryColorDot } from './CategoryLabel';

/**
 * ExpenseDueCard - Compact expense card with quick pay action
 */
const ExpenseDueCard = ({
    expense,
    category,
    onView,
    onMarkPaid,
    isOverdue = false,
    isPreview = false,
    recurrence = null,
    compact = false,
    upcoming = false,
}) => {
    const isMobileLayout = useIsMobileLayout();
    const isCompactMobile = isMobileLayout;
    const isVariable = expense.amountType === 'variable';
    const hasAmount = typeof expense.amount === 'number' && expense.amount > 0;
    const isPaid = expense.paymentStatus === 'paid';
    const isAutoPayment = expense.paymentMode === 'auto' && expense.amountType !== 'variable';
    const todayStr = toStorageDate(new Date()) || '';
    const todayStart = parseStoredDate(todayStr);
    const expenseDate = parseStoredDate(expense.date);
    const isUpcomingAuto = isAutoPayment && expenseDate && todayStart && expenseDate > todayStart;
    const isPaidDisplay = isPaid && !isUpcomingAuto;
    const showOverdue = isOverdue && !isPaidDisplay;
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

    const dateBadge = isPaidDisplay ? null : upcoming ? (
        <StartDateBadge
            startDate={expense.date}
            recurring={recurrence}
            upcomingRecurring={Boolean(expense.isRecurring || expense.recurrenceId)}
            completed={isPaidDisplay}
            recurringOverdue={showOverdue}
            upcoming
        />
    ) : recurrence ? (
        showOverdue ? (
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
            completed={isPaidDisplay}
            recurringOverdue={showOverdue}
        />
    );

    const dateBadgeNode = showOverdue && isClickable ? (
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

    const titleAndAmount = (
        <>
            <CategoryColorDot category={category} className="self-center" />
            <span className={`min-w-0 truncate leading-5 ${isPaidDisplay ? 'line-through text-muted-foreground' : ''}`} title={expense.title}>
                {expense.title}
            </span>
            {amountLabel && (
                <span className="sensitive-data shrink-0 whitespace-nowrap text-sm leading-5 text-muted-foreground">
                    {amountLabel}
                </span>
            )}
        </>
    );

    const secondaryRow = (!isCompactMobile || dateBadge || canMarkPaid) ? (
        <div className={isCompactMobile
            ? 'col-start-2 row-start-2 flex min-w-0 flex-wrap items-center justify-end gap-2 justify-self-end'
            : 'flex w-full flex-wrap items-center justify-end gap-2'} data-testid={`expense-row-secondary-${expense.id}`}>
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
    ) : null;

    return (
        <div
            className={`px-2 py-2 hover:bg-muted sm:px-3 sm:py-2.5 ${showOverdue ? 'opacity-90' : ''}`}
        >
            {isMobileLayout || compact ? (
                <div className={isCompactMobile
                    ? 'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1'
                    : 'flex items-start gap-3'}>
                    <HandCoinsIcon className={`h-5 w-5 shrink-0 text-muted-foreground ${isCompactMobile ? 'col-start-1 row-start-1 self-center' : ''}`} />
                    <div className={`min-w-0 overflow-hidden ${isCompactMobile ? 'col-start-2 row-start-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1' : 'flex-1 space-y-1.5'}`} data-testid={`expense-row-content-${expense.id}`}>
                        {isClickable ? (
                            <button
                                type="button"
                                onClick={() => onView?.(expense)}
                                className={`hover-status-info-text-strong flex w-full min-w-0 items-baseline gap-2 text-left text-sm font-medium leading-5 text-foreground transition-colors cursor-pointer ${isCompactMobile ? 'col-span-2 row-start-1' : ''}`}
                                title="Open expense details"
                            >
                                {titleAndAmount}
                            </button>
                        ) : (
                            <div className={`flex w-full min-w-0 items-baseline gap-2 text-left text-sm font-medium leading-5 text-foreground ${isCompactMobile ? 'col-span-2 row-start-1' : ''}`}>
                                {titleAndAmount}
                            </div>
                        )}
                        {metaLine && (
                            <p className={`text-xs text-muted-foreground whitespace-normal break-words ${isPaidDisplay ? 'line-through' : ''} ${isCompactMobile ? 'col-span-2 row-start-2' : ''}`}>
                                {metaLine}
                            </p>
                        )}
                        {!isCompactMobile && secondaryRow}
                    </div>
                    {isCompactMobile && secondaryRow}
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <HandCoinsIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                        {isClickable ? (
                            <button
                                type="button"
                                onClick={() => onView?.(expense)}
                                className="hover-status-info-text-strong flex w-full min-w-0 items-baseline gap-2 text-left text-sm font-medium leading-5 text-foreground transition-colors cursor-pointer"
                                title="Open expense details"
                            >
                                {titleAndAmount}
                            </button>
                        ) : (
                            <div className="flex w-full min-w-0 items-baseline gap-2 text-left text-sm font-medium leading-5 text-foreground">
                                {titleAndAmount}
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
