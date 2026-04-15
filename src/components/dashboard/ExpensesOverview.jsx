import { Badge } from '@/components/ui/badge';
import { HandCoinsIcon, ListFilterIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useIsMobileLayout from '../../hooks/useIsMobileLayout';
import { formatCurrency } from '../../utils/currencyUtils.ts';
import { toDisplayDate } from '../../utils/dateUtils.ts';
import { DASHBOARD_EXPENSE_FILTER_OPTIONS } from './dashboardWidgetConstants';

const getAmountDisplay = (expense, preferredCurrency) => {
    if (expense.amountType === 'variable') {
        if (expense.amount && expense.amount > 0) {
            const prefix = expense.isPreview ? '~' : '';
            return `${prefix}${formatCurrency(expense.amount, expense.currency || preferredCurrency)}`;
        }

        return expense.isPreview ? 'Variable amount' : 'Enter amount';
    }

    return formatCurrency(expense.amount || 0, expense.currency || preferredCurrency);
};

const ExpensesOverview = ({
    expenses,
    expenseFilter,
    setExpenseFilter,
    preferredCurrency,
    onExpenseClick,
}) => {
    const isMobileLayout = useIsMobileLayout();
    const emptyStateMessage = {
        paid: 'No paid expenses in the last 30 days',
        upcoming: 'No upcoming expenses in the next 30 days',
        recurring: 'No recurring expenses in the 30-day window',
    }[expenseFilter] || 'No expenses found';

    return (
        <Card>
            <CardHeader className="px-3 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="mr-auto flex items-center text-lg">
                        <HandCoinsIcon className="status-info-text-strong mr-2 h-5 w-5" />
                        Expenses
                    </CardTitle>
                    <Select value={expenseFilter} onValueChange={setExpenseFilter}>
                        <SelectTrigger
                            className={isMobileLayout ? 'h-9 w-9' : 'w-[148px]'}
                            aria-label="Filter expenses"
                            leadingIcon={ListFilterIcon}
                            hideCaret={isMobileLayout}
                            iconOnly={isMobileLayout}
                        >
                            {isMobileLayout ? (
                                <span className="sr-only">
                                    <SelectValue placeholder="Filter expenses" />
                                </span>
                            ) : (
                                <SelectValue placeholder="Filter expenses" />
                            )}
                        </SelectTrigger>
                        <SelectContent>
                            {DASHBOARD_EXPENSE_FILTER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="px-3 pb-2.5 pt-0 sm:px-5 sm:pb-4 max-h-96 overflow-y-auto">
                {expenses.length > 0 ? (
                    <div className="divide-y divide-border">
                        {expenses.map((expense) => {
                            const subtitleParts = [
                                toDisplayDate(expense.date, { month: 'short', day: 'numeric', year: 'numeric' }),
                                expense.project?.title || expense.client?.title || (expense.isPersonal ? 'Personal' : null),
                                expense.supplierName,
                            ].filter(Boolean);

                            return (
                                <div key={expense.id} className="px-3 py-3 hover:bg-muted transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onExpenseClick?.(expense)}
                                                    className="truncate text-left text-sm font-medium text-foreground hover-status-info-text-strong cursor-pointer"
                                                    title={`Open ${expense.title}`}
                                                >
                                                    {expense.title}
                                                </button>
                                                {expense.isPreview ? <Badge variant="secondary">Preview</Badge> : null}
                                                {expense.recurrenceId ? <Badge variant="secondary">Recurring</Badge> : null}
                                            </div>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {subtitleParts.join(' • ')}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-sm font-medium text-foreground sensitive-data">
                                                {getAmountDisplay(expense, preferredCurrency)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {expense.paymentStatus === 'paid' && !expense.isPreview ? 'Paid' : 'Planned'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="px-6 py-8 text-center text-muted-foreground">
                        <HandCoinsIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm">{emptyStateMessage}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ExpensesOverview;