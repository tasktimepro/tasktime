/**
 * ExpenseRow component - Single expense row
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowPathIcon, PencilIcon } from '@/components/ui/icons';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { toDisplayDate } from '@/utils/dateUtils.ts';

const ExpenseRow = ({
    expense,
    clientName,
    projectName,
    compact = false,
    onEdit,
    onTogglePaid,
}) => {

    const amountDisplay = expense.amountType === 'variable' && (!expense.amount || expense.amount <= 0)
        ? 'Enter amount'
        : `${formatCurrency(expense.amount || 0, expense.currency)} ${expense.currency}`;

    return (
        <div
            className="flex flex-col gap-3 rounded-lg border border-border p-4 transition hover:bg-muted/40"
            role="button"
            tabIndex={0}
            onClick={() => onEdit(expense)}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    onEdit(expense);
                }
            }}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="text-sm font-semibold text-foreground">
                            {expense.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {toDisplayDate(expense.date)}
                            {expense.supplierName ? ` • ${expense.supplierName}` : ''}
                        </div>
                    </div>
                </div>
                <div className="text-sm font-semibold text-foreground">
                    {amountDisplay}
                </div>
            </div>

            {!compact && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                            {expense.isPersonal ? 'Personal' : clientName || 'Client'}
                            {projectName ? ` • ${projectName}` : ''}
                        </span>
                        {expense.isRecurring && (
                            <Badge variant="secondary">Recurring</Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={expense.paymentStatus === 'paid' ? 'success' : 'warning'}>
                            {expense.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                        </Badge>
                        {expense.billable && (
                            <Badge variant={expense.billingStatus === 'billed' ? 'success' : 'secondary'}>
                                {expense.billingStatus === 'billed' ? 'Billed' : 'Unbilled'}
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        onEdit(expense);
                    }}
                >
                    <PencilIcon className="mr-1 h-4 w-4" />
                    Edit
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        onTogglePaid(expense);
                    }}
                >
                    <ArrowPathIcon className="mr-1 h-4 w-4" />
                    {expense.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                </Button>
            </div>
        </div>
    );
};

export default ExpenseRow;
