import { getBillableTaskIds } from '@/domain/time/taskBillability';
import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns';
import type { Client, Expense, Invoice, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import { getActualDurationMs, getBillableDurationMs } from '@/utils/timeEntryDurationUtils';
import { getInvoiceEligibleTimeEntries } from '@/domain/invoices/invoiceEligibility';
import { getInvoicePaidAtTimestamp, getInvoiceStatus, getInvoiceTotal, getPaidInvoiceConvertedAmount } from '@/utils/invoiceUtils';
import { getProjectCurrency } from '@/utils/currencyUtils';
import { getPaidExpenseConvertedAmount } from '@/utils/expenseUtils';

export type DashboardRange = { startDate: string; endDate: string };
export type DashboardDay = { date: string; billable: number; nonBillable: number; total: number };
export type DashboardMoney = { amounts: Record<string, number>; hadConversionError: boolean };
type Convert = (amounts: Record<string, number>) => { amounts: Record<string, number>; hadConversionError?: boolean };
const HOUR = 3600000;

/** Presets use local calendar dates and include the entire selected end day. */
export function resolveDashboardPeriod(period: string, todayStr: string): DashboardRange {
    const today = parseStoredDate(todayStr) || new Date();
    let month = today;
    if (period === 'last-90-days') {
        return { startDate: toStorageDate(subDays(today, 89))!, endDate: toStorageDate(today)! };
    }
    if (period === 'last-month') month = subMonths(today, 1);
    else if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) month = parseStoredDate(`${period}-01`) || today;
    return { startDate: toStorageDate(startOfMonth(month))!, endDate: toStorageDate(endOfMonth(month))! };
}

/** Compare full calendar months, or the preceding equal-length calendar-day window. */
export function resolveDashboardComparison(range: DashboardRange) {
    const start = parseStoredDate(range.startDate)!;
    const end = parseStoredDate(range.endDate)!;
    if (range.startDate === toStorageDate(startOfMonth(start)) && range.endDate === toStorageDate(endOfMonth(start))) {
        const previous = subMonths(start, 1);
        return { range: { startDate: toStorageDate(previous)!, endDate: toStorageDate(endOfMonth(previous))! }, label: 'vs last month' };
    }
    const days = differenceInCalendarDays(end, start) + 1;
    return { range: { startDate: toStorageDate(subDays(start, days))!, endDate: toStorageDate(subDays(start, 1))! }, label: `vs last ${days}d` };
}

type DashboardTrend = { direction: 'up' | 'down' | 'flat' | 'new' | 'unavailable'; label: string };

/** A zero baseline has no percentage; signs indicate direction rather than good/bad. */
function calculateTrend(current: number | null, previous: number | null): DashboardTrend {
    if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) return { direction: 'unavailable', label: 'N/A' };
    if (current === previous) return { direction: 'flat', label: 'No change' };
    if (previous === 0) return { direction: 'new', label: 'New' };
    const percentage = Math.abs((current - previous) / previous * 100);
    const amount = percentage < 0.1 ? '<0.1' : String(Number(percentage.toFixed(1)));
    return { direction: current > previous ? 'up' : 'down', label: `${current > previous ? '+' : '−'}${amount}%` };
}

/** The live dashboard can refresh its time trend without recalculating money. */
export function compareDashboardTime(current: number, previous: number): DashboardTrend {
    return calculateTrend(current, previous);
}

/** Financial comparisons require one shared currency and successful conversions in both periods. */
export function buildDashboardComparison(current: Pick<DashboardReport, 'time' | 'unbilled' | 'received' | 'spent'>, previous: Pick<DashboardReport, 'time' | 'unbilled' | 'received' | 'spent'>) {
    const moneyTrend = (now: DashboardMoney, before: DashboardMoney) => {
        const currencies = new Set([...Object.keys(now.amounts), ...Object.keys(before.amounts)]);
        if (now.hadConversionError || before.hadConversionError || currencies.size > 1) return calculateTrend(null, null);
        const total = (money: DashboardMoney) => Math.round(Object.values(money.amounts).reduce((sum, value) => sum + value, 0) * 100) / 100;
        return calculateTrend(total(now), total(before));
    };
    return { time: compareDashboardTime(current.time, previous.time), unbilled: moneyTrend(current.unbilled, previous.unbilled), received: moneyTrend(current.received, previous.received), spent: moneyTrend(current.spent, previous.spent) };
}

/** Offer named months back through known history, with one year available initially. */
export function buildDashboardPeriodOptions(todayStr: string, availableYears: number[] = []) {
    const today = parseStoredDate(todayStr) || new Date();
    const oldestYear = Math.min(today.getFullYear(), ...availableYears.filter(year => Number.isInteger(year) && year >= 1970 && year <= today.getFullYear()));
    const months = Math.max(12, (today.getFullYear() - oldestYear) * 12 + today.getMonth() + 1);
    return [
        { value: 'this-month', label: 'This Month' },
        { value: 'last-month', label: 'Last Month' },
        { value: 'last-90-days', label: 'Last 90 Days' },
        ...Array.from({ length: months - 2 }, (_, index) => {
            const month = subMonths(today, index + 2);
            return { value: format(month, 'yyyy-MM'), label: format(month, 'MMMM yyyy') };
        }),
    ];
}

const emptyMoney = (): DashboardMoney => ({ amounts: {}, hadConversionError: false });
const add = (money: DashboardMoney, currency: string, amount: number) => {
    if (Number.isFinite(amount)) money.amounts[currency] = (money.amounts[currency] || 0) + amount;
};

/** Failed conversions retain source amounts; currencies must never be added together. */
function addConverted(money: DashboardMoney, currency: string, amount: number, convert: Convert) {
    if (!Number.isFinite(amount) || amount === 0) return;
    const converted = convert({ [currency]: amount });
    if (converted.hadConversionError) {
        add(money, currency, amount);
        money.hadConversionError = true;
    } else {
        Object.entries(converted.amounts).forEach(([code, value]) => add(money, code, value));
    }
}

const dateInRange = (date: string | null | undefined, range: DashboardRange) => Boolean(date && date >= range.startDate && date <= range.endDate);
const entryDate = (entry: TimeEntry) => toStorageDate(new Date(entry.start));

/** Read-only dashboard projection; billing and persisted records stay authoritative. */
export function buildDashboardReport({ range, todayStr, preferredCurrency, convertToCurrency, tasks, projects, clients, entries, invoices, expenses }: {
    range: DashboardRange; todayStr: string; preferredCurrency: string; convertToCurrency: Convert;
    tasks: Task[]; projects: Project[]; clients: Client[]; entries: TimeEntry[];
    invoices: Invoice[]; expenses: Expense[];
}) {
    const taskMap = new Map(tasks.map(task => [task.id, task]));
    const projectMap = new Map(projects.map(project => [project.id, project]));
    const billableTaskIds = getBillableTaskIds(tasks, projects, clients);
    const days: DashboardDay[] = [];
    for (let day = parseStoredDate(range.startDate)!; toStorageDate(day)! <= range.endDate; day = addDays(day, 1)) {
        days.push({ date: toStorageDate(day)!, billable: 0, nonBillable: 0, total: 0 });
    }
    const dayMap = new Map(days.map(day => [day.date, day]));
    const validEntries = entries.filter(entry => !(entry as TimeEntry & { deletedAt?: number }).deletedAt && entry.source !== 'invoice-adjustment' && getActualDurationMs(entry) > 0);
    validEntries.forEach(entry => {
        const day = dayMap.get(entryDate(entry) || '');
        if (!day) return;
        const duration = getActualDurationMs(entry);
        // Retained flags on standalone/personal tasks never make their hours billable.
        if (billableTaskIds.has(entry.taskId)) day.billable += duration;
        else day.nonBillable += duration;
        day.total += duration;
    });

    // Legacy invoices may merge tasks that now have different client relationships.
    // Match their complete source evidence before filtering current billability.
    const eligible = getInvoiceEligibleTimeEntries({ tasks, timeEntries: validEntries, invoices, billingPeriodStart: range.startDate, billingPeriodEnd: range.endDate })
        .filter(entry => billableTaskIds.has(entry.taskId));
    const taskDurations = new Map<string, number>();
    eligible.forEach(entry => taskDurations.set(entry.taskId, (taskDurations.get(entry.taskId) || 0) + getBillableDurationMs(entry)));
    const unbilled = emptyMoney();
    let unbilledTime = 0;
    let unpricedTime = 0;
    taskDurations.forEach((duration, taskId) => {
        const project = projectMap.get(taskMap.get(taskId)?.projectId || '');
        const hours = Math.round(duration / HOUR * 100) / 100;
        unbilledTime += duration;
        if (!project || !project.hourlyRate || project.hourlyRate < 0) {
            unpricedTime += duration;
            return;
        }
        addConverted(unbilled, getProjectCurrency(project, clients, preferredCurrency), Math.round(hours * project.hourlyRate * 100) / 100, convertToCurrency);
    });

    const received = emptyMoney();
    const unpaid = emptyMoney();
    let unpaidCount = 0;
    let overdueCount = 0;
    const referenceDate = parseStoredDate(todayStr)!;
    invoices.forEach(invoice => {
        const status = getInvoiceStatus(invoice, referenceDate);
        if (status === 'paid') {
            const paidAt = getInvoicePaidAtTimestamp(invoice);
            if (paidAt === null || !dateInRange(toStorageDate(new Date(paidAt)), range)) return;
            const resolved = getPaidInvoiceConvertedAmount(invoice, preferredCurrency);
            if (resolved.success || resolved.usedSnapshot) {
                add(received, resolved.currency, resolved.amount);
                received.hadConversionError ||= !resolved.success;
            } else addConverted(received, resolved.currency, resolved.amount, convertToCurrency);
        } else if (status === 'sent' || status === 'overdue') {
            unpaidCount++;
            if (status === 'overdue') overdueCount++;
            addConverted(unpaid, invoice.currency || preferredCurrency, getInvoiceTotal(invoice), convertToCurrency);
        }
    });

    const spent = emptyMoney();
    expenses.forEach(expense => {
        if (!dateInRange(expense.date, range)) return;
        if (expense.paymentStatus === 'paid' && expense.date <= todayStr) {
            const resolved = getPaidExpenseConvertedAmount(expense, preferredCurrency);
            if (resolved.success || resolved.usedSnapshot) {
                add(spent, resolved.currency, resolved.amount);
                spent.hadConversionError ||= !resolved.success;
            } else addConverted(spent, resolved.currency, resolved.amount, convertToCurrency);
        }
    });
    return { days, time: days.reduce((sum, day) => sum + day.total, 0), billableTime: days.reduce((sum, day) => sum + day.billable, 0), unbilled, unbilledTime, unpricedTime, received, spent, unpaid, unpaidCount, overdueCount };
}

export type DashboardReport = ReturnType<typeof buildDashboardReport>;
