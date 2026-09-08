import { ClockIcon, CurrencyDollarIcon, DocumentTextIcon, ListTodoIcon } from '@/components/ui/icons';
import { formatDurationWithSeconds } from '@/utils/dateUtils';
import { DashboardMoneyValue } from './DashboardMoneyValue';

/** Small, noninteractive sparkline; its data and period are stated in the card. */
function TrackedSparkline({ values }) {
    const maximum = Math.max(...values, 1);
    const points = values.map((value, index) => `${index * 100 / Math.max(values.length - 1, 1)},${28 - value / maximum * 24}`).join(' ');
    return <svg viewBox="0 0 100 32" className="status-info-text-strong h-8 w-24 shrink-0" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Fixed-timeframe summaries remain independent of the report period. */
export default function DashboardSummaryCards({ currentMonth, todayTime, todayLiveTime = 0, recentDays, dueCount, overdueCount, preferredCurrency, loading, error, navigateToInvoices }) {
    const invoiceLinks = [
        { count: currentMonth.unpaidCount - currentMonth.overdueCount, label: 'outstanding', tab: 'outstanding' },
        { count: currentMonth.overdueCount, label: 'overdue', tab: 'overdue' },
    ].filter(item => item.count > 0);
    const invoiceDetail = invoiceLinks.length ? <span className="flex flex-wrap gap-x-3">{invoiceLinks.map(item => (
        <button key={item.tab} type="button" className="rounded-sm py-1 underline decoration-border underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" disabled={!navigateToInvoices} aria-label={`${item.count} ${item.label} ${item.count === 1 ? 'invoice' : 'invoices'}`} onClick={() => navigateToInvoices?.({ section: 'invoices', tab: item.tab })}>{item.count} {item.label}</button>
    ))}</span> : 'No unpaid invoices';
    const cards = [
        { title: 'Tracked today', value: formatDurationWithSeconds(todayTime), detail: todayLiveTime > 0 ? 'Incl. active · last 7 days' : 'Saved time · last 7 days', icon: ClockIcon, sparkline: true },
        { title: 'Tasks due today', value: dueCount, detail: `${overdueCount} overdue`, icon: ListTodoIcon, ready: true },
        { title: 'Unbilled this month', value: <DashboardMoneyValue money={currentMonth.unbilled} currency={preferredCurrency} />, detail: `${formatDurationWithSeconds(currentMonth.unbilledTime)} unbilled${currentMonth.unpricedTime > 0 ? ' · some time has no hourly rate' : ''}`, icon: CurrencyDollarIcon },
        { title: 'Unpaid invoices', value: <DashboardMoneyValue money={currentMonth.unpaid} currency={preferredCurrency} />, detail: invoiceDetail, icon: DocumentTextIcon },
    ];
    return (
        <section aria-label="Dashboard summary" tabIndex={0} className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto rounded-xl pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring md:grid md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-4">
            {cards.map(card => {
                const { title, value, detail, icon: Icon, sparkline, ready } = card;
                const pending = (loading || error) && !ready;
                return (
                    <div key={title} className="min-w-0 basis-60 shrink-0 snap-start rounded-xl border bg-card p-4 text-left shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="status-info-text-strong h-4 w-4 shrink-0" /><h2>{title}</h2></div>
                        <div className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums">{pending ? <span aria-label={error ? 'Unavailable' : 'Loading'}>—</span> : value}</div>
                        <div className="mt-2 flex min-h-8 items-center justify-between gap-2 text-xs text-muted-foreground"><span>{pending ? (error ? 'Records unavailable' : 'Loading records…') : detail}</span>{sparkline && !pending && <TrackedSparkline values={recentDays} />}</div>
                    </div>
                );
            })}
        </section>
    );
}
