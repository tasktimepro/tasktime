import { endOfMonth } from 'date-fns';
import { parseStoredDate, toStorageDate } from './dateUtils';
import type { Expense, ExpenseRecurrence } from '@/stores/yjs/types';

type RepeatInterval = 'monthly' | 'yearly';

type GetPendingPeriodsParams = {
    startDate: string;
    lastGeneratedDate?: string | null;
    endDate?: string | null;
    repeat: RepeatInterval;
    monthlyType?: 'first' | 'last' | 'specific';
    monthlyDay?: number;
    maxPeriods?: number;
    today?: string;
};

type GetNextRecurringDateParams = {
    startDate: string;
    repeat: RepeatInterval;
    monthlyType?: 'first' | 'last' | 'specific';
    monthlyDay?: number;
    endDate?: string | null;
    fromDate?: string;
    maxIterations?: number;
};

const compareStoredDates = (left: string, right: string): number => {
    const leftDate = parseStoredDate(left);
    const rightDate = parseStoredDate(right);
    if (!leftDate || !rightDate) return 0;
    return leftDate.getTime() - rightDate.getTime();
};

/**
 * Advance a YYYY-MM-DD date string by the given repeat interval.
 * @param {string} dateValue
 * @param {RepeatInterval} repeat
 * @returns {string}
 */
export const advanceByRepeat = (
    dateValue: string,
    repeat: RepeatInterval,
    monthlyType?: 'first' | 'last' | 'specific',
    monthlyDay?: number
): string => {
    const baseDate = parseStoredDate(dateValue);
    if (!baseDate) return dateValue;

    const day = baseDate.getDate();

    if (repeat === 'monthly') {
        const nextMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
        const monthEnd = endOfMonth(nextMonthDate);

        if (monthlyType === 'first') {
            return toStorageDate(new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1)) || dateValue;
        }

        if (monthlyType === 'last') {
            return toStorageDate(new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), monthEnd.getDate())) || dateValue;
        }

        const resolvedDay = monthlyDay || day;
        const clampedDay = Math.min(resolvedDay, monthEnd.getDate());
        return toStorageDate(new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), clampedDay)) || dateValue;
    }

    const nextYearDate = new Date(baseDate.getFullYear() + 1, baseDate.getMonth(), 1);
    const yearEnd = endOfMonth(nextYearDate);
    const clampedDay = Math.min(day, yearEnd.getDate());
    return toStorageDate(new Date(nextYearDate.getFullYear(), nextYearDate.getMonth(), clampedDay)) || dateValue;
};

/**
 * Build a list of pending recurrence dates between the last generated date and today.
 * @param {GetPendingPeriodsParams} params
 * @returns {string[]}
 */
export const getPendingPeriods = ({
    startDate,
    lastGeneratedDate,
    endDate,
    repeat,
    monthlyType,
    monthlyDay,
    maxPeriods = 24,
    today,
}: GetPendingPeriodsParams): string[] => {
    const todayValue = today || toStorageDate(new Date()) || '';
    if (!todayValue) return [];

    const pending: string[] = [];
    let nextDate = lastGeneratedDate
        ? advanceByRepeat(lastGeneratedDate, repeat, monthlyType, monthlyDay)
        : startDate;

    const endLimit = endDate || null;

    while (pending.length < maxPeriods) {
        const nextParsed = parseStoredDate(nextDate);
        if (!nextParsed) break;

        const todayParsed = parseStoredDate(todayValue);
        if (!todayParsed) break;

        if (nextParsed > todayParsed) break;

        if (endLimit) {
            const endParsed = parseStoredDate(endLimit);
            if (endParsed && nextParsed > endParsed) break;
        }

        pending.push(nextDate);
        nextDate = advanceByRepeat(nextDate, repeat, monthlyType, monthlyDay);
    }

    return pending;
};

/**
 * Build an expense instance from a recurrence template.
 * @param {ExpenseRecurrence} recurrence
 * @param {string} dateValue
 * @returns {Expense}
 */
export const buildExpenseFromRecurrence = (recurrence: ExpenseRecurrence, dateValue: string): Expense => {
    const resolvedDate = dateValue || recurrence.startDate;
    const paymentMode = recurrence.paymentMode || 'manual';
    const isVariable = recurrence.amountType === 'variable';
    const isAutoPayment = paymentMode === 'auto' && !isVariable;
    const resolvedAmount = isVariable ? (recurrence.amount || 0) : recurrence.amount;

    return {
        id: '',
        title: recurrence.title,
        note: recurrence.note ?? null,
        date: resolvedDate,
        supplierName: recurrence.supplierName ?? null,
        receiptNumber: null,
        currency: recurrence.currency,
        amount: resolvedAmount,
        paidOn: isAutoPayment ? resolvedDate : null,
        paidBy: recurrence.paidBy ?? null,
        paymentStatus: isAutoPayment ? 'paid' : 'unpaid',
        paymentMode,
        clientId: recurrence.clientId ?? null,
        projectId: recurrence.projectId ?? null,
        businessId: recurrence.businessId ?? null,
        isPersonal: recurrence.isPersonal,
        billable: recurrence.billable,
        billingStatus: 'unbilled',
        invoiceId: null,
        billedAt: null,
        isRecurring: true,
        recurrenceId: recurrence.id,
        amountType: recurrence.amountType,
        taxNumber: recurrence.taxNumber ?? null,
        isTaxExempt: recurrence.isTaxExempt,
    };
};

/**
 * Check if an expense falls within the provided inclusive date range.
 * @param {Expense} expense
 * @param {string} startDate
 * @param {string} endDate
 * @returns {boolean}
 */
export const isExpenseInDateRange = (expense: Expense, startDate: string, endDate: string): boolean => {
    const expenseDate = parseStoredDate(expense.date);
    const start = parseStoredDate(startDate);
    const end = parseStoredDate(endDate);

    if (!expenseDate || !start || !end) return false;

    return expenseDate >= start && expenseDate <= end;
};

/**
 * Get the next recurrence date on or after the provided fromDate.
 * @param {GetNextRecurringDateParams} params
 * @returns {string | null}
 */
export const getNextRecurringDate = ({
    startDate,
    repeat,
    monthlyType,
    monthlyDay,
    endDate,
    fromDate,
    maxIterations = 240,
}: GetNextRecurringDateParams): string | null => {
    if (!startDate) return null;

    const baseline = fromDate || startDate;
    let nextDate = startDate;
    let iterations = 0;

    while (compareStoredDates(nextDate, baseline) < 0 && iterations < maxIterations) {
        nextDate = advanceByRepeat(nextDate, repeat, monthlyType, monthlyDay);
        iterations += 1;
    }

    if (endDate && compareStoredDates(nextDate, endDate) > 0) {
        return null;
    }

    return nextDate;
};

/**
 * Check if a recurrence is due on a specific date.
 * @param {ExpenseRecurrence} recurrence
 * @param {string} dateStr
 * @returns {boolean}
 */
export const isRecurringExpenseDueOnDate = (recurrence: ExpenseRecurrence, dateStr: string): boolean => {
    if (!recurrence?.startDate) return false;

    if (compareStoredDates(dateStr, recurrence.startDate) < 0) {
        return false;
    }

    if (recurrence.endDate && compareStoredDates(dateStr, recurrence.endDate) > 0) {
        return false;
    }

    const nextDate = getNextRecurringDate({
        startDate: recurrence.startDate,
        repeat: recurrence.repeat,
        monthlyType: recurrence.monthlyType,
        monthlyDay: recurrence.monthlyDay,
        endDate: recurrence.endDate,
        fromDate: dateStr,
    });

    return nextDate === dateStr;
};
