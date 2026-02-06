import { useMemo } from 'react';
import { addDays } from 'date-fns';
import { useToast } from '@/hooks/useToast.ts';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { useExpenseRecurrences } from '@/hooks/useExpenseRecurrences.ts';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils.ts';
import { advanceByRepeat, buildExpenseFromRecurrence, getNextRecurringDate } from '@/utils/expenseUtils';
import ExpenseDueCard from './ExpenseDueCard';

/**
 * ExpensesDueSection - Overdue/today/upcoming expenses for dashboard
 */
const ExpensesDueSection = ({ openExpenseView }) => {
    const { expenses, markAsPaid } = useExpenses();
    const { recurrences } = useExpenseRecurrences();
    const { showError, showSuccess } = useToast();

    const recurrencesById = useMemo(() => {
        const map = new Map();
        recurrences.forEach((recurrence) => {
            map.set(recurrence.id, recurrence);
        });
        return map;
    }, [recurrences]);

    const { overdue, today, upcoming } = useMemo(() => {
        const todayStr = toStorageDate(new Date()) || '';
        const todayDate = parseStoredDate(todayStr);
        if (!todayDate) {
            return { overdue: [], today: [], upcoming: [] };
        }

        const upcomingEnd = addDays(todayDate, 7);
        const upcomingStart = addDays(todayDate, 1);
        const upcomingStartStr = toStorageDate(upcomingStart) || '';
        const upcomingEndStr = toStorageDate(upcomingEnd) || '';

        const unpaid = expenses.filter((expense) => expense.paymentStatus === 'unpaid');
        const recurrenceDates = new Map();
        expenses.forEach((expense) => {
            if (!expense.recurrenceId) return;
            if (!recurrenceDates.has(expense.recurrenceId)) {
                recurrenceDates.set(expense.recurrenceId, new Set());
            }
            recurrenceDates.get(expense.recurrenceId).add(expense.date);
        });

        const groups = {
            overdue: [],
            today: [],
            upcoming: [],
        };

        unpaid.forEach((expense) => {
            const expenseDate = parseStoredDate(expense.date);
            if (!expenseDate) return;

            if (expenseDate < todayDate) {
                groups.overdue.push(expense);
                return;
            }

            if (expenseDate.toDateString() === todayDate.toDateString()) {
                groups.today.push(expense);
                return;
            }

            if (expenseDate > todayDate && expenseDate <= upcomingEnd) {
                groups.upcoming.push(expense);
            }
        });

        const recurringPreviews = recurrences
            .filter((recurrence) => recurrence.active)
            .map((recurrence) => {
                if (!upcomingStartStr || !upcomingEndStr) return null;

                const baseStart = recurrence.lastGeneratedDate
                    ? advanceByRepeat(
                        recurrence.lastGeneratedDate,
                        recurrence.repeat,
                        recurrence.monthlyType,
                        recurrence.monthlyDay
                    )
                    : recurrence.startDate;

                const nextDate = getNextRecurringDate({
                    startDate: baseStart,
                    repeat: recurrence.repeat,
                    monthlyType: recurrence.monthlyType,
                    monthlyDay: recurrence.monthlyDay,
                    endDate: recurrence.endDate,
                    fromDate: upcomingStartStr,
                });

                if (!nextDate) return null;
                const nextParsed = parseStoredDate(nextDate);
                if (!nextParsed || nextParsed > upcomingEnd) return null;

                const existingDates = recurrenceDates.get(recurrence.id);
                if (existingDates?.has(nextDate)) {
                    return null;
                }

                const preview = buildExpenseFromRecurrence(recurrence, nextDate);
                return {
                    ...preview,
                    id: `preview-${recurrence.id}-${nextDate}`,
                    amount: recurrence.amountType === 'variable'
                        ? (recurrence.amount || 0)
                        : recurrence.amount,
                    isPreview: true,
                };
            })
            .filter(Boolean);

        recurringPreviews.forEach((preview) => {
            groups.upcoming.push(preview);
        });

        const sortByDate = (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime();

        groups.overdue.sort(sortByDate);
        groups.today.sort(sortByDate);
        groups.upcoming.sort(sortByDate);

        return groups;
    }, [expenses, recurrences]);

    const totalCount = overdue.length + today.length + upcoming.length;

    if (totalCount === 0) {
        return null;
    }

    const handleMarkPaid = (expense) => {
        try {
            markAsPaid(expense.id);
            showSuccess('Expense marked as paid');
        } catch (error) {
            showError(error?.message || 'Unable to mark expense as paid');
        }
    };

    const renderGroup = (title, items, options = {}) => {
        if (items.length === 0) return null;
        const { isOverdue = false, isToday = false } = options;

        return (
            <div className="space-y-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                    {title} ({items.length})
                </div>
                <div className="space-y-2">
                    {items.map((expense) => (
                        <ExpenseDueCard
                            key={expense.id}
                            expense={expense}
                            isOverdue={isOverdue}
                            isToday={isToday}
                            isPreview={expense.isPreview}
                            recurrence={expense.recurrenceId ? recurrencesById.get(expense.recurrenceId) : null}
                                onView={expense.isPreview ? undefined : () => openExpenseView?.(expense)}
                            onMarkPaid={expense.isPreview ? undefined : () => handleMarkPaid(expense)}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="text-sm font-medium text-foreground">
                Expenses Due ({totalCount})
            </div>
            {renderGroup('Overdue', overdue, { isOverdue: true })}
            {renderGroup('Today', today, { isToday: true })}
            {renderGroup('Upcoming', upcoming)}
        </div>
    );
};

export default ExpensesDueSection;
