import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

const createMatchMedia = (matchesByQuery = {}) => vi.fn().mockImplementation((query) => ({
    matches: Boolean(matchesByQuery[query]),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
    useToast: () => ({
        showWarning: vi.fn(),
        showSuccess: vi.fn(),
    }),
}));

vi.mock('../hooks/useTasks', () => ({
    useTasks: () => ({
        tasks: [],
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        archiveTask: vi.fn(),
        getOverdueTasks: vi.fn(() => []),
        getTasksForToday: vi.fn(() => []),
        getUpcomingTasks: vi.fn(() => []),
        toggleRecurringCompletion: vi.fn(),
        isCompletedOnDate: vi.fn(() => false),
        resetExpiredSkips: vi.fn(),
        getRecurringStatus: vi.fn(() => ({
            effectiveDateStr: null,
            isDueToday: false,
            isOverdue: false,
            lastDueDateStr: null,
        })),
    }),
}));

vi.mock('../hooks/useTimeEntries', () => ({
    useTimeEntries: () => ({
        entries: [],
        createEntry: vi.fn(),
        deleteEntry: vi.fn(),
    }),
}));

vi.mock('../hooks/useTimers', () => ({
    useTimers: () => ({
        timers: [],
        clearTimer: vi.fn(),
    }),
}));

vi.mock('../hooks/useExpenses', () => ({
    useExpenses: () => ({
        expenses: [],
    }),
}));

vi.mock('../hooks/useExpenseRecurrences', () => ({
    useExpenseRecurrences: () => ({
        recurrences: [],
    }),
}));

vi.mock('../hooks/usePreferences', () => ({
    usePreferences: () => ({
        preferences: { currency: 'USD' },
    }),
}));

vi.mock('@/hooks/usePlannerAttachments', () => ({
    usePlannerAttachments: () => ({
        getForDate: vi.fn(() => []),
    }),
}));

vi.mock('@/hooks/useDayRollover', () => ({
    useTodayString: () => '2026-03-24',
}));

vi.mock('./dashboard/hooks/useCurrencyConversion', () => ({
    default: () => ({
        preferredCurrency: 'USD',
        exchangeRates: null,
        exchangeRatesLoading: false,
        exchangeRatesError: null,
        needsExchangeRates: false,
        missingExchangeRates: [],
        convertToCurrency: (amounts) => ({ amounts }),
    }),
}));

vi.mock('./dashboard/hooks/useMetricsCalculation', () => ({
    default: () => ({
        thisMonthMetrics: { billableEarnings: {}, paidInvoices: {}, outstandingInvoices: {}, hadConversionError: false, time: 0 },
        lastMonthMetrics: { billableEarnings: {}, paidInvoices: {}, outstandingInvoices: {}, hadConversionError: false, time: 0 },
        last90DaysMetrics: { billableEarnings: {}, paidInvoices: {}, outstandingInvoices: {}, hadConversionError: false, time: 0 },
        invoiceMetrics: { outstanding: 0, outstandingTotal: 0, pastDue: 0, pastDueTotal: 0 },
        thisMonthBillableHours: 0,
        thisMonthUnbilledDisplay: '$0.00',
    }),
}));

vi.mock('./dashboard/ToDoToday', () => ({
    default: () => <div data-testid="todo-today">To do today</div>,
}));

vi.mock('./dashboard/RecentTasks', () => ({
    default: () => <div data-testid="recent-tasks">Recent tasks</div>,
}));

vi.mock('./dashboard/ProjectsOverview', () => ({
    default: () => <div data-testid="projects-overview">Projects overview</div>,
}));

vi.mock('./dashboard/MetricsCards', () => ({
    default: () => <div data-testid="metrics-cards">Metrics cards</div>,
}));

vi.mock('@/components/modals/AddTimeEntryModal', () => ({
    default: () => null,
}));

describe('Dashboard', () => {
    beforeEach(() => {
        window.matchMedia = createMatchMedia();
    });

    it('renders reports overview before recent sections on mobile', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        });

        render(
            <Dashboard
                projects={[]}
                invoices={[]}
                clients={[]}
                navigateToProject={vi.fn()}
                navigateToClient={vi.fn()}
                navigateToInvoices={vi.fn()}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
                openExpenseView={vi.fn()}
            />
        );

        const todo = screen.getByTestId('todo-today');
        const metrics = screen.getByTestId('metrics-cards');
        const recent = screen.getByTestId('recent-tasks');

        expect(todo.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(metrics.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('keeps reports overview after recent sections on desktop', () => {
        render(
            <Dashboard
                projects={[]}
                invoices={[]}
                clients={[]}
                navigateToProject={vi.fn()}
                navigateToClient={vi.fn()}
                navigateToInvoices={vi.fn()}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
                openExpenseView={vi.fn()}
            />
        );

        const recent = screen.getByTestId('recent-tasks');
        const metrics = screen.getByTestId('metrics-cards');

        expect(recent.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});