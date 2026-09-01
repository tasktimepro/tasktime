import { useEffect, useMemo } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { useExpenses } from '@/hooks/useExpenses';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { buildBasicReportsOverview } from '@/domain/reports/basicReportsOverview';
import { formatCurrency } from '@/utils/currencyUtils';
import { formatDuration } from '@/utils/dateUtils';

function CurrencyTotals({ values }: { values: Array<{ currency: string; amount: number }> }) {
    if (values.length === 0) return <span>—</span>;
    return (
        <span className="flex flex-col gap-1">
            {values.map(value => (
                <span key={value.currency}>{formatCurrency(value.amount, value.currency)}</span>
            ))}
        </span>
    );
}

export function ReportsOverview({ onReadyChange }: { onReadyChange?: ((ready: boolean) => void) | null }) {
    // These three hooks read only the already-loaded active documents. No
    // archive, history, relationship, filter, export, or FX path is requested.
    const { invoices, isLoading: invoicesLoading } = useInvoices();
    const { expenses, isLoading: expensesLoading } = useExpenses();
    const { entries, isLoading: entriesLoading } = useTimeEntries({ activeOnly: true });
    const report = useMemo(() => buildBasicReportsOverview({
        invoices,
        expenses,
        entries,
    }), [invoices, expenses, entries]);
    const ready = !invoicesLoading && !expensesLoading && !entriesLoading;
    useEffect(() => {
        onReadyChange?.(ready);
    }, [onReadyChange, ready]);
    const month = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
        .format(new Date(report.period.startAt));
    const cards = [
        { label: 'Received', value: <CurrencyTotals values={report.received} /> },
        { label: 'Expenses', value: <CurrencyTotals values={report.expenses} /> },
        { label: 'Tracked time', value: formatDuration(report.trackedTimeMs) },
    ];
    return (
        <section aria-labelledby="basic-reports-overview-title" className="space-y-5">
            <div>
                <h2 id="basic-reports-overview-title" className="text-xl font-semibold">Current month</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {month}, calculated from local TaskTime records without currency conversion.
                </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                {cards.map(card => (
                    <div key={card.label} className="rounded-xl border bg-card p-5 shadow-sm">
                        <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                        <div className="mt-2 text-2xl font-semibold text-foreground">{card.value}</div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
                Received uses invoice payment dates and source-currency payment snapshots. Expenses use expense dates.
                Tracked time uses actual entry duration.
            </p>
        </section>
    );
}
