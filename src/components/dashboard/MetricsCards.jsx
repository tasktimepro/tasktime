import {
    BanknotesIcon,
    CalendarDaysIcon,
    ChartBarIcon,
    CheckIcon,
    ClockIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
    HandCoinsIcon
} from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '../../utils/currencyUtils.ts';

const EXPENSE_SETTLED_LABEL = 'spent';

/**
 * MetricsCards component - Reports overview and invoice metrics.
 * @param {Object} props
 */
const MetricsCards = ({
    thisMonthMetrics,
    lastMonthMetrics,
    last90DaysMetrics,
    invoiceMetrics,
    thisMonthBillableHours,
    thisMonthUnbilledDisplay,
    expenseThisMonthUpcomingTotal,
    expenseThisMonthUpcomingHasEstimate,
    expenseThisMonthPaidTotal,
    expenseLastMonthPaidTotal,
    expenseLast90DaysPaidTotal,
    hasClients,
    preferredCurrency,
    formatDuration,
    needsExchangeRates,
    exchangeRatesLoading,
    navigateToInvoices
}) => {
    const formatExpenseAmount = (amount, hasEstimate = false, className = '') => {
        const prefix = hasEstimate ? '~' : '';
        return <span className={`${className} sensitive-data`}>{prefix}{formatCurrency(amount || 0, preferredCurrency)}</span>;
    };

    const renderExpenseLine = ({
        amount,
        hasEstimate,
        label
    }) => {
        const hasAmount = (amount || 0) > 0;

        if (!hasAmount) {
            return null;
        }

        return (
            <div className="flex items-center">
                <HandCoinsIcon className="h-4 w-4 text-muted-foreground mr-1" />
                <div className="text-lg font-semibold text-foreground">
                    {formatExpenseAmount(amount, hasEstimate, 'text-foreground')}
                </div>
                <span className="text-xs font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">
                    {label}
                </span>
            </div>
        );
    };
    const renderEarningsByCurrency = (metrics, colorScheme = 'blue') => {
        if (!hasClients) {
            return null;
        }
        // Show loading indicator if we need exchange rates and they're still loading
        if (needsExchangeRates && exchangeRatesLoading) {
            return <span className="text-muted-foreground text-sm italic">Loading rates...</span>;
        }

        const billableTotal = Object.values(metrics.billableEarnings).reduce((sum, amount) => sum + amount, 0);
        const paidTotal = Object.values(metrics.paidInvoices).reduce((sum, amount) => sum + amount, 0);
        const outstandingTotal = Object.values(metrics.outstandingInvoices).reduce((sum, amount) => sum + amount, 0);

        // Hide empty earnings states so expense-only periods do not show a misleading zero row.
        if (billableTotal === 0 && paidTotal === 0 && outstandingTotal === 0) {
            return null;
        }

        const components = [];

        // Color mappings for different schemes
        const colorClasses = {
            blue: {
                icon: 'text-muted-foreground',
                text: 'text-foreground',
                bg: 'bg-muted',
                badge: 'text-muted-foreground'
            },
            gray: {
                icon: 'text-muted-foreground',
                text: 'text-foreground',
                bg: 'bg-muted',
                badge: 'text-muted-foreground'
            },
            green: {
                icon: 'text-muted-foreground',
                text: 'text-foreground',
                bg: 'bg-muted',
                badge: 'text-muted-foreground'
            }
        };

        const colors = colorClasses[colorScheme] || colorClasses.blue;

        const renderAmountLine = (amountsByCurrency, label, Icon, iconClassName, keyPrefix) => {
            const entries = Object.entries(amountsByCurrency).filter(([, amount]) => amount > 0);
            if (entries.length === 0) return [];

            const showPerCurrency = metrics.hadConversionError && entries.some(([currency]) => currency !== preferredCurrency);

            const renderLine = (key, amount, currency) => (
                <div key={key} className="flex items-center">
                    <Icon className={`h-4 w-4 ${iconClassName} mr-1`} />
                    <span className={`font-semibold ${colors.text} sensitive-data`}>
                        {formatCurrency(amount, currency)}
                    </span>
                    <span className={`text-xs font-medium ${colors.bg} ${colors.badge} px-1.5 py-0.5 rounded ml-1`}>
                        {label}
                    </span>
                </div>
            );

            if (showPerCurrency) {
                return entries.map(([currency, amount]) => renderLine(`${keyPrefix}-${currency}`, amount, currency));
            }

            const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
            return [
                renderLine(keyPrefix, total, preferredCurrency)
            ];
        };

        // Add received invoice totals (highest priority)
        if (paidTotal > 0) {
            const paidLines = renderAmountLine(metrics.paidInvoices, 'received', BanknotesIcon, colors.icon, 'paid');
            components.push(...paidLines);
        }

        // Add outstanding invoices as "pending"
        if (outstandingTotal > 0) {
            const pendingLines = renderAmountLine(metrics.outstandingInvoices, 'pending', DocumentTextIcon, 'text-muted-foreground', 'pending');
            components.push(...pendingLines);
        }

        // Add unbilled time as "unbilled"
        if (billableTotal > 0) {
            const unbilledLines = renderAmountLine(metrics.billableEarnings, 'unbilled', CurrencyDollarIcon, 'text-muted-foreground', 'unbilled');
            components.push(...unbilledLines);
        }

        return (
            <div className="space-y-1">
                {components}
            </div>
        );
    };

    const thisMonthEarnings = renderEarningsByCurrency(thisMonthMetrics, 'blue');
    const lastMonthEarnings = renderEarningsByCurrency(lastMonthMetrics, 'gray');
    const last90DaysEarnings = renderEarningsByCurrency(last90DaysMetrics, 'green');

    return (
        <Card>
            <CardHeader className="px-3 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-2.5">
                <CardTitle className="flex items-center text-lg">
                    <ChartBarIcon className="status-info-text-strong mr-2 h-5 w-5" />
                    Reports Overview
                </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2.5 pt-0 sm:px-5 sm:pb-4">
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6">
                    {/* This Month */}
                    <div className="rounded-lg bg-muted/40 p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="status-info-text text-sm font-medium">This Month</h3>
                                <div className="mt-2">
                                    {thisMonthEarnings && (
                                        <div className="flex items-center">
                                            <div className="status-info-text text-lg font-semibold">
                                                {thisMonthEarnings}
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-2 space-y-1">
                                        {renderExpenseLine({
                                            amount: expenseThisMonthUpcomingTotal,
                                            hasEstimate: expenseThisMonthUpcomingHasEstimate,
                                            label: 'upcoming'
                                        })}
                                        {renderExpenseLine({
                                            amount: expenseThisMonthPaidTotal,
                                            label: EXPENSE_SETTLED_LABEL
                                        })}
                                    </div>
                                    <div className="flex items-center mt-2">
                                        <ClockIcon className="status-info-text-strong mr-1 h-4 w-4" />
                                        <span className="status-info-text text-sm">
                                            {formatDuration(thisMonthMetrics.time)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <CalendarDaysIcon className="status-info-text-strong h-8 w-8" />
                        </div>
                    </div>

                    {/* Last Month */}
                    <div className="rounded-lg bg-muted/40 p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-foreground">Last Month</h3>
                                <div className="mt-2">
                                    {lastMonthEarnings && (
                                        <div className="flex items-center">
                                            <div className="text-lg font-semibold text-foreground">
                                                {lastMonthEarnings}
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-2">
                                        {renderExpenseLine({
                                            amount: expenseLastMonthPaidTotal,
                                            label: EXPENSE_SETTLED_LABEL
                                        })}
                                    </div>
                                    <div className="flex items-center mt-2">
                                        <ClockIcon className="h-4 w-4 text-muted-foreground mr-1" />
                                        <span className="text-sm text-foreground">
                                            {formatDuration(lastMonthMetrics.time)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <CalendarDaysIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </div>

                    {/* Last 90 Days */}
                    <div className="rounded-lg bg-muted/40 p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="status-success-text text-sm font-medium">Last 90 Days</h3>
                                <div className="mt-2">
                                    {last90DaysEarnings && (
                                        <div className="flex items-center">
                                            <div className="status-success-text text-lg font-semibold">
                                                {last90DaysEarnings}
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-2">
                                        {renderExpenseLine({
                                            amount: expenseLast90DaysPaidTotal,
                                            label: EXPENSE_SETTLED_LABEL
                                        })}
                                    </div>
                                    <div className="flex items-center mt-2">
                                        <ClockIcon className="status-success-text-strong mr-1 h-4 w-4" />
                                        <span className="status-success-text text-sm">
                                            {formatDuration(last90DaysMetrics.time)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <CalendarDaysIcon className="status-success-text-strong h-8 w-8" />
                        </div>
                    </div>
                </div>

                {/* Invoice Metrics */}
                {hasClients && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-5 sm:gap-4 md:grid-cols-3">
                    {/* Pending Bills This Month Notice */}
                    <div className="rounded-lg bg-muted/40 p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="status-info-text text-sm font-medium">Pending Bills This Month</h3>
                                <div className="mt-2">
                                    <div className="flex items-center">
                                        <div className="status-info-text text-lg font-semibold">
                                            <div className="flex items-center">
                                                <CurrencyDollarIcon className="h-4 w-4 text-muted-foreground mr-1" />
                                                <span className="font-semibold text-foreground sensitive-data">
                                                    {thisMonthUnbilledDisplay}
                                                </span>
                                                <span className="text-xs font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-1">
                                                    unbilled
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <ClockIcon className="status-info-text-strong mr-1 h-4 w-4" />
                                        <span className="status-info-text text-sm">
                                            {formatDuration(thisMonthBillableHours * 3600000)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <ClockIcon className="status-info-text-strong h-8 w-8" />
                        </div>
                    </div>

                    {/* Outstanding Invoices */}
                    {invoiceMetrics.outstanding > 0 ? (
                        <button
                            onClick={() => navigateToInvoices({ section: 'invoices', tab: 'outstanding' })}
                            className="rounded-lg border border-border bg-muted/40 p-3 text-left transition-colors hover:bg-accent cursor-pointer sm:p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="status-warning-text text-sm font-medium">Outstanding Invoices</h3>
                                    <div className="flex items-center mt-2">
                                        <DocumentTextIcon className="status-warning-text-strong mr-2 h-4 w-4" />
                                        <span className="status-warning-text text-lg font-semibold">
                                            {invoiceMetrics.outstanding} invoices
                                        </span>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <CurrencyDollarIcon className="status-warning-text-strong mr-2 h-4 w-4" />
                                        <span className="status-warning-text text-sm sensitive-data">
                                            {formatCurrency(invoiceMetrics.outstandingTotal, preferredCurrency)} total
                                        </span>
                                    </div>
                                </div>
                                <DocumentTextIcon className="status-warning-text-strong h-8 w-8" />
                            </div>
                        </button>
                    ) : (
                        <div className="rounded-lg bg-muted/40 p-3 sm:p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="status-success-text text-sm font-medium">Outstanding Invoices</h3>
                                    <div className="flex items-center mt-2">
                                        <CheckIcon className="status-success-text-strong mr-2 h-4 w-4" />
                                        <span className="status-success-text text-lg font-semibold">
                                            No outstanding invoices
                                        </span>
                                    </div>
                                    <div className="status-success-text mt-1 text-sm">
                                        No current invoices awaiting payment
                                    </div>
                                </div>
                                <DocumentTextIcon className="status-success-text-strong h-8 w-8" />
                            </div>
                        </div>
                    )}

                    {/* Past Due Invoices */}
                    {invoiceMetrics.pastDue > 0 ? (
                        <button
                            onClick={() => navigateToInvoices({ section: 'invoices', tab: 'overdue' })}
                            className="rounded-lg border border-border bg-muted/40 p-3 text-left transition-colors hover:bg-accent cursor-pointer sm:p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="status-danger-text flex items-center text-sm font-medium">
                                        Past Due Invoices
                                    </h3>
                                    <div className="flex items-center mt-2">
                                        <DocumentTextIcon className="status-danger-text-strong mr-2 h-4 w-4" />
                                        <span className="status-danger-text text-lg font-semibold">
                                            {invoiceMetrics.pastDue} invoices
                                        </span>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <CurrencyDollarIcon className="status-danger-text-strong mr-2 h-4 w-4" />
                                        <span className="status-danger-text text-sm sensitive-data">
                                            {formatCurrency(invoiceMetrics.pastDueTotal, preferredCurrency)} overdue
                                        </span>
                                    </div>
                                </div>
                                <ExclamationTriangleIcon className="status-danger-text-strong h-8 w-8" />
                            </div>
                        </button>
                    ) : (
                        <div className="rounded-lg bg-muted/40 p-3 sm:p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="status-success-text text-sm font-medium">No Past Due Invoices</h3>
                                    <div className="flex items-center mt-2">
                                        <CheckIcon className="status-success-text-strong mr-2 h-4 w-4" />
                                        <span className="status-success-text text-lg font-semibold">
                                            All invoices are up-to-date
                                        </span>
                                    </div>
                                    <div className="status-success-text mt-1 text-sm">
                                        Great job staying on top of payments!
                                    </div>
                                </div>
                                <DocumentTextIcon className="status-success-text-strong h-8 w-8" />
                            </div>
                        </div>
                    )}
                </div>
                )}
            </CardContent>
        </Card>
    );
};

export default MetricsCards;
