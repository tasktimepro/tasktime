import { describe, expect, it } from 'vitest';
import {
    getProjectBudgetProgress,
    getProjectDeadlineStatus,
    getProjectEstimateSummary,
    getProjectStatusMode,
    getTaskEstimateAmount,
    isProjectInQuoteMode,
} from './projectPlanningUtils';

describe('projectPlanningUtils', () => {
    it('defaults missing or personal project status mode to active', () => {
        expect(getProjectStatusMode()).toBe('active');
        expect(getProjectStatusMode({ statusMode: 'quote', isPersonal: true })).toBe('active');
        expect(isProjectInQuoteMode({ statusMode: 'quote', isPersonal: true })).toBe(false);
        expect(isProjectInQuoteMode({ statusMode: 'quote', isPersonal: false })).toBe(true);
    });

    it('uses project or client hourly rate for hourly task estimates', () => {
        expect(getTaskEstimateAmount(
            { estimatedHours: 3 },
            { flatRate: false, hourlyRate: 125 },
            { defaultHourlyRate: 90, hourlyRate: 80 }
        )).toBe(375);

        expect(getTaskEstimateAmount(
            { estimatedHours: 2.5 },
            { flatRate: false, hourlyRate: null },
            { defaultHourlyRate: 110, hourlyRate: 80 }
        )).toBe(275);
    });

    it('uses flat estimate amounts for flat-rate projects', () => {
        expect(getTaskEstimateAmount(
            { estimatedHours: 5, estimatedFlatAmount: 900 },
            { flatRate: true, hourlyRate: 125 },
            { defaultHourlyRate: 90, hourlyRate: 80 }
        )).toBe(900);
    });

    it('builds estimate summary with budget override and actual tracked hours', () => {
        const summary = getProjectEstimateSummary(
            {
                id: 'project-1',
                preferredClientId: 'client-1',
                flatRate: false,
                hourlyRate: 100,
                budgetAmount: 2000,
            },
            [
                { id: 'task-1', projectId: 'project-1', title: 'Discovery', estimatedHours: 4 },
                { id: 'task-2', projectId: 'project-1', title: 'Delivery', estimatedHours: 6 },
                { id: 'task-3', projectId: 'project-2', title: 'Ignored', estimatedHours: 9 },
            ],
            [
                { id: 'entry-1', taskId: 'task-1', start: 0, end: 2 * 60 * 60 * 1000 },
                { id: 'entry-2', taskId: 'task-2', start: 0, end: 30 * 60 * 1000 },
                { id: 'entry-3', taskId: 'task-3', start: 0, end: 8 * 60 * 60 * 1000 },
            ],
            [{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }],
            'EUR'
        );

        expect(summary).toEqual(expect.objectContaining({
            estimatedHours: 10,
            actualHours: 2.5,
            estimatedAmount: 1000,
            budgetAmount: 2000,
            effectiveTargetAmount: 2000,
            currency: 'USD',
            hasTaskEstimates: true,
            hasBudgetAmount: true,
        }));
    });

    it('uses estimated totals when no explicit budget is set', () => {
        const summary = getProjectEstimateSummary(
            {
                id: 'project-flat',
                preferredClientId: 'client-1',
                flatRate: true,
                hourlyRate: null,
                budgetAmount: null,
            },
            [
                { id: 'task-1', projectId: 'project-flat', title: 'Design', estimatedHours: 3, estimatedFlatAmount: 600 },
                { id: 'task-2', projectId: 'project-flat', title: 'Build', estimatedHours: 5, estimatedFlatAmount: 900 },
            ],
            [],
            [{ id: 'client-1', title: 'Acme', defaultCurrency: 'GBP' }],
            'EUR'
        );

        expect(summary.effectiveTargetAmount).toBe(1500);
        expect(summary.estimatedAmount).toBe(1500);
        expect(summary.currency).toBe('GBP');
    });

    it('builds budget progress from invoiced totals without changing target math', () => {
        const progress = getProjectBudgetProgress(
            {
                id: 'project-1',
                preferredClientId: 'client-1',
                flatRate: false,
                hourlyRate: 100,
                budgetAmount: 1500,
            },
            [{ id: 'task-1', projectId: 'project-1', title: 'Task', estimatedHours: 5 }],
            [],
            [
                { id: 'invoice-1', projectId: 'project-1', clientId: 'client-1', invoiceNumber: 'INV-1', date: '2026-05-01', status: 'sent', items: [], subtotal: 600, total: 600 },
                { id: 'invoice-2', projectId: 'project-2', clientId: 'client-1', invoiceNumber: 'INV-2', date: '2026-05-01', status: 'sent', items: [], subtotal: 400, total: 400 },
            ],
            [{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }],
            'EUR'
        );

        expect(progress).toEqual(expect.objectContaining({
            currency: 'USD',
            budgetAmount: 1500,
            effectiveTargetAmount: 1500,
            estimatedAmount: 500,
            invoicedAmount: 600,
            remainingAmount: 900,
            progressRatio: 0.4,
        }));
    });

    it('reports deadline states for missing, future, today, and overdue deadlines', () => {
        const referenceDate = new Date('2026-05-28T12:00:00Z');

        expect(getProjectDeadlineStatus({}, referenceDate)).toEqual({
            hasDeadline: false,
            deadline: null,
            isOverdue: false,
            isToday: false,
            isResolved: false,
            daysRemaining: null,
            resolvedAt: null,
        });

        expect(getProjectDeadlineStatus({ deadline: '2026-05-30' }, referenceDate)).toEqual({
            hasDeadline: true,
            deadline: '2026-05-30',
            isOverdue: false,
            isToday: false,
            isResolved: false,
            daysRemaining: 2,
            resolvedAt: null,
        });

        expect(getProjectDeadlineStatus({ deadline: '2026-05-28' }, referenceDate)).toEqual({
            hasDeadline: true,
            deadline: '2026-05-28',
            isOverdue: false,
            isToday: true,
            isResolved: false,
            daysRemaining: 0,
            resolvedAt: null,
        });

        expect(getProjectDeadlineStatus({ deadline: '2026-05-26' }, referenceDate)).toEqual({
            hasDeadline: true,
            deadline: '2026-05-26',
            isOverdue: true,
            isToday: false,
            isResolved: false,
            daysRemaining: -2,
            resolvedAt: null,
        });

        expect(getProjectDeadlineStatus({ deadline: '2026-05-26', deadlineResolvedAt: Date.UTC(2026, 4, 29) }, referenceDate)).toEqual({
            hasDeadline: true,
            deadline: '2026-05-26',
            isOverdue: false,
            isToday: false,
            isResolved: true,
            daysRemaining: null,
            resolvedAt: Date.UTC(2026, 4, 29),
        });
    });
});