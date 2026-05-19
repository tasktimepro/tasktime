import { endOfMonth } from 'date-fns';
import { parseStoredDate, toStorageDate } from './dateUtils';
import { generateRecurringExpenseId } from './idUtils';
import { convertCurrency, normalizeCurrencyCode } from './currencyUtils';
import type { Expense, ExpensePaymentCurrencySnapshot, ExpenseRecurrence } from '@/stores/yjs/types';

const getFiniteNumber = (value: unknown, fallback: number): number => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getFiniteRecord = (value: unknown): Record<string, number> | undefined => {
    if (!value || typeof value !== 'object') {
        return undefined;
    }

    const entries = Object.entries(value).filter(([, rate]) => typeof rate === 'number' && Number.isFinite(rate));

    if (entries.length === 0) {
        return undefined;
    }

    return Object.fromEntries(entries);
};

const resolveExpensePaymentSnapshotCapturedAt = (expense: any): number => {
    const paidOnDate = parseStoredDate(typeof expense?.paidOn === 'string' ? expense.paidOn : null);
    if (paidOnDate) {
        return paidOnDate.getTime();
    }

    const expenseDate = parseStoredDate(typeof expense?.date === 'string' ? expense.date : null);
    if (expenseDate) {
        return expenseDate.getTime();
    }

    if (typeof expense?.updatedAt === 'number' && Number.isFinite(expense.updatedAt)) {
        return expense.updatedAt;
    }

    if (typeof expense?.createdAt === 'number' && Number.isFinite(expense.createdAt)) {
        return expense.createdAt;
    }

    return Date.now();
};

const normalizeExpensePaymentCurrencySnapshot = (expense: any): ExpensePaymentCurrencySnapshot | null => {
    const snapshot = expense?.paymentCurrencySnapshot;
    if (!snapshot || typeof snapshot !== 'object') {
        return null;
    }

    const capturedAt = getFiniteNumber(snapshot.capturedAt, 0);
    const sourceAmount = getFiniteNumber(snapshot.sourceAmount, Number.NaN);
    const preferredCurrencyAmount = getFiniteNumber(snapshot.preferredCurrencyAmount, Number.NaN);

    if (!capturedAt || !Number.isFinite(sourceAmount) || !Number.isFinite(preferredCurrencyAmount)) {
        return null;
    }

    return {
        capturedAt,
        sourceCurrency: normalizeCurrencyCode(snapshot.sourceCurrency || expense?.currency),
        sourceAmount,
        preferredCurrencyAtPayment: normalizeCurrencyCode(snapshot.preferredCurrencyAtPayment),
        preferredCurrencyAmount,
    };
};

export const createExpensePaymentCurrencySnapshot = ({
    expense,
    preferredCurrency,
    exchangeRates,
    capturedAt,
}: {
    expense: any;
    preferredCurrency: string;
    exchangeRates?: Record<string, number> | null;
    capturedAt?: number;
}): ExpensePaymentCurrencySnapshot | null => {
    const sourceCurrency = normalizeCurrencyCode(expense?.currency);
    const targetCurrency = normalizeCurrencyCode(preferredCurrency);
    const sourceAmount = getFiniteNumber(expense?.amount, 0);

    if (sourceCurrency === targetCurrency) {
        return null;
    }

    const normalizedRates = getFiniteRecord(exchangeRates);

    let preferredCurrencyAmount = sourceAmount;
    const result = convertCurrency(sourceAmount, sourceCurrency, targetCurrency, normalizedRates);
    preferredCurrencyAmount = result.amount;

    return {
        capturedAt: capturedAt ?? resolveExpensePaymentSnapshotCapturedAt(expense),
        sourceCurrency,
        sourceAmount,
        preferredCurrencyAtPayment: targetCurrency,
        preferredCurrencyAmount,
    };
};

export const getExpensePaymentCurrencySnapshot = (expense: any): ExpensePaymentCurrencySnapshot | null => {
    return normalizeExpensePaymentCurrencySnapshot(expense);
};

export const getPaidExpenseConvertedAmount = (
    expense: any,
    targetCurrency: string
): { amount: number; currency: string; success: boolean; usedSnapshot: boolean } => {
    const normalizedTargetCurrency = normalizeCurrencyCode(targetCurrency);
    const snapshot = getExpensePaymentCurrencySnapshot(expense);

    if (!snapshot) {
        const expenseCurrency = normalizeCurrencyCode(expense?.currency);
        return {
            amount: getFiniteNumber(expense?.amount, 0),
            currency: expenseCurrency,
            success: expenseCurrency === normalizedTargetCurrency,
            usedSnapshot: false,
        };
    }

    if (normalizedTargetCurrency === snapshot.preferredCurrencyAtPayment) {
        return {
            amount: snapshot.preferredCurrencyAmount,
            currency: normalizedTargetCurrency,
            success: true,
            usedSnapshot: true,
        };
    }

    if (normalizedTargetCurrency === snapshot.sourceCurrency) {
        return {
            amount: snapshot.sourceAmount,
            currency: normalizedTargetCurrency,
            success: true,
            usedSnapshot: true,
        };
    }

    return {
        amount: snapshot.sourceAmount,
        currency: snapshot.sourceCurrency,
        success: false,
        usedSnapshot: true,
    };
};

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
        id: generateRecurringExpenseId(recurrence.id, resolvedDate),
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
        amountExcludingTax: recurrence.amountExcludingTax ?? null,
        taxLabel: recurrence.taxLabel ?? null,
        taxRate: recurrence.taxRate ?? null,
        paymentCurrencySnapshot: null,
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
