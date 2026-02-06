/**
 * ExpenseRow component - Single expense row
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckIcon, HandCoinsIcon, PencilIcon } from '@/components/ui/icons';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { parseStoredDate, toDisplayDate, toStorageDate } from '@/utils/dateUtils.ts';

const ExpenseRow = ({
    expense,
    client,
    project,
    compact = false,
    onView,
    onEdit,
    onTogglePaid,
}) => {
    const todayStr = toStorageDate(new Date()) || '';
    const todayStart = parseStoredDate(todayStr);
    const expenseDate = parseStoredDate(expense.date);
    const isPaid = expense.paymentStatus === 'paid';
    const isToday = !isPaid && Boolean(expense.date) && expense.date === todayStr;
    const isOverdue = !isPaid && expenseDate && todayStart && expenseDate < todayStart;
    const isUpcoming = !isPaid && expenseDate && todayStart && expenseDate > todayStart;
    const amountValue = expense.amount || 0;
    const amountLabel = formatCurrency(amountValue, expense.currency);
    const isVariable = expense.amountType === 'variable';
    let amountDisplay = `${amountLabel}`;

    if (isVariable) {
        if (expense.amount && expense.amount > 0) {
            const prefix = isUpcoming ? '~' : '';
            amountDisplay = `${prefix}${amountLabel}`;
        } else {
            amountDisplay = expense.isPreview
                ? 'Variable amount'
                : (isUpcoming ? '' : 'Enter amount');
        }
    }
    const borderColor = project?.color || client?.color || null;
    const clientName = client?.title || null;
    const projectName = project?.title || null;
    const isPreview = Boolean(expense.isPreview);
    const canView = Boolean(onView) && !isPreview;

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

        if (isOverdue) {
            return (
                <Badge variant="warning">
                    Overdue
                </Badge>
            );
        }

        if (isToday) {
            return (
                <Badge variant="secondary">
                    Today
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
            className={`transition-shadow hover:shadow-md border-l-4 border-l-border ${canView ? 'cursor-pointer' : ''}`}
            style={borderColor ? { borderLeftColor: borderColor } : undefined}
            role={canView ? 'button' : 'presentation'}
            tabIndex={canView ? 0 : -1}
            onClick={canView ? () => onView(expense) : undefined}
            onKeyDown={canView ? (event) => {
                if (event.key === 'Enter') {
                    onView(expense);
                }
            } : undefined}
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
                            {expense.billable && expense.billingStatus === 'unbilled' && !isUpcoming && (
                                <Badge variant="secondary">Unbilled</Badge>
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
                                {expense.billable && expense.billingStatus === 'billed' && (
                                    <div>
                                        <Badge variant="success">
                                            Billed
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end items-center space-x-2">
                        {!isPaid && !isPreview && (
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
                        {!isPreview && Boolean(onEdit) && (
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
                        )}
                    </div>
                </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ExpenseRow;
