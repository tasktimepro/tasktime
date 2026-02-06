/**
 * ExpensesSection component - Collapsible expenses card for client/project dashboards
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon } from '@/components/ui/icons';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { usePreferences } from '@/hooks/usePreferences.ts';
import { useUrlState } from '@/hooks/useUrlState.ts';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import ExpenseList from './ExpenseList';

const ExpensesSection = ({
    clientId,
    projectId,
    openExpenseModal,
    openExpenseView,
}) => {

    const { expenses } = useExpenses();
    const { preferences } = usePreferences();
    const { navigateToExpenses } = useUrlState();
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

    const totalsByCurrency = useMemo(() => {
        return filteredExpenses.reduce((acc, expense) => {
            const currency = expense.currency || preferences.currency || 'EUR';
            acc[currency] = (acc[currency] || 0) + (expense.amount || 0);
            return acc;
        }, {});
    }, [filteredExpenses, preferences.currency]);

    const unbilledByCurrency = useMemo(() => {
        return filteredExpenses
            .filter((expense) => expense.billable && expense.billingStatus === 'unbilled')
            .reduce((acc, expense) => {
                const currency = expense.currency || preferences.currency || 'EUR';
                acc[currency] = (acc[currency] || 0) + (expense.amount || 0);
                return acc;
            }, {});
    }, [filteredExpenses, preferences.currency]);

    const formatAmounts = (amounts) => {
        const entries = Object.entries(amounts).filter(([, value]) => value > 0);
        if (entries.length === 0) return '—';
        if (entries.length === 1) {
            const [currency, value] = entries[0];
            return formatCurrency(value, currency);
        }
        return entries.map(([currency, value]) => `${formatCurrency(value, currency)} ${currency}`).join(' · ');
    };

    const handleToggle = () => {
        setIsExpanded((prev) => !prev);
    };

    const handleAddExpense = () => {
        openExpenseModal(null, { clientId, projectId });
    };

    const handleViewAll = () => {
        navigateToExpenses({
            expenseClientId: clientId || null,
            expenseProjectId: projectId || null
        });
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
                            Expenses ({filteredExpenses.length})
                        </CardTitle>
                        <ChevronDownIcon
                            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                    </button>
                    <div className="text-sm text-muted-foreground">
                        Unbilled: {formatAmounts(unbilledByCurrency)}
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                            Total: {formatAmounts(totalsByCurrency)}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleViewAll}>
                                View all expenses
                            </Button>
                            <Button size="sm" onClick={handleAddExpense}>
                                Add Expense
                            </Button>
                        </div>
                    </div>
                    <ExpenseList
                        expenses={recentExpenses}
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
