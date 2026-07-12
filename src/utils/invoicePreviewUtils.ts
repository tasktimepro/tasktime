import type { Client, Expense, Invoice, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { getInvoiceEligibleTimeEntries } from '@/domain/invoices/invoiceEligibility';
import { getBillingPeriodRange, isStoredDateWithinBillingRange } from './billingPeriodUtils';
import { convertCurrency, getProjectCurrency, normalizeCurrencyCode } from './currencyUtils';
import { millisecondsToHours } from './dateUtils';
import { getClientHourlyRate } from './projectPlanningUtils';
import { getBillableDurationMs } from './timeEntryDurationUtils';

type InvoicePreviewOptions = {
    clients?: Client[];
    tasks?: Task[];
    timeEntries?: TimeEntry[];
    invoices?: Invoice[];
    expenses?: Expense[];
    exchangeRates?: Record<string, number> | null;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
    includeClientLevelExpenses?: boolean;
    preferredCurrency?: string;
};

export type ProjectInvoicePreview = {
    currency: string;
    total: number;
    taskAmount: number;
    expenseAmount: number;
    unbilledHours: number;
    unpricedHours: number;
    selectedExpenseCount: number;
    excludedExpenseCount: number;
    entrySelections: ProjectInvoiceEntrySelection[];
    taskSelections: ProjectInvoiceTaskSelection[];
    expenseSelections: ProjectInvoiceExpenseSelection[];
};

export type ProjectInvoiceEntrySelection = {
    entryId: string;
    taskId: string;
    start: number;
    end: number;
    actualDurationMs: number;
    billableDurationMs: number;
};

export type ProjectInvoiceTaskSelection = {
    taskId: string;
    title: string;
    pricingMode: 'hourly' | 'flat';
    quantity: number;
    rate: number;
    amount: number;
    quotedAmount: number | null;
};

export type ProjectInvoiceExpenseSelection = {
    expenseId: string;
    title: string;
    sourceAmount: number;
    sourceCurrency: string;
    invoiceAmount: number;
    invoiceCurrency: string;
    exchangeRate: number;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const normalizeFiniteNumber = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }

    return value;
};

const isSameCurrencyAmount = (left: number, right: number): boolean => {
    return Math.abs(left - right) < 0.005;
};

const isClaimedCurrentQuotedAmount = (task: Task, currentQuotedAmount: number): boolean => {
    const billedQuotedAmount = normalizeFiniteNumber(task.quotedAmountBilling?.total);

    return Boolean(task.quotedAmountBilling?.invoiceId)
        && billedQuotedAmount !== null
        && isSameCurrencyAmount(currentQuotedAmount, billedQuotedAmount);
};

const getProjectClient = (project: Project, clients: Client[] = []): Client | null => {
    if (!project.preferredClientId) {
        return null;
    }

    return clients.find((client) => client.id === project.preferredClientId) || null;
};

const getInvoiceExpenseAmount = (
    expense: Expense,
    targetCurrency: string,
    exchangeRates?: Record<string, number> | null
): { amount: number; included: boolean } => {
    const originalAmount = normalizeFiniteNumber(expense.amount) ?? 0;
    const originalCurrency = normalizeCurrencyCode(expense.currency || targetCurrency);
    const normalizedTargetCurrency = normalizeCurrencyCode(targetCurrency);

    if (originalCurrency === normalizedTargetCurrency) {
        return { amount: originalAmount, included: true };
    }

    const conversion = convertCurrency(originalAmount, originalCurrency, normalizedTargetCurrency, exchangeRates);

    if (!conversion.success) {
        return { amount: 0, included: false };
    }

    return { amount: conversion.amount, included: true };
};

/**
 * Calculates the same default project-context invoice preview total used by the
 * invoice modal before user edits, including selected billable expenses.
 */
export const getProjectInvoicePreview = (
    project: Project,
    {
        clients = [],
        tasks = [],
        timeEntries = [],
        invoices = [],
        expenses = [],
        exchangeRates = null,
        billingPeriodStart,
        billingPeriodEnd,
        includeClientLevelExpenses = false,
        preferredCurrency,
    }: InvoicePreviewOptions = {}
): ProjectInvoicePreview => {
    const defaultBillingPeriod = getBillingPeriodRange();
    const activeBillingPeriodStart = billingPeriodStart ?? defaultBillingPeriod.startDate;
    const activeBillingPeriodEnd = billingPeriodEnd ?? defaultBillingPeriod.endDate;
    const projectCurrency = getProjectCurrency(project, clients, preferredCurrency);
    const projectClient = getProjectClient(project, clients);
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectTaskMap = new Map(projectTasks.map((task) => [task.id, task]));
    const taskTimeMap = new Map<string, number>();
    const entrySelections: ProjectInvoiceEntrySelection[] = [];

    const eligibleTimeEntries = getInvoiceEligibleTimeEntries({
        tasks: projectTasks,
        timeEntries,
        invoices,
        billingPeriodStart: activeBillingPeriodStart,
        billingPeriodEnd: activeBillingPeriodEnd,
    });

    eligibleTimeEntries.forEach((entry) => {
        const task = projectTaskMap.get(entry.taskId);

        if (!task) return;

        const billableDurationMs = getBillableDurationMs(entry);
        taskTimeMap.set(task.id, (taskTimeMap.get(task.id) || 0) + billableDurationMs);
        entrySelections.push({
            entryId: entry.id,
            taskId: entry.taskId,
            start: entry.start,
            end: entry.end,
            actualDurationMs: entry.end - entry.start,
            billableDurationMs,
        });
    });

    let taskAmount = 0;
    let unbilledHours = 0;
    let unpricedHours = 0;
    const taskSelections: ProjectInvoiceTaskSelection[] = [];
    const effectiveHourlyRate = normalizeFiniteNumber(project.hourlyRate) ?? getClientHourlyRate(projectClient);

    projectTasks
        .filter((task) => task.billable === true)
        .forEach((task) => {
            const taskHours = roundCurrency(millisecondsToHours(taskTimeMap.get(task.id) || 0));

            unbilledHours += taskHours;

            if (project.flatRate) {
                const quotedAmount = normalizeFiniteNumber(task.estimatedFlatAmount) ?? 0;

                if (quotedAmount > 0 && isClaimedCurrentQuotedAmount(task, quotedAmount)) {
                    return;
                }

                taskAmount += quotedAmount;
                if (quotedAmount > 0) {
                    taskSelections.push({
                        taskId: task.id,
                        title: task.title,
                        pricingMode: 'flat',
                        quantity: 1,
                        rate: quotedAmount,
                        amount: quotedAmount,
                        quotedAmount,
                    });
                }
                return;
            }

            if (effectiveHourlyRate > 0) {
                const amount = roundCurrency(taskHours * effectiveHourlyRate);
                taskAmount += amount;
                if (taskHours > 0) {
                    taskSelections.push({
                        taskId: task.id,
                        title: task.title,
                        pricingMode: 'hourly',
                        quantity: taskHours,
                        rate: effectiveHourlyRate,
                        amount,
                        quotedAmount: null,
                    });
                }
            } else {
                unpricedHours += taskHours;
            }
        });

    let expenseAmount = 0;
    let selectedExpenseCount = 0;
    let excludedExpenseCount = 0;
    const expenseSelections: ProjectInvoiceExpenseSelection[] = [];

    expenses
        .filter((expense) => {
            if (!expense || expense.billable !== true || expense.billingStatus !== 'unbilled') return false;
            if (!isStoredDateWithinBillingRange(expense.date, activeBillingPeriodStart, activeBillingPeriodEnd)) return false;

            if (expense.projectId) {
                return expense.projectId === project.id;
            }

            return Boolean(includeClientLevelExpenses && projectClient?.id && expense.clientId === projectClient.id);
        })
        .forEach((expense) => {
            const converted = getInvoiceExpenseAmount(expense, projectCurrency, exchangeRates);

            if (!converted.included) {
                excludedExpenseCount += 1;
                return;
            }

            selectedExpenseCount += 1;
            expenseAmount += converted.amount;
            const sourceAmount = normalizeFiniteNumber(expense.amount) ?? 0;
            const sourceCurrency = normalizeCurrencyCode(expense.currency || projectCurrency);
            expenseSelections.push({
                expenseId: expense.id,
                title: expense.title,
                sourceAmount,
                sourceCurrency,
                invoiceAmount: converted.amount,
                invoiceCurrency: projectCurrency,
                exchangeRate: sourceAmount === 0 ? 1 : converted.amount / sourceAmount,
            });
        });

    const roundedTaskAmount = roundCurrency(taskAmount);
    const roundedExpenseAmount = roundCurrency(expenseAmount);

    return {
        currency: projectCurrency,
        total: roundCurrency(roundedTaskAmount + roundedExpenseAmount),
        taskAmount: roundedTaskAmount,
        expenseAmount: roundedExpenseAmount,
        unbilledHours: roundCurrency(unbilledHours),
        unpricedHours: roundCurrency(unpricedHours),
        selectedExpenseCount,
        excludedExpenseCount,
        entrySelections,
        taskSelections,
        expenseSelections,
    };
};
