import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { formatDurationWithSeconds, parseStoredDate } from '@/utils/dateUtils';

const BILLABLE_COLOR = 'hsl(var(--status-info-accent))';
const NON_BILLABLE_COLOR = 'hsl(var(--chart-non-billable))';
const HOUR = 3600000;

/** One tooltip describes the whole day, including both parts and their actual total. */
function HoursTooltip({ active, payload }) {
    const day = payload?.[0]?.payload;
    if (!active || !day) return null;
    return (
        <div className="min-w-40 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md">
            <p className="mb-2 font-medium">{format(parseStoredDate(day.date), 'd MMMM yyyy')}</p>
            <dl className="space-y-1 tabular-nums">
                <div className="flex justify-between gap-6"><dt>Billable</dt><dd>{formatDurationWithSeconds(day.billable)}</dd></div>
                <div className="flex justify-between gap-6"><dt>Non-billable</dt><dd>{formatDurationWithSeconds(day.nonBillable)}</dd></div>
                <div className="flex justify-between gap-6 border-t pt-1 font-semibold"><dt>Total</dt><dd>{formatDurationWithSeconds(day.total)}</dd></div>
            </dl>
        </div>
    );
}

/** Stacked actual hours, using Recharts with the application's shadcn-style theme and tooltip. */
export default function DashboardHoursChart({ days }) {
    const chartDays = days.map(day => ({ ...day, billableHours: day.billable / HOUR, nonBillableHours: day.nonBillable / HOUR }));
    const maxHours = Math.max(8, Math.ceil(days.reduce((peak, day) => Math.max(peak, day.total / HOUR), 0)));
    const ticks = Array.from({ length: 5 }, (_, index) => Math.round(index * maxHours / 4));
    return (
        <div className="flex min-w-0 flex-1 flex-col" data-testid="dashboard-hours-chart">
            <div className="relative min-h-44 w-full min-w-0 flex-1 text-xs text-muted-foreground [&_.recharts-cartesian-axis-tick_text]:fill-current">
                <div className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={chartDays} accessibilityLayer margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="25%" aria-label="Daily tracked hours, split into billable and non-billable time">
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={32} tickMargin={10} tickFormatter={date => format(parseStoredDate(date), 'd MMM')} />
                            <YAxis tickLine={false} axisLine={false} width="auto" domain={[0, maxHours]} ticks={ticks} interval={0} tickFormatter={value => `${value}h`} />
                            <Tooltip content={<HoursTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
                            <Bar dataKey="billableHours" name="Billable" stackId="hours" fill={BILLABLE_COLOR} isAnimationActive={false} />
                            <Bar dataKey="nonBillableHours" name="Non-billable" stackId="hours" fill={NON_BILLABLE_COLOR} isAnimationActive={false} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="sr-only">
                <table className="w-full text-right tabular-nums">
                    <caption className="sr-only">Actual time tracked each day</caption>
                    <thead><tr className="border-b"><th scope="col" className="p-2 text-left">Date</th><th scope="col" className="p-2">Billable</th><th scope="col" className="p-2">Non-billable</th><th scope="col" className="p-2">Total</th></tr></thead>
                    <tbody>{days.map(day => <tr key={day.date} className="border-b last:border-0"><th scope="row" className="p-2 text-left font-normal">{format(parseStoredDate(day.date), 'd MMM')}</th><td className="p-2">{formatDurationWithSeconds(day.billable)}</td><td className="p-2">{formatDurationWithSeconds(day.nonBillable)}</td><td className="p-2">{formatDurationWithSeconds(day.total)}</td></tr>)}</tbody>
                </table>
            </div>
        </div>
    );
}
