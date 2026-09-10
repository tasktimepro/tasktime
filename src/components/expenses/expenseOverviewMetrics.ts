import { differenceInCalendarDays, endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns';
import type { Expense, ExpenseCategory, ExpenseRecurrence } from '@/stores/yjs/types';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import { getPaidExpenseConvertedAmount } from '@/utils/expenseUtils';

type Range = { startDate: string; endDate: string };
export type ExpenseOverviewMoney = { amounts: Record<string, number>; hadConversionError: boolean };
type Convert = (amounts: Record<string, number>) => { amounts: Record<string, number>; hadConversionError: boolean };
const emptyMoney = (): ExpenseOverviewMoney => ({ amounts: {}, hadConversionError: false });
const round = (value: number) => Math.round(value * 100) / 100;
const inRange = (date: string, range: Range) => date >= range.startDate && date <= range.endDate;

/** Calendar comparisons preserve month/quarter/year boundaries, including leap days. */
export function resolveExpenseComparison(period: string, range: Range) {
    const start = parseStoredDate(range.startDate);
    const end = parseStoredDate(range.endDate);
    if (!start || !end || start > end) return { startDate: '', endDate: '', label: 'vs last period' };
    const months = period === 'year' ? 12 : period === 'quarter' ? 3 : period === 'custom' ? 0 : 1;
    return {
        startDate: toStorageDate(months ? subMonths(start, months) : subDays(start, differenceInCalendarDays(end, start) + 1))!,
        endDate: toStorageDate(subDays(start, 1))!,
        label: 'vs last ' + (period === 'year' ? 'year' : period === 'quarter' ? 'quarter' : period === 'custom' ? 'period' : 'month'),
    };
}

function add(money: ExpenseOverviewMoney, amounts: Record<string, number>, hadConversionError = false) {
    Object.entries(amounts).forEach(([currency, value]) => {
        if (Number.isFinite(value)) money.amounts[currency] = round((money.amounts[currency] || 0) + value);
    });
    money.hadConversionError ||= hadConversionError;
}

function resolveAmount(expense: Expense, currency: string, convert: Convert): ExpenseOverviewMoney {
    const resolved = getPaidExpenseConvertedAmount(expense, currency);
    if (resolved.success || resolved.usedSnapshot) return { amounts: { [resolved.currency]: round(resolved.amount) }, hadConversionError: !resolved.success };
    const result = convert({ [resolved.currency]: resolved.amount });
    return result.hadConversionError ? { amounts: { [resolved.currency]: resolved.amount }, hadConversionError: true } : result;
}

function estimate(amount: number, source: string, convert: Convert) {
    const amounts = { [source]: amount };
    const result = convert(amounts);
    return result.hadConversionError ? { amounts, hadConversionError: true } : result;
}

/** Read-only projections use saved payments and existing next-occurrence previews. */
export function buildExpenseOverview({ expenses, recurrences, upcoming, categories, range, period, today, currency, convert }: {
    expenses: Expense[]; recurrences: ExpenseRecurrence[]; upcoming: Expense[]; categories: ExpenseCategory[];
    range: Range; period: string; today: string; currency: string; convert: Convert;
}) {
    const comparison = resolveExpenseComparison(period, range);
    const invalidRange = !comparison.startDate;
    const anchor = parseStoredDate(!invalidRange && range.endDate < today ? range.endDate : today)!;
    const months = Array.from({ length: 6 }, (_, index) => ({ date: toStorageDate(startOfMonth(subMonths(anchor, 5 - index)))!, money: emptyMoney() }));
    const spent = emptyMoney();
    const previous = emptyMoney();
    const categoryMap = new Map<string, { id: string; name: string; color?: string | null; money: ExpenseOverviewMoney }>();
    const categoryNames = new Map(categories.map(category => [category.id, category]));
    expenses.forEach(expense => {
        if (expense.isPreview || expense.paymentStatus !== 'paid' || expense.date > today || !parseStoredDate(expense.date)) return;
        const amount = resolveAmount(expense, currency, convert);
        const month = months.find(item => item.date.slice(0, 7) === expense.date.slice(0, 7));
        if (month) add(month.money, amount.amounts, amount.hadConversionError);
        if (inRange(expense.date, comparison)) add(previous, amount.amounts, amount.hadConversionError);
        if (!invalidRange && inRange(expense.date, range)) {
            add(spent, amount.amounts, amount.hadConversionError);
            const id = expense.categoryId || '';
            if (!categoryMap.has(id)) categoryMap.set(id, { id, name: categoryNames.get(id)?.name || 'Uncategorized', color: categoryNames.get(id)?.color, money: emptyMoney() });
            add(categoryMap.get(id)!.money, amount.amounts, amount.hadConversionError);
        }
    });
    const total = (money: ExpenseOverviewMoney) => round(Object.values(money.amounts).reduce((sum, amount) => sum + amount, 0));
    const currencies = new Set([...Object.keys(spent.amounts), ...Object.keys(previous.amounts)]);
    const comparable = !spent.hadConversionError && !previous.hadConversionError && currencies.size <= 1;
    const now = total(spent);
    const before = total(previous);
    const change = Math.abs((now - before) / before * 100);
    const trend = !comparable ? { direction: 'unavailable', label: 'N/A' }
        : now === before ? { direction: 'flat', label: 'No change' }
            : before === 0 ? { direction: 'new', label: 'New' }
                : { direction: now > before ? 'up' : 'down', label: (now > before ? '+' : '−') + (change < 0.1 ? '<0.1' : Number(change.toFixed(1))) + '%' };
    const canRank = Object.keys(spent.amounts).length <= 1 && now > 0 && [...categoryMap.values()].every(item => total(item.money) >= 0);
    const breakdown = [...categoryMap.values()].map(item => ({ ...item, percentage: canRank ? total(item.money) / now * 100 : null }))
        .sort((a, b) => canRank ? total(b.money) - total(a.money) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    const chartCurrencies = new Set(months.flatMap(month => Object.keys(month.money.amounts)));
    const chartCurrency = chartCurrencies.size > 1 ? null : [...chartCurrencies][0] || currency;

    const activeRecurrences = recurrences.filter(item => item.active && (!item.endDate || item.endDate >= today));
    const recurring = emptyMoney();
    activeRecurrences.forEach(item => {
        const amount = estimate((item.amount || 0) / (item.repeat === 'yearly' ? 12 : 1), item.currency || currency, convert);
        add(recurring, amount.amounts, amount.hadConversionError);
    });
    const upcomingMoney = emptyMoney();
    upcoming.forEach(item => {
        const amount = estimate(item.amount || 0, item.currency || currency, convert);
        add(upcomingMoney, amount.amounts, amount.hadConversionError);
    });
    const scheduled = [...upcoming].sort((a, b) => a.date.localeCompare(b.date));
    // Include today and the preceding 29 local calendar days, independent of the spending period.
    const activityRange = { startDate: toStorageDate(subDays(parseStoredDate(today)!, 29))!, endDate: today };
    const events = expenses.flatMap(expense => {
        if (expense.isPreview) return [];
        const paidOn = expense.paymentStatus === 'paid' && expense.date <= today && parseStoredDate(expense.paidOn) && expense.paidOn! <= today ? expense.paidOn : null;
        const created = Number.isFinite(expense.createdAt) ? toStorageDate(new Date(expense.createdAt!)) : null;
        const date = paidOn || (created && created <= today ? created : null);
        return date && inRange(date, activityRange) ? [{ expense, category: expense.categoryId ? categoryNames.get(expense.categoryId) : undefined, date, label: paidOn ? 'Marked paid' : 'New expense', kind: paidOn ? 'paid' : 'created' }] : [];
    }).sort((a, b) => b.date.localeCompare(a.date) || (b.expense.createdAt || 0) - (a.expense.createdAt || 0));
    const next = scheduled[0];
    const activity = [...(next ? [{ expense: next, category: next.categoryId ? categoryNames.get(next.categoryId) : undefined, date: next.date, label: 'Upcoming payment', kind: 'upcoming' }] : []), ...events.filter(item => item.expense.id !== next?.id)];
    return {
        spent, previous, trend, comparison, invalidRange,
        months: months.map(month => ({ ...month, value: chartCurrency ? month.money.amounts[chartCurrency] || 0 : null })),
        chartCurrency, chartEndDate: toStorageDate(endOfMonth(anchor))!, breakdown,
        topCategory: canRank ? breakdown[0] || null : null,
        recurring, recurringCount: activeRecurrences.length,
        unknownRecurringCount: activeRecurrences.filter(item => item.amountType === 'variable' && !item.amount).length,
        upcoming: upcomingMoney, upcomingCount: upcoming.length, nextDate: next?.date || null,
        upcomingEstimated: upcoming.some(item => item.amountType === 'variable'), activity, recordedActivity: events, activityRange,
    };
}
