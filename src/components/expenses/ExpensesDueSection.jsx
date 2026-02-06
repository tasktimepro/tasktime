import { useMemo } from 'react';
import { addDays } from 'date-fns';
import { useToast } from '@/hooks/useToast.ts';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils.ts';
import ExpenseDueCard from './ExpenseDueCard';

/**
 * ExpensesDueSection - Overdue/today/upcoming expenses for dashboard
 */
const ExpensesDueSection = ({ openExpenseModal }) => {
    const { expenses, markAsPaid } = useExpenses();
    const { showError, showSuccess } = useToast();

    const { overdue, today, upcoming } = useMemo(() => {
        const todayStr = toStorageDate(new Date()) || '';
        const todayDate = parseStoredDate(todayStr);
        if (!todayDate) {
            return { overdue: [], today: [], upcoming: [] };
        }

        const upcomingEnd = addDays(todayDate, 7);

        const unpaid = expenses.filter((expense) => expense.paymentStatus === 'unpaid');

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

        const sortByDate = (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime();

        groups.overdue.sort(sortByDate);
        groups.today.sort(sortByDate);
        groups.upcoming.sort(sortByDate);

        return groups;
    }, [expenses]);

    const totalCount = overdue.length + today.length + upcoming.length;

    if (totalCount === 0) {
        return null;
    }

    const handleMarkPaid = (expense, amount) => {
        try {
            markAsPaid(expense.id, amount ? { amount } : undefined);
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
                            onEdit={() => openExpenseModal?.(expense)}
                            onMarkPaid={(amount) => handleMarkPaid(expense, amount)}
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
