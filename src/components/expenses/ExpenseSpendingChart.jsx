import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { parseStoredDate } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/currencyUtils';

/** The same lazy chart engine as Dashboard; values remain available without a pointer. */
export default function ExpenseSpendingChart({ months, currency }) {
    return <div className="sensitive-data min-w-0">
        <div className="h-48 w-full min-w-0 text-xs text-muted-foreground [&_.recharts-cartesian-axis-tick_text]:fill-current">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={months} accessibilityLayer aria-label="Monthly paid expenses" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={date => format(parseStoredDate(date), 'MMM')} />
                    <YAxis tickLine={false} axisLine={false} width="auto" tickFormatter={value => new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value)} />
                    <Tooltip labelFormatter={date => format(parseStoredDate(date), 'MMMM yyyy')} formatter={value => [formatCurrency(value, currency), 'Paid']} contentStyle={{ background: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--popover-foreground))' }} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
                    <Bar dataKey="value" name="Paid" fill="hsl(var(--status-info-accent))" maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
        <table className="sr-only"><caption>Monthly paid expense values</caption><thead><tr><th scope="col">Month</th><th scope="col">Paid</th></tr></thead><tbody>{months.map(month => <tr key={month.date}><th scope="row">{format(parseStoredDate(month.date), 'MMMM yyyy')}</th><td>{formatCurrency(month.value, currency)}</td></tr>)}</tbody></table>
    </div>;
}
