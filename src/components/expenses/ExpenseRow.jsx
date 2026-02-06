/**
 * ExpenseRow component - Single expense row
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckIcon, HandCoinsIcon, PencilIcon } from '@/components/ui/icons';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { toDisplayDate } from '@/utils/dateUtils.ts';

const ExpenseRow = ({
    expense,
    client,
    project,
    compact = false,
    onEdit,
    onTogglePaid,
}) => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expenseDate = expense.date ? new Date(expense.date) : null;
    const isPaid = expense.paymentStatus === 'paid';
    const isUpcoming = !isPaid && expenseDate && expenseDate > todayStart;
    const amountValue = expense.amount || 0;
    const amountLabel = formatCurrency(amountValue, expense.currency);
    const amountDisplay = expense.amountType === 'variable' && (!expense.amount || expense.amount <= 0)
        ? (isUpcoming ? '' : 'Enter amount')
        : `${amountLabel} ${expense.currency}`;
    const borderColor = project?.color || client?.color || null;
    const clientName = client?.title || null;
    const projectName = project?.title || null;

    const statusBadge = (() => {
        if (isPaid) {
            return (
                <Badge variant="success">
                    <CheckIcon className="h-3 w-3 mr-1" />
                    Paid <span className="mx-1">•</span>
                    <span className="sensitive-data">{amountLabel}</span>
                </Badge>
            );
        }

        if (isUpcoming) {
            return (
                <Badge variant="secondary">
                    Upcoming
                </Badge>
            );
        }

        return (
            <Badge variant="warning">
                Unpaid
            </Badge>
        );
    })();

    return (
        <Card
            className="transition-shadow hover:shadow-md border-l-4 border-l-border"
            style={borderColor ? { borderLeftColor: borderColor } : undefined}
            role="button"
            tabIndex={0}
            onClick={() => onEdit(expense)}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    onEdit(expense);
                }
            }}
        >
            <CardContent className="p-4">
                <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <HandCoinsIcon className="h-6 w-6 text-muted-foreground" />
                        <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-foreground">
                                {expense.title}
                            </h3>
                            {expense.isRecurring && (
                                <Badge variant="secondary">Recurring</Badge>
                            )}
                        </div>
                    </div>
                    <div>
                        {statusBadge}
                    </div>
                </div>

                <div className="flex items-end justify-between ml-9">
                    <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                            {toDisplayDate(expense.date)}
                            {expense.supplierName ? (
                                <>
                                    <span className="mx-1">•</span>
                                    {expense.supplierName}
                                </>
                            ) : null}
                            {amountDisplay ? (
                                <>
                                    <span className="mx-1">•</span>
                                    <span className="sensitive-data">{amountDisplay}</span>
                                </>
                            ) : null}
                        </p>
                        {!compact && (
                            <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                {expense.isPersonal ? (
                                    <p>
                                        Type: <span className="font-medium text-muted-foreground">Personal expense</span>
                                    </p>
                                ) : (
                                    <p>
                                        Client: <span className="font-medium text-muted-foreground">
                                            {clientName || 'Client'}
                                        </span>
                                    </p>
                                )}
                                {projectName && (
                                    <p>
                                        Project: <span className="font-medium text-muted-foreground">
                                            {projectName}
                                        </span>
                                    </p>
                                )}
                                {expense.billable && (
                                    <div>
                                        <Badge variant={expense.billingStatus === 'billed' ? 'success' : 'secondary'}>
                                            {expense.billingStatus === 'billed' ? 'Billed' : 'Unbilled'}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end items-center space-x-2">
                        {!isPaid && (
                            <Button
                                size="sm"
                                leadingIcon={CheckIcon}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onTogglePaid(expense);
                                }}
                            >
                                Mark as Paid
                            </Button>
                        )}
                        <Button
                            onClick={(event) => {
                                event.stopPropagation();
                                onEdit(expense);
                            }}
                            variant="ghost"
                            size="icon"
                            title="Edit Expense"
                        >
                            <PencilIcon className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ExpenseRow;
