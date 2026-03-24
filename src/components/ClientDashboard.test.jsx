import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientDashboard from './ClientDashboard';

const hookMocks = vi.hoisted(() => ({
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
    deleteProject: vi.fn(),
    updateProject: vi.fn(),
    deleteTask: vi.fn(),
    deleteEntry: vi.fn(),
    deleteInvoice: vi.fn(),
    deleteExpense: vi.fn(),
    unbillExpensesForInvoice: vi.fn(),
    deleteRecurrence: vi.fn(),
    preferences: { currency: 'USD' },
    showSuccess: vi.fn(),
}));

vi.mock('../hooks/useClients.ts', () => ({
    useClients: () => ({ updateClient: hookMocks.updateClient, deleteClient: hookMocks.deleteClient })
}));

vi.mock('../hooks/useProjects.ts', () => ({
    useProjects: () => ({ deleteProject: hookMocks.deleteProject, updateProject: hookMocks.updateProject })
}));

vi.mock('../hooks/useTasks.ts', () => ({
    useTasks: () => ({ deleteTask: hookMocks.deleteTask })
}));

vi.mock('../hooks/useTimeEntries.ts', () => ({
    useTimeEntries: () => ({ deleteEntry: hookMocks.deleteEntry })
}));

vi.mock('../hooks/useInvoices.ts', () => ({
    useInvoices: () => ({ deleteInvoice: hookMocks.deleteInvoice })
}));

vi.mock('../hooks/useExpenses.ts', () => ({
    useExpenses: () => ({ expenses: [], deleteExpense: hookMocks.deleteExpense, unbillExpensesForInvoice: hookMocks.unbillExpensesForInvoice })
}));

vi.mock('../hooks/useExpenseRecurrences.ts', () => ({
    useExpenseRecurrences: () => ({ recurrences: [], deleteRecurrence: hookMocks.deleteRecurrence })
}));

vi.mock('../hooks/usePreferences.ts', () => ({
    usePreferences: () => ({ preferences: hookMocks.preferences })
}));

vi.mock('../hooks/useToast.ts', () => ({
    useToast: () => ({ showSuccess: hookMocks.showSuccess })
}));

vi.mock('./InvoiceGenerator', () => ({ default: () => <button type="button">New Invoice</button> }));
vi.mock('./InvoicesList', () => ({ default: () => <div>Invoices list</div> }));
vi.mock('./MetricsDisplay', () => ({ default: () => <div>Metrics display</div> }));
vi.mock('./expenses/ExpensesSection', () => ({ default: () => <div>Expenses section</div> }));
vi.mock('./modals/ClientDeleteDialog', () => ({ default: () => null }));
vi.mock('./modals/ClientArchiveDialog', () => ({ default: () => null }));

describe('ClientDashboard', () => {
    const setMatchMedia = (matches) => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches,
                media: '(max-width: 767px)',
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }))
        });
    };

    beforeEach(() => {
        setMatchMedia(false);
    });

    it('uses a horizontal stats rail on mobile', () => {
        setMatchMedia(true);

        render(
            <ClientDashboard
                client={{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }}
                projects={[]}
                tasks={[]}
                timeEntries={[]}
                onBackToClients={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoices={[]}
                invoiceTemplates={[]}
                activeModal={null}
                navigateToProject={vi.fn()}
                openClientModal={vi.fn()}
                openProjectModal={vi.fn()}
                openBusinessModal={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                openTemplateModal={vi.fn()}
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
            />
        );

        const metricsRow = screen.getByTestId('client-metrics-row');
        expect(metricsRow.className.includes('overflow-x-auto')).toBe(true);
        expect(metricsRow.className.includes('flex')).toBe(true);
    });
});
