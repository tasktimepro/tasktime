import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { STALE_EXCHANGE_RATES_ERROR } from '../utils/currencyUtils';

const {
    mockShowWarning,
    mockShowSuccess,
    mockUseCurrencyConversion,
    mockUseTasks,
} = vi.hoisted(() => ({
    mockShowWarning: vi.fn(),
    mockShowSuccess: vi.fn(),
    mockUseCurrencyConversion: vi.fn(),
    mockUseTasks: vi.fn(() => ({
        activeTasks: [],
        archivedTasks: [],
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        archiveTask: vi.fn(),
        getOverdueTasks: vi.fn(() => []),
        getTasksForToday: vi.fn(() => []),
        getUpcomingTasks: vi.fn(() => []),
        toggleRecurringCompletion: vi.fn(),
        isCompletedOnDate: vi.fn(() => false),
        resetExpiredSkips: vi.fn(),
        isLoading: false,
        archivedLoading: false,
        archivedLoaded: true,
        getRecurringStatus: vi.fn(() => ({
            effectiveDateStr: null,
            isDueToday: false,
            isOverdue: false,
            lastDueDateStr: null,
        })),
    })),
}));

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
        showWarning: mockShowWarning,
        showSuccess: mockShowSuccess,
    }),
}));

vi.mock('../hooks/useTasks', () => ({
    useTasks: (...args) => mockUseTasks(...args),
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
    default: (...args) => mockUseCurrencyConversion(...args),
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
    default: ({ taskFilter }) => <div data-testid="recent-tasks">Recent tasks {taskFilter}</div>,
}));

vi.mock('./dashboard/ProjectsOverview', () => ({
    default: ({ projectFilter }) => <div data-testid="projects-overview">Projects overview {projectFilter}</div>,
}));

vi.mock('./dashboard/MetricsCards', () => ({
    default: () => <div data-testid="metrics-cards">Metrics cards</div>,
}));

vi.mock('@/components/modals/AddTimeEntryModal', () => ({
    default: () => null,
}));

describe('Dashboard', () => {
    beforeEach(() => {
        const storage = new Map();

        localStorage.getItem.mockImplementation((key) => {
            return storage.has(key) ? storage.get(key) : null;
        });
        localStorage.setItem.mockImplementation((key, value) => {
            storage.set(key, value);
        });
        localStorage.removeItem.mockImplementation((key) => {
            storage.delete(key);
        });
        localStorage.clear.mockImplementation(() => {
            storage.clear();
        });
        localStorage.clear();
        window.matchMedia = createMatchMedia();
        mockShowWarning.mockReset();
        mockShowSuccess.mockReset();
        mockUseTasks.mockClear();
        mockUseCurrencyConversion.mockReturnValue({
            preferredCurrency: 'USD',
            exchangeRates: null,
            exchangeRatesLoading: false,
            exchangeRatesError: null,
            needsExchangeRates: false,
            missingExchangeRates: [],
            convertToCurrency: (amounts) => ({ amounts }),
        });
    });

    const renderDashboard = () => render(
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

    it('renders reports overview before recent sections on mobile', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        });

        renderDashboard();

        const todo = screen.getByTestId('todo-today');
        const metrics = screen.getByTestId('metrics-cards');
        const recent = screen.getByTestId('recent-tasks');

        expect(todo.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(metrics.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('keeps reports overview after recent sections on desktop', () => {
        renderDashboard();

        const recent = screen.getByTestId('recent-tasks');
        const metrics = screen.getByTestId('metrics-cards');

        expect(recent.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('passes the default dashboard filters to the overview cards', () => {
        renderDashboard();

        expect(screen.getByTestId('recent-tasks').textContent).toContain('recent');
        expect(screen.getByTestId('projects-overview').textContent).toContain('recent');
    });

    it('preloads archived tasks for the dashboard filters', () => {
        renderDashboard();

        expect(mockUseTasks).toHaveBeenCalledWith({ includeArchived: true });
    });

    it('shows the stale exchange rates warning once per day', () => {
        mockUseCurrencyConversion.mockReturnValue({
            preferredCurrency: 'USD',
            exchangeRates: { EUR: 0.9 },
            exchangeRatesLoading: false,
            exchangeRatesError: STALE_EXCHANGE_RATES_ERROR,
            needsExchangeRates: true,
            missingExchangeRates: [],
            convertToCurrency: (amounts) => ({ amounts, hadConversionError: false }),
        });

        const firstRender = renderDashboard();

        expect(mockShowWarning).toHaveBeenCalledTimes(1);
        expect(mockShowWarning).toHaveBeenCalledWith(STALE_EXCHANGE_RATES_ERROR);

        firstRender.unmount();

        renderDashboard();

        expect(mockShowWarning).toHaveBeenCalledTimes(1);
    });

    it('shows the stale exchange rates warning again on a later day', () => {
        localStorage.setItem('tasktime-stale-exchange-rates-warning-date', '2026-03-23');
        mockUseCurrencyConversion.mockReturnValue({
            preferredCurrency: 'USD',
            exchangeRates: { EUR: 0.9 },
            exchangeRatesLoading: false,
            exchangeRatesError: STALE_EXCHANGE_RATES_ERROR,
            needsExchangeRates: true,
            missingExchangeRates: [],
            convertToCurrency: (amounts) => ({ amounts, hadConversionError: false }),
        });

        renderDashboard();

        expect(mockShowWarning).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('tasktime-stale-exchange-rates-warning-date')).toBe('2026-03-24');
    });
});