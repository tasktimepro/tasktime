/**
 * ExpensesSection component - Collapsible expenses card for client/project dashboards
 */

import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon, PlusIcon } from '@/components/ui/icons';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { useExpenseRecurrences } from '@/hooks/useExpenseRecurrences.ts';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils.ts';
import { advanceByRepeat, buildExpenseFromRecurrence, getNextRecurringDate } from '@/utils/expenseUtils';
import ExpenseList from './ExpenseList';

const ExpensesSection = ({
    clientId,
    projectId,
    openExpenseModal,
    openExpenseView,
}) => {

    const { expenses } = useExpenses();
    const { recurrences } = useExpenseRecurrences();
    const [isExpanded, setIsExpanded] = useState(false);

    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense) => {
            if (clientId && expense.clientId !== clientId) return false;
            if (projectId && expense.projectId !== projectId) return false;
            return true;
        });
    }, [expenses, clientId, projectId]);

    const recentExpenses = useMemo(() => {
        return [...filteredExpenses]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 15);
    }, [filteredExpenses]);

    const upcomingRecurringPreviews = useMemo(() => {
        if (!recurrences.length) return [];

        const todayStr = toStorageDate(new Date()) || '';
        const todayDate = parseStoredDate(todayStr);
        if (!todayDate) return [];

        const upcomingStart = addDays(todayDate, 1);
        const upcomingEnd = addDays(todayDate, 7);
        const upcomingStartStr = toStorageDate(upcomingStart) || '';
        const upcomingEndStr = toStorageDate(upcomingEnd) || '';

        const recurrenceDates = new Map();
        filteredExpenses.forEach((expense) => {
            if (!expense.recurrenceId) return;
            if (!recurrenceDates.has(expense.recurrenceId)) {
                recurrenceDates.set(expense.recurrenceId, new Set());
            }
            recurrenceDates.get(expense.recurrenceId).add(expense.date);
        });

        const matchesScope = (recurrence) => {
            if (projectId && recurrence.projectId !== projectId) return false;
            if (clientId && recurrence.clientId !== clientId) return false;
            return true;
        };

        return recurrences
            .filter((recurrence) => recurrence.active && matchesScope(recurrence))
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
            .filter(Boolean)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [recurrences, filteredExpenses, clientId, projectId]);

    const displayedExpenses = useMemo(() => {
        const combined = [...recentExpenses, ...upcomingRecurringPreviews];
        return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [recentExpenses, upcomingRecurringPreviews]);

    const handleToggle = () => {
        setIsExpanded((prev) => !prev);
    };

    const handleAddExpense = () => {
        openExpenseModal(null, { clientId, projectId });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleToggle}
                        aria-expanded={isExpanded}
                        className="flex items-center gap-2 rounded-md text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <CardTitle className="text-lg">
                            Expenses ({displayedExpenses.length})
                        </CardTitle>
                        <ChevronDownIcon
                            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                    </button>
                    <Button variant="outline" leadingIcon={PlusIcon} onClick={handleAddExpense}>
                        New Expense
                    </Button>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-4">
                    <ExpenseList
                        expenses={displayedExpenses}
                        clientsById={new Map()}
                        projectsById={new Map()}
                        compact
                        onView={(expense) => openExpenseView?.(expense)}
                        onEdit={(expense) => openExpenseModal(expense)}
                        onTogglePaid={() => {}}
                    />
                </CardContent>
            )}
        </Card>
    );
};

export default ExpensesSection;
