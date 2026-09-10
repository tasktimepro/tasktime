import { CategoryColorDot, CategoryLabel } from './CategoryLabel';
import { lazy, Suspense, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDaysIcon, CheckIcon, ClockIcon, PlusIcon, TagsIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import Modal from '@/components/Modal';
import { parseStoredDate, toDisplayDate } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/currencyUtils';
import ExpenseAmount from './ExpenseAmount';

const ExpenseSpendingChart = lazy(() => import('./ExpenseSpendingChart'));

/** Shared rows keep widget and modal interactions consistent. */
function ActivityRows({ activity, currency, onView }) {
    return <ul className="divide-y divide-border">{activity.map(item => {
        const Icon = item.kind === 'paid' ? CheckIcon : item.kind === 'upcoming' ? CalendarDaysIcon : PlusIcon;
        return <li key={item.expense.id}>
            <button type="button" onClick={() => onView?.(item.expense)} disabled={!onView}
                className={`flex w-full min-w-0 items-center gap-3 rounded-md px-2 py-3 text-left sm:px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${onView ? 'group cursor-pointer hover:bg-muted/30' : ''}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4 status-info-text-strong" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium">{item.label}</span><span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground transition-colors group-hover:text-[hsl(var(--status-info-accent))] group-focus-visible:text-[hsl(var(--status-info-accent))]"><CategoryColorDot category={item.category} /><span className="truncate">{item.expense.title}</span></span></span>
                <span className="shrink-0 text-right text-xs"><span className="sensitive-data block tabular-nums">{item.expense.amountType === 'variable' && item.kind === 'upcoming' ? '~' : ''}{formatCurrency(item.expense.amount || 0, item.expense.currency || currency)}</span><span className="mt-1 block text-muted-foreground">{toDisplayDate(item.date)}</span></span>
            </button>
        </li>;
    })}</ul>;
}

/** Historical context and recorded activity stay separate from payment actions. */
export default function ExpenseInsights({ overview, currency, periodLabel, onView }) {
    const [allCategories, setAllCategories] = useState(false);
    const [activityOpen, setActivityOpen] = useState(false);
    const activityTriggerRef = useRef(null);
    const fallback = [overview.spent, overview.previous, overview.recurring, overview.upcoming, ...overview.months.map(month => month.money)].some(money => money.hadConversionError);
    return <div className="min-w-0 space-y-3" data-testid="expense-insights">
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-5">
            <section aria-labelledby="expense-spending-title" className="min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5 xl:col-span-3">
                <div className="grid h-full min-w-0 grid-cols-1 gap-5 md:grid-cols-5">
                    <div className="min-w-0 md:col-span-3">
                        <h2 id="expense-spending-title" className="text-sm font-semibold">Spending overview</h2>
                        <p className="mb-3 mt-1 text-xs text-muted-foreground">6 months to {format(parseStoredDate(overview.chartEndDate), 'MMM yyyy')} · paid expenses</p>
                        {overview.chartCurrency ? <Suspense fallback={<div role="status" className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading chart…</div>}><ExpenseSpendingChart months={overview.months} currency={overview.chartCurrency} /></Suspense>
                            : <div className="flex h-48 items-center justify-center rounded-lg bg-muted/20 p-4 text-sm text-muted-foreground">Monthly amounts use different currencies. A combined chart is unavailable.</div>}
                    </div>
                    <div className="flex min-w-0 flex-col border-t pt-4 md:col-span-2 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                        <h3 className="text-sm font-semibold">By category</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{periodLabel} · paid expenses</p>
                        {overview.breakdown.length ? <ul className="mt-4 space-y-4">{(allCategories ? overview.breakdown : overview.breakdown.slice(0, 5)).map(item => <li key={item.id} className="space-y-1.5">
                            <div className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 break-words"><CategoryLabel category={item} /></span><span className="shrink-0 text-right"><ExpenseAmount money={item.money} currency={currency} /></span></div>
                            {item.percentage !== null && <div className="flex items-center gap-2"><div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className="sensitive-data h-full rounded-full bg-muted-foreground" style={{ width: item.percentage + '%', ...(/^#[a-f\d]{6}$/i.test(item.color || '') ? { backgroundColor: item.color } : {}) }} /></div><span className="sensitive-data w-9 text-right text-xs text-muted-foreground">{Math.round(item.percentage)}%</span></div>}
                        </li>)}</ul> : <EmptyState icon={TagsIcon} iconSize="sm" title="No paid expenses in this period." className="my-auto py-6" />}
                        {overview.breakdown.length > 5 && <Button variant="link" size="sm" className="mt-3 h-auto px-0" onClick={() => setAllCategories(!allCategories)}>{allCategories ? 'Show less' : 'View full breakdown'}</Button>}
                    </div>
                </div>
            </section>
            <section aria-labelledby="expense-activity-title" className="flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-sm sm:p-5 xl:col-span-2">
                <div className="mb-3 flex items-center justify-between gap-3"><h2 id="expense-activity-title" className="text-sm font-semibold">Recent activity</h2>
                    {overview.activity.length > 3 && <Button ref={activityTriggerRef} variant="outline" size="sm" onClick={() => setActivityOpen(true)}>Show more</Button>}
                </div>
                {overview.activity.length ? <ActivityRows activity={overview.activity.slice(0, 3)} currency={currency} onView={onView} /> : <EmptyState icon={ClockIcon} iconSize="sm" title="No recent activity." className="my-auto py-6" />}
            </section>
        </div>
        {fallback && <p className="text-xs text-muted-foreground">Unavailable conversions are shown in their original currencies.</p>}
        <Modal isOpen={activityOpen} onClose={() => setActivityOpen(false)} title="Recent activity" size="xl"
            onCloseAutoFocus={event => { event.preventDefault(); activityTriggerRef.current?.focus(); }}
            description={`Last 30 days · ${toDisplayDate(overview.activityRange.startDate)} – ${toDisplayDate(overview.activityRange.endDate)}`}>
            {overview.recordedActivity.length ? <ActivityRows activity={overview.recordedActivity} currency={currency} onView={onView} />
                : <p className="py-8 text-sm text-muted-foreground">No activity in the last 30 days.</p>}
        </Modal>
    </div>;
}
