import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import Expenses from './Expenses';

const createMatchMedia = (matchesByQuery = {}) => vi.fn().mockImplementation((query) => ({
    matches: Boolean(matchesByQuery[query]),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
}));

const toLocalStorageDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const expensesState = vi.hoisted(() => ({
    expenses: [],
    markAsPaid: vi.fn(),
    markAsUnpaid: vi.fn(),
    createExpense: vi.fn(),
}));

const recurrenceState = vi.hoisted(() => ({
    recurrences: [],
    isLoading: false,
    generatePendingExpenses: vi.fn(),
    pauseRecurrence: vi.fn(),
    resumeRecurrence: vi.fn(),
    deleteRecurrence: vi.fn(),
}));

vi.mock('@/hooks/useUrlState.ts', () => ({
    useUrlState: () => ({
        urlParams: { section: 'all', create: null },
        updateUrl: vi.fn(),
    }),
}));

vi.mock('@/hooks/useExpenses.ts', () => ({
    useExpenses: () => expensesState,
}));

vi.mock('@/hooks/useExpenseRecurrences.ts', () => ({
    useExpenseRecurrences: () => recurrenceState,
}));

vi.mock('@/hooks/useClients.ts', () => ({
    useClients: () => ({
        clients: [
            { id: 'client-1', title: 'Acme Co', archived: false },
        ],
    }),
}));

vi.mock('@/hooks/useProjects.ts', () => ({
    useProjects: () => ({
        projects: [
            { id: 'project-1', title: 'Website', archived: false, preferredClientId: 'client-1' },
        ],
        getProjectsByClient: vi.fn(() => [
            { id: 'project-1', title: 'Website', archived: false, preferredClientId: 'client-1' },
        ]),
    }),
}));

vi.mock('@/hooks/usePreferences.ts', () => ({
    usePreferences: () => ({
        preferences: {
            currency: 'EUR',
        },
    }),
}));

vi.mock('@/hooks/useToast.ts', () => ({
    useToast: () => ({
        showSuccess: vi.fn(),
    }),
}));

vi.mock('@/components/expenses/ExpenseList', () => ({
    default: () => <div data-testid="expense-list">Expense list</div>,
}));

vi.mock('@/components/PaymentMethods', () => ({
    default: () => <div data-testid="payment-methods">Payment methods</div>,
}));

vi.mock('@/components/BusinessInfo', () => ({
    default: () => <div data-testid="business-info">Business info</div>,
}));

describe('Expenses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        expensesState.expenses = [];
        window.matchMedia = createMatchMedia();
    });

    it('opens the mobile filter sheet', () => {
        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

        const dialog = screen.getByRole('dialog');

        expect(within(dialog).getByText('Filters')).toBeInTheDocument();
        expect(within(dialog).getByText('Reset filters')).toBeInTheDocument();
        expect(within(dialog).getByText('Apply filters')).toBeInTheDocument();
        expect(within(dialog).getByText('Paid status')).toBeInTheDocument();
    });

    it('uses neutral styling for the outstanding expenses tab', () => {
        expensesState.expenses = [
            {
                id: 'expense-1',
                title: 'Hosting',
                amount: 25,
                date: toLocalStorageDate(new Date()),
                paymentStatus: 'unpaid',
                archived: false,
            },
        ];

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        );

        expect(screen.getByRole('tab', { name: 'Outstanding (1)' }).className.includes('status-warning-tab')).toBe(false);
    });

    it('uses the invoice-style pill tabs on mobile without the scroll-strip classes', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        });
        expensesState.expenses = [
            {
                id: 'expense-1',
                title: 'Hosting',
                amount: 25,
                date: toLocalStorageDate(new Date()),
                paymentStatus: 'unpaid',
                archived: false,
            },
        ];

        render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        );

        const outstandingTab = screen.getByRole('tab', { name: 'Outstanding (1)' });
        const tabList = outstandingTab.closest('[role="tablist"]');

        expect(tabList).not.toBeNull();
        expect(tabList.className).toContain('flex-wrap');
        expect(tabList.className.includes('overflow-x-auto')).toBe(false);
        expect(tabList.className.includes('border-b')).toBe(false);
        expect(outstandingTab.className).toContain('rounded-full');
        expect(outstandingTab.className.includes('rounded-none')).toBe(false);
    });

    it('matches the invoices mobile spacing between the top tabs and page title', () => {
        window.matchMedia = createMatchMedia({
            '(max-width: 767px)': true,
        });

        const { container } = render(
            <Expenses
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                editPaymentMethodModal={vi.fn()}
                openBusinessModal={vi.fn()}
                editBusinessModal={vi.fn()}
            />
        );

        expect(container.firstChild).not.toBeNull();
        expect(container.firstChild.className).toContain('space-y-4');
        expect(container.firstChild.className).toContain('overflow-x-hidden');
    });
});