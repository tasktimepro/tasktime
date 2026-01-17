import {
    BanknotesIcon,
    CalendarDaysIcon,
    ChartBarIcon,
    CheckIcon,
    ClockIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon
} from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '../../utils/currencyUtils';

/**
 * MetricsCards component - Reports overview and invoice metrics.
 * @param {Object} props
 */
const MetricsCards = ({
    thisMonthMetrics,
    lastMonthMetrics,
    thisYearMetrics,
    invoiceMetrics,
    thisMonthBillableHours,
    thisMonthUnbilledDisplay,
    preferredCurrency,
    formatDuration,
    needsExchangeRates,
    exchangeRatesLoading,
    navigateToInvoices
}) => {
    const renderEarningsByCurrency = (metrics, colorScheme = 'blue') => {
        // Show loading indicator if we need exchange rates and they're still loading
        if (needsExchangeRates && exchangeRatesLoading) {
            return <span className="text-muted-foreground text-sm italic">Loading rates...</span>;
        }

        const billableTotal = Object.values(metrics.billableEarnings).reduce((sum, amount) => sum + amount, 0);
        const paidTotal = Object.values(metrics.paidInvoices).reduce((sum, amount) => sum + amount, 0);
        const outstandingTotal = Object.values(metrics.outstandingInvoices).reduce((sum, amount) => sum + amount, 0);

        // If no earnings at all, show zero
        if (billableTotal === 0 && paidTotal === 0 && outstandingTotal === 0) {
            return <span className="text-muted-foreground">{formatCurrency(0, preferredCurrency)}</span>;
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
                    <span className={`font-semibold ${colors.text}`}>
                        {formatCurrency(amount, currency)}
                    </span>
                    <span className={`text-xs ${colors.bg} ${colors.badge} px-1.5 py-0.5 rounded ml-1`}>
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

        // Add paid invoices (highest priority)
        if (paidTotal > 0) {
            const paidLines = renderAmountLine(metrics.paidInvoices, 'paid', BanknotesIcon, colors.icon, 'paid');
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

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                    <ChartBarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                    Reports Overview
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* This Month */}
                    <div className="bg-muted/40 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">This Month</h3>
                                <div className="mt-2">
                                    <div className="flex items-center">
                                        <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                                            {renderEarningsByCurrency(thisMonthMetrics, 'blue')}
                                        </div>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <ClockIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-1" />
                                        <span className="text-sm text-blue-700 dark:text-blue-300">
                                            {formatDuration(thisMonthMetrics.time)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <CalendarDaysIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>

                    {/* Last Month */}
                    <div className="bg-muted/40 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-foreground">Last Month</h3>
                                <div className="mt-2">
                                    <div className="flex items-center">
                                        <BanknotesIcon className="h-4 w-4 text-muted-foreground mr-1" />
                                        <div className="text-lg font-semibold text-foreground">
                                            {renderEarningsByCurrency(lastMonthMetrics, 'gray')}
                                        </div>
                                    </div>
                                    <div className="flex items-center mt-1">
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

                    {/* This Year */}
                    <div className="bg-muted/40 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-green-900 dark:text-green-100">This Year</h3>
                                <div className="mt-2">
                                    <div className="flex items-center">
                                        <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                                            {renderEarningsByCurrency(thisYearMetrics, 'green')}
                                        </div>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <ClockIcon className="h-4 w-4 text-green-600 dark:text-green-400 mr-1" />
                                        <span className="text-sm text-green-700 dark:text-green-300">
                                            {formatDuration(thisYearMetrics.time)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <CalendarDaysIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                </div>

                {/* Invoice Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    {/* Outstanding Invoices */}
                    {invoiceMetrics.outstanding > 0 ? (
                        <button
                            onClick={() => navigateToInvoices({ section: 'invoices', tab: 'outstanding' })}
                            className="bg-muted/40 rounded-lg p-4 text-left hover:bg-accent transition-colors border border-border cursor-pointer"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">Outstanding Invoices</h3>
                                    <div className="flex items-center mt-2">
                                        <DocumentTextIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 mr-2" />
                                        <span className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                                            {invoiceMetrics.outstanding} invoices
                                        </span>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <CurrencyDollarIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 mr-2" />
                                        <span className="text-sm text-amber-700 dark:text-amber-300">
                                            {formatCurrency(invoiceMetrics.outstandingTotal, preferredCurrency)} total
                                        </span>
                                    </div>
                                </div>
                                <DocumentTextIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                            </div>
                        </button>
                    ) : (
                        <div className="bg-muted/40 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-green-900 dark:text-green-100">Outstanding Invoices</h3>
                                    <div className="flex items-center mt-2">
                                        <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                                        <span className="text-lg font-semibold text-green-900 dark:text-green-100">
                                            No outstanding invoices
                                        </span>
                                    </div>
                                    <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                                        No outstanding payments
                                    </div>
                                </div>
                                <DocumentTextIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    )}

                    {/* Past Due Invoices */}
                    {invoiceMetrics.pastDue > 0 ? (
                        <button
                            onClick={() => navigateToInvoices({ section: 'invoices', tab: 'overdue' })}
                            className="bg-muted/40 rounded-lg p-4 text-left hover:bg-accent transition-colors border border-border cursor-pointer"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-red-900 dark:text-red-100 flex items-center">
                                        Past Due Invoices
                                    </h3>
                                    <div className="flex items-center mt-2">
                                        <DocumentTextIcon className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                                        <span className="text-lg font-semibold text-red-900 dark:text-red-100">
                                            {invoiceMetrics.pastDue} invoices
                                        </span>
                                    </div>
                                    <div className="flex items-center mt-1">
                                        <CurrencyDollarIcon className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                                        <span className="text-sm text-red-700 dark:text-red-300">
                                            {formatCurrency(invoiceMetrics.pastDueTotal, preferredCurrency)} overdue
                                        </span>
                                    </div>
                                </div>
                                <ExclamationTriangleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                        </button>
                    ) : (
                        <div className="bg-muted/40 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-green-900 dark:text-green-100">No Past Due Invoices</h3>
                                    <div className="flex items-center mt-2">
                                        <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                                        <span className="text-lg font-semibold text-green-900 dark:text-green-100">
                                            All invoices are up-to-date
                                        </span>
                                    </div>
                                    <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                                        Great job staying on top of payments!
                                    </div>
                                </div>
                                <DocumentTextIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    )}

                    {/* Pending Bills This Month Notice */}
                    <div className="bg-muted/40 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">Pending Bills This Month</h3>
                                <div className="flex items-center mt-2">
                                    <ClockIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                                    <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                                        {thisMonthBillableHours.toFixed(1)}h
                                    </span>
                                </div>
                                <div className="flex items-center mt-1">
                                    <CurrencyDollarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                                    <span className="text-sm text-blue-700 dark:text-blue-300">
                                        {thisMonthUnbilledDisplay} unbilled
                                    </span>
                                </div>
                            </div>
                            <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default MetricsCards;
