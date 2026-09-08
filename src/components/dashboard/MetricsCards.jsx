import { lazy, Suspense } from 'react';
import { ChartBarIcon, ClockIcon, CurrencyDollarIcon, BanknotesIcon, HandCoinsIcon, ArrowUpRightIcon, ArrowDownRightIcon, MinusIcon } from '@/components/ui/icons';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDurationWithSeconds, parseStoredDate } from '@/utils/dateUtils';
import { DashboardMoneyValue } from './DashboardMoneyValue';

const DashboardHoursChart = lazy(() => import('./DashboardHoursChart'));

/** Direction is neutral: more tracked time or spending is not inherently better. */
function ReportTrend({ trend, comparison }) {
    if (!trend) return null;
    const Icon = trend.direction === 'up' ? ArrowUpRightIcon : trend.direction === 'down' ? ArrowDownRightIcon : MinusIcon;
    const changed = trend.direction === 'up' || trend.direction === 'down';
    const dates = `${format(parseStoredDate(comparison.range.startDate), 'd MMM yyyy')} – ${format(parseStoredDate(comparison.range.endDate), 'd MMM yyyy')}`;
    return (
        <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={`${trend.label} ${comparison.label} (${dates})`}>
            <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${changed ? 'status-info-text-strong' : ''}`}><Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{trend.label}</span>
            <span className="truncate">{comparison.label}</span>
        </p>
    );
}

/** A single selected period governs both the four cards and the hours chart. */
export default function MetricsCards({ report, comparison, period, periodOptions, onPeriodChange, preferredCurrency, loading, error, onRetry }) {
    const money = value => <DashboardMoneyValue money={value} currency={preferredCurrency} />;
    const conversionFallback = [report.unbilled, report.received, report.spent].some(value => value.hadConversionError);
    const cards = [
        { label: 'Tracked time', value: formatDurationWithSeconds(report.time), detail: `${formatDurationWithSeconds(report.billableTime)} billable${report.liveTime > 0 ? ' · incl. active' : ''}`, icon: ClockIcon, trend: comparison?.time },
        { label: 'Unbilled amount', value: money(report.unbilled), detail: `${formatDurationWithSeconds(report.unbilledTime)} unbilled`, icon: CurrencyDollarIcon, trend: comparison?.unbilled },
        { label: 'Received', value: money(report.received), detail: 'By payment date', icon: BanknotesIcon, trend: comparison?.received },
        { label: 'Expenses', value: money(report.spent), detail: 'Paid · by expense date', icon: HandCoinsIcon, trend: comparison?.spent },
    ];
    return (
        <Card role="region" aria-labelledby="dashboard-reports-title" className="min-w-0 shadow-sm">
            <CardHeader className="px-3 pt-3 pb-4 sm:px-5 sm:pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="dashboard-reports-title" className="flex items-center text-lg font-semibold"><ChartBarIcon className="status-info-text-strong mr-2 h-5 w-5" />Reports Overview</h2>
                    <Select value={period} onValueChange={onPeriodChange}>
                        <SelectTrigger aria-label="Dashboard report period" className="w-auto min-w-40"><SelectValue /></SelectTrigger>
                        <SelectContent align="end" className="max-h-[min(18rem,var(--radix-select-content-available-height))]">{periodOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="px-3 pb-4 pt-0 sm:px-5 sm:pb-5" aria-busy={loading}>
                {error ? (
                    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm"><span>{error}</span><Button size="sm" variant="outline" onClick={onRetry}>Retry</Button></div>
                ) : loading ? (
                    <div role="status" className="flex h-64 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">Loading report…</div>
                ) : (
                    <>
                        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-5">
                            <div className="grid min-w-0 grid-cols-2 gap-3 xl:col-span-2" data-testid="dashboard-report-metrics">
                                {cards.map(card => {
                                    const { label, value, detail, icon: Icon, trend } = card;
                                    return (
                                    <div key={label} className="flex min-w-0 flex-col rounded-lg border bg-muted/20 p-3 sm:p-4">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="status-info-text-strong h-5 w-5" /></span><h3>{label}</h3></div>
                                        <div className="mt-2 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</div>
                                        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                                        <div className="mt-auto pt-3"><ReportTrend trend={trend} comparison={comparison} /></div>
                                    </div>
                                ); })}
                            </div>
                            <div className="flex min-w-0 flex-col rounded-lg border bg-muted/20 p-3 sm:p-4 xl:col-span-3" role="region" aria-labelledby="dashboard-hours-title">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h3 id="dashboard-hours-title" className="shrink-0 text-sm font-medium">Hours tracked</h3>
                                    <div className="flex min-w-0 flex-wrap justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground" role="group" aria-label="Chart legend">
                                        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[hsl(var(--status-info-accent))]" />Billable</span>
                                        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[hsl(var(--chart-non-billable))]" />Non-billable</span>
                                    </div>
                                </div>
                                <Suspense fallback={<div role="status" className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading chart…</div>}><DashboardHoursChart days={report.days} /></Suspense>
                            </div>
                        </div>
                        {report.unpricedTime > 0 && <p className="mt-3 text-xs text-muted-foreground">Unbilled amount estimates hourly work. {formatDurationWithSeconds(report.unpricedTime)} has no hourly rate.</p>}
                        {conversionFallback && <p className="mt-3 text-xs text-muted-foreground">Unavailable conversions are shown in their original currencies.</p>}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
