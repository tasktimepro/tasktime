/**
 * useExpenseMetrics - Derived metrics for expenses within a date range
 */

import { useMemo } from 'react';
import { parseStoredDate } from '@/utils/dateUtils';
import type { Expense } from '@/stores/yjs/types';

export interface UseExpenseMetricsParams {
    expenses: Expense[];
    startDate: Date;
    endDate: Date;
    clientId?: string;
    projectId?: string;
}

export function useExpenseMetrics({
    expenses,
    startDate,
    endDate,
    clientId,
    projectId,
}: UseExpenseMetricsParams) {
    return useMemo(() => {
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();

        const scoped = expenses.filter((expense) => {
            if (clientId && expense.clientId !== clientId) return false;
            if (projectId && expense.projectId !== projectId) return false;

            const date = parseStoredDate(expense.date);
            if (!date) return false;
            const time = date.getTime();
            return time >= startTime && time <= endTime;
        });

        const totalExpenses = scoped.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const paidTotal = scoped
            .filter((expense) => expense.paymentStatus === 'paid')
            .reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const unpaidTotal = scoped
            .filter((expense) => expense.paymentStatus === 'unpaid')
            .reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const billableUnbilledTotal = scoped
            .filter((expense) => expense.billable && expense.billingStatus === 'unbilled')
            .reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const personalTotal = scoped
            .filter((expense) => expense.isPersonal)
            .reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const clientTotal = scoped
            .filter((expense) => !expense.isPersonal)
            .reduce((sum, expense) => sum + (expense.amount || 0), 0);

        const periodMs = endTime - startTime;
        const previousStart = new Date(startTime - periodMs - 1);
        const previousEnd = new Date(endTime - periodMs - 1);

        const previousTotal = expenses.filter((expense) => {
            if (clientId && expense.clientId !== clientId) return false;
            if (projectId && expense.projectId !== projectId) return false;

            const date = parseStoredDate(expense.date);
            if (!date) return false;
            const time = date.getTime();
            return time >= previousStart.getTime() && time <= previousEnd.getTime();
        }).reduce((sum, expense) => sum + (expense.amount || 0), 0);

        const monthOverMonthDelta = previousTotal === 0
            ? 0
            : ((totalExpenses - previousTotal) / previousTotal) * 100;

        return {
            totalExpenses,
            paidTotal,
            unpaidTotal,
            billableUnbilledTotal,
            personalTotal,
            clientTotal,
            count: scoped.length,
            monthOverMonthDelta,
        };
    }, [expenses, startDate, endDate, clientId, projectId]);
}
