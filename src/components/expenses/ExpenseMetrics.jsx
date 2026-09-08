import { ArrowPathIcon, ArrowDownRightIcon, ArrowUpRightIcon, CalendarDaysIcon, HandCoinsIcon, MinusIcon, TagsIcon } from '@/components/ui/icons';
import { toDisplayDate } from '@/utils/dateUtils';
import ExpenseAmount from './ExpenseAmount';

/** Compact neutral cards; the existing expense list remains the action surface. */
export default function ExpenseMetrics({ overview, currency, periodLabel, loading, error, onRecurring, onUpcoming }) {
    const TrendIcon = overview.trend.direction === 'up' ? ArrowUpRightIcon : overview.trend.direction === 'down' ? ArrowDownRightIcon : MinusIcon;
    const top = overview.topCategory;
    const peak = Math.max(1, ...overview.months.map(month => month.value || 0));
    const points = overview.months.map((month, index) => (index * 20) + ',' + (28 - (month.value || 0) / peak * 24)).join(' ');
    const cards = [
        { label: periodLabel + ' spend', icon: HandCoinsIcon, value: <ExpenseAmount money={overview.spent} currency={currency} />,
            detail: <span className="flex min-w-0 items-center gap-1" title={overview.comparison.startDate + ' – ' + overview.comparison.endDate}><span className="inline-flex shrink-0 items-center gap-1 status-info-text-strong"><TrendIcon className="h-3.5 w-3.5" />{overview.trend.label}</span><span className="truncate">{overview.comparison.label}</span></span>,
            visual: overview.chartCurrency && <svg viewBox="0 0 100 32" className="sensitive-data h-8 w-20 shrink-0 status-info-text-strong" aria-hidden="true"><polyline points={points} stroke="currentColor" strokeWidth="2" fill="none" /></svg> },
        { label: 'Recurring expenses', icon: ArrowPathIcon, value: <ExpenseAmount money={overview.recurring} currency={currency} />,
            detail: 'Est. / month · ' + overview.recurringCount + ' active',
            note: overview.unknownRecurringCount ? overview.unknownRecurringCount + ' variable without an estimate' : null, action: onRecurring, actionLabel: 'Manage recurring expenses' },
        { label: 'Upcoming payments', icon: CalendarDaysIcon, value: <><span className="sensitive-data">{overview.upcomingEstimated ? '~' : ''}</span><ExpenseAmount money={overview.upcoming} currency={currency} /></>,
            detail: overview.upcomingCount + ' scheduled · next occurrences', note: overview.nextDate ? 'Next ' + toDisplayDate(overview.nextDate) : 'None in this period', action: onUpcoming, actionLabel: 'View upcoming expenses' },
        { label: 'Top category', icon: TagsIcon, value: top?.name || (Object.keys(overview.spent.amounts).length > 1 ? 'Multiple currencies' : 'No spending yet'),
            detail: top ? Math.round(top.percentage) + '% of period spend' : 'Paid expenses in this period',
            visual: top && <svg viewBox="0 0 64 64" className="sensitive-data h-14 w-14 shrink-0 -rotate-90" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" /><circle cx="32" cy="32" r="26" fill="none" stroke="hsl(var(--status-info-accent))" strokeWidth="5" pathLength="100" strokeDasharray={top.percentage + ' 100'} strokeLinecap="round" /></svg> },
    ];
    return (
        <section aria-label="Expense summary" tabIndex={0} className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto rounded-xl pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring md:grid md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-4" aria-busy={loading}>
            {cards.map(card => <div key={card.label} className={`relative flex min-w-0 basis-64 shrink-0 snap-start flex-col rounded-xl border bg-card p-4 shadow-sm ${card.action ? 'transition-colors hover:bg-muted/30' : ''}`}>
                <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><card.icon className="h-4 w-4 shrink-0 status-info-text-strong" />{card.label}</h2>
                <div className="mt-3 flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 break-words text-2xl font-semibold tracking-tight">{loading || error ? <span aria-label={error ? 'Unavailable' : 'Loading'}>—</span> : card.value}</div>
                    {!loading && !error && card.visual}
                </div>
                <div className="mt-2 min-w-0 text-xs text-muted-foreground">{loading || error ? (error ? 'Records unavailable' : 'Loading records…') : card.detail}</div>
                {!loading && !error && card.note && <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>}
                {card.action && <button type="button" aria-label={card.actionLabel} className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring" onClick={card.action} />}
            </div>)}
        </section>
    );
}
