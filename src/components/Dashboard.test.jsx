import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { STALE_EXCHANGE_RATES_ERROR } from '../utils/currencyUtils';

const {
    mockShowWarning,
    mockShowSuccess,
    mockMetricsCards,
    mockUseCurrencyConversion,
    mockUseTasks,
    mockTimeEntries,
    mockExpenses,
    mockRecurrences,
    mockPreferences,
} = vi.hoisted(() => ({
    mockShowWarning: vi.fn(),
    mockShowSuccess: vi.fn(),
    mockMetricsCards: vi.fn(() => <div data-testid="metrics-cards">Metrics cards</div>),
    mockUseCurrencyConversion: vi.fn(),
    mockTimeEntries: [],
    mockExpenses: [],
    mockRecurrences: [],
    mockPreferences: { currency: 'USD' },
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
        entries: mockTimeEntries,
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
        expenses: mockExpenses,
    }),
}));

vi.mock('../hooks/useExpenseRecurrences', () => ({
    useExpenseRecurrences: () => ({
        recurrences: mockRecurrences,
    }),
}));

vi.mock('../hooks/usePreferences', () => ({
    usePreferences: () => ({
        preferences: mockPreferences,
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
    default: (...args) => mockMetricsCards(...args),
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
        mockMetricsCards.mockClear();
        mockUseTasks.mockClear();
        mockTimeEntries.length = 0;
        mockExpenses.length = 0;
        mockRecurrences.length = 0;
        Object.keys(mockPreferences).forEach((key) => {
            delete mockPreferences[key];
        });
        mockPreferences.currency = 'USD';
        mockPreferences.systemNotificationsEnabled = false;
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

    it('renders reports overview before deferred sections', () => {
        renderDashboard();

        const todo = screen.getByTestId('todo-today');
        const metrics = screen.getByTestId('metrics-cards');
        const recent = screen.getByTestId('recent-tasks');

        expect(todo.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(metrics.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('sends a system notification for due todo items when notifications are enabled', async () => {
        const notifications = [];
        const originalNotification = window.Notification;
        function MockNotification(title, options) {
            notifications.push({ title, options });
        }
        MockNotification.permission = 'granted';
        MockNotification.requestPermission = vi.fn();
        window.Notification = MockNotification;
        mockPreferences.systemNotificationsEnabled = true;

        mockUseTasks.mockReturnValueOnce({
            activeTasks: [],
            archivedTasks: [],
            updateTask: vi.fn(),
            deleteTask: vi.fn(),
            archiveTask: vi.fn(),
            getOverdueTasks: vi.fn(() => []),
            getTasksForToday: vi.fn(() => [{ id: 'task-1', title: 'Send estimate', startDate: '2026-03-24', completed: false }]),
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
        });
        mockExpenses.push({
            id: 'expense-1',
            title: 'Hosting',
            date: '2026-03-24',
            paymentStatus: 'unpaid',
            paymentMode: 'manual',
            amountType: 'fixed',
        });

        try {
            renderDashboard();

            await waitFor(() => {
                expect(notifications).toHaveLength(1);
            });
        } finally {
            if (typeof originalNotification === 'undefined') {
                delete window.Notification;
            } else {
                window.Notification = originalNotification;
            }
        }

        expect(notifications[0]).toEqual({
            title: 'TaskTime',
            options: {
                body: '1 task and 1 expense are due today.',
                tag: 'tasktime-todo-2026-03-24',
            },
        });
    });

    it('does not send todo notifications when the preference is disabled', async () => {
        const notifications = [];
        const originalNotification = window.Notification;
        function MockNotification(title, options) {
            notifications.push({ title, options });
        }
        MockNotification.permission = 'granted';
        MockNotification.requestPermission = vi.fn();
        window.Notification = MockNotification;
        mockPreferences.systemNotificationsEnabled = false;

        mockUseTasks.mockReturnValueOnce({
            activeTasks: [],
            archivedTasks: [],
            updateTask: vi.fn(),
            deleteTask: vi.fn(),
            archiveTask: vi.fn(),
            getOverdueTasks: vi.fn(() => []),
            getTasksForToday: vi.fn(() => [{ id: 'task-1', title: 'Send estimate', startDate: '2026-03-24', completed: false }]),
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
        });

        try {
            renderDashboard();

            await waitFor(() => {
                expect(screen.getByTestId('todo-today')).toBeInTheDocument();
            });
        } finally {
            if (typeof originalNotification === 'undefined') {
                delete window.Notification;
            } else {
                window.Notification = originalNotification;
            }
        }

        expect(notifications).toHaveLength(0);
    });

    it('passes the default dashboard filters to the overview cards', () => {
        renderDashboard();

        expect(screen.getByTestId('recent-tasks').textContent).toContain('recent');
        expect(screen.getByTestId('projects-overview').textContent).toContain('recent');
        expect(screen.getByText('No paid expenses in the last 30 days')).toBeInTheDocument();
        expect(screen.getByText('No time entries in the last 30 days')).toBeInTheDocument();
    });

    it('shows only items inside the 30-day dashboard window by default', () => {
        mockUseTasks.mockReturnValue({
            activeTasks: [
                { id: 'task-1', title: 'Design sprint', projectId: 'project-1' },
                { id: 'task-2', title: 'Invoice review', projectId: 'project-2' },
                { id: 'task-3', title: 'Old discovery', projectId: 'project-1' },
                { id: 'task-4', title: 'Sprint retro', projectId: 'project-1' },
                { id: 'task-5', title: 'Client handoff', projectId: 'project-2' },
                { id: 'task-6', title: 'Bug bash', projectId: 'project-1' },
                { id: 'task-7', title: 'Status review', projectId: 'project-2' },
                { id: 'task-8', title: 'Invoice follow-up', projectId: 'project-1' },
            ],
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
        });
        mockTimeEntries.push(
            { id: 'entry-1', taskId: 'task-1', start: Date.parse('2026-03-20T09:00:00.000Z'), end: Date.parse('2026-03-20T10:00:00.000Z') },
            { id: 'entry-2', taskId: 'task-2', start: Date.parse('2026-03-21T09:00:00.000Z'), end: Date.parse('2026-03-21T09:30:00.000Z') },
            { id: 'entry-3', taskId: 'task-3', start: Date.parse('2026-02-10T09:00:00.000Z'), end: Date.parse('2026-02-10T10:00:00.000Z') },
            { id: 'entry-4', taskId: 'task-4', start: Date.parse('2026-03-22T09:00:00.000Z'), end: Date.parse('2026-03-22T10:00:00.000Z') },
            { id: 'entry-5', taskId: 'task-5', start: Date.parse('2026-03-23T09:00:00.000Z'), end: Date.parse('2026-03-23T10:00:00.000Z') },
            { id: 'entry-6', taskId: 'task-6', start: Date.parse('2026-03-24T09:00:00.000Z'), end: Date.parse('2026-03-24T10:00:00.000Z') },
            { id: 'entry-7', taskId: 'task-7', start: Date.parse('2026-03-18T09:00:00.000Z'), end: Date.parse('2026-03-18T10:00:00.000Z') },
            { id: 'entry-8', taskId: 'task-8', start: Date.parse('2026-03-19T09:00:00.000Z'), end: Date.parse('2026-03-19T10:00:00.000Z') },
        );
        mockExpenses.push(
            { id: 'expense-paid', title: 'Hosting', amount: 24, currency: 'USD', date: '2026-03-10', paymentStatus: 'paid', amountType: 'fixed' },
            { id: 'expense-old', title: 'Legacy software', amount: 49, currency: 'USD', date: '2026-02-15', paymentStatus: 'paid', amountType: 'fixed' },
            { id: 'expense-2', title: 'Domain renewal', amount: 18, currency: 'USD', date: '2026-03-12', paymentStatus: 'paid', amountType: 'fixed' },
            { id: 'expense-3', title: 'Design assets', amount: 35, currency: 'USD', date: '2026-03-13', paymentStatus: 'paid', amountType: 'fixed' },
            { id: 'expense-4', title: 'Cloud backups', amount: 12, currency: 'USD', date: '2026-03-14', paymentStatus: 'paid', amountType: 'fixed' },
            { id: 'expense-5', title: 'Monitoring', amount: 22, currency: 'USD', date: '2026-03-15', paymentStatus: 'paid', amountType: 'fixed' },
            { id: 'expense-6', title: 'Support seat', amount: 16, currency: 'USD', date: '2026-03-16', paymentStatus: 'paid', amountType: 'fixed' },
            { id: 'expense-7', title: 'Email delivery', amount: 11, currency: 'USD', date: '2026-03-17', paymentStatus: 'paid', amountType: 'fixed' },
            { id: 'expense-upcoming', title: 'Office rent', amount: 900, currency: 'USD', date: '2026-04-28', paymentStatus: 'unpaid', amountType: 'fixed' },
        );

        render(
            <Dashboard
                projects={[
                    { id: 'project-1', title: 'Alpha Project' },
                    { id: 'project-2', title: 'Beta Project' },
                ]}
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

        expect(screen.getByText('Design sprint')).toBeInTheDocument();
        expect(screen.getByText('Invoice review')).toBeInTheDocument();
        expect(screen.getByText('Invoice follow-up')).toBeInTheDocument();
        expect(screen.getByText('Hosting')).toBeInTheDocument();
        expect(screen.getByText('Email delivery')).toBeInTheDocument();
        expect(screen.queryByText('Old discovery')).not.toBeInTheDocument();
        expect(screen.queryByText('Legacy software')).not.toBeInTheDocument();
        expect(screen.queryByText('Office rent')).not.toBeInTheDocument();
    });

    it('uses frozen expense payment snapshots for paid expense totals', () => {
        mockUseCurrencyConversion.mockReturnValue({
            preferredCurrency: 'EUR',
            exchangeRates: null,
            exchangeRatesLoading: false,
            exchangeRatesError: null,
            needsExchangeRates: true,
            missingExchangeRates: [],
            convertToCurrency: (amounts) => {
                const total = Object.entries(amounts).reduce((sum, [currency, amount]) => {
                    if (currency === 'USD') {
                        return sum + (amount * 0.5)
                    }

                    return sum + amount
                }, 0)

                return { amounts: { EUR: total }, hadConversionError: false }
            },
        });

        mockExpenses.push(
            {
                id: 'expense-snapshot',
                title: 'Hosting',
                amount: 100,
                currency: 'USD',
                date: '2026-03-10',
                paymentStatus: 'paid',
                amountType: 'fixed',
                paymentCurrencySnapshot: {
                    capturedAt: Date.parse('2026-03-10T00:00:00.000Z'),
                    sourceCurrency: 'USD',
                    sourceAmount: 100,
                    preferredCurrencyAtPayment: 'EUR',
                    preferredCurrencyAmount: 80,
                    exchangeRatesBase: 'USD',
                    exchangeRates: { USD: 1, EUR: 0.8 },
                },
            },
        )

        renderDashboard();

        expect(mockMetricsCards).toHaveBeenCalledWith(expect.objectContaining({
            expenseThisMonthPaidTotal: 80,
            expenseLastMonthPaidTotal: 0,
            expenseLast90DaysPaidTotal: 80,
            preferredCurrency: 'EUR',
        }), undefined);
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
