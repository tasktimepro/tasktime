import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { toDisplayDate } from '@/utils/dateUtils.ts';

/**
 * ExpenseDueCard - Compact expense card with quick pay action
 */
const ExpenseDueCard = ({
    expense,
    onEdit,
    onMarkPaid,
    isOverdue = false,
    isToday = false,
}) => {
    const isVariable = expense.amountType === 'variable';
    const needsAmount = isVariable && (!expense.amount || expense.amount <= 0);
    const [amountValue, setAmountValue] = useState(needsAmount ? '' : String(expense.amount || ''));
    const [showError, setShowError] = useState(false);

    useEffect(() => {
        if (!needsAmount) {
            setAmountValue(String(expense.amount || ''));
        }
    }, [expense.amount, needsAmount]);

    const badgeText = useMemo(() => {
        if (isOverdue) return 'Overdue';
        if (isToday) return 'Today';
        return 'Upcoming';
    }, [isOverdue, isToday]);

    const badgeVariant = isOverdue ? 'destructive' : isToday ? 'warning' : 'secondary';

    const handleMarkPaid = (event) => {
        event.stopPropagation();
        setShowError(false);

        if (needsAmount) {
            const parsed = Number(amountValue);
            if (!parsed || parsed <= 0) {
                setShowError(true);
                return;
            }
            onMarkPaid?.(parsed);
            return;
        }

        onMarkPaid?.();
    };

    return (
        <div
            className={`rounded-lg border p-3 transition hover:bg-muted/40 ${isOverdue ? 'border-red-300' : 'border-border'}`}
            role="button"
            tabIndex={0}
            onClick={() => onEdit?.(expense)}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    onEdit?.(expense);
                }
            }}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-sm font-semibold text-foreground">
                        {expense.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {toDisplayDate(expense.date)}
                        {expense.supplierName ? ` • ${expense.supplierName}` : ''}
                    </div>
                </div>
                <Badge variant={badgeVariant}>{badgeText}</Badge>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {needsAmount ? (
                    <div className="flex-1 min-w-[140px]">
                        <Input
                            value={amountValue}
                            onChange={(event) => setAmountValue(event.target.value)}
                            placeholder="Enter amount"
                            type="number"
                            min="0"
                            step="0.01"
                            onClick={(event) => event.stopPropagation()}
                        />
                        {showError && (
                            <div className="mt-1 text-xs text-red-600">
                                Amount required
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm font-semibold text-foreground sensitive-data">
                        {formatCurrency(expense.amount || 0, expense.currency)} {expense.currency}
                    </div>
                )}

                <Button size="sm" onClick={handleMarkPaid} type="button">
                    {needsAmount ? 'Enter Amount & Pay' : 'Mark Paid'}
                </Button>
            </div>
        </div>
    );
};

export default ExpenseDueCard;
