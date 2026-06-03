import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expenses: [],
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
    useExpenses: () => ({ expenses: hookMocks.expenses, deleteExpense: hookMocks.deleteExpense, unbillExpensesForInvoice: hookMocks.unbillExpensesForInvoice })
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

vi.mock('./InvoiceGenerator', () => ({
    default: ({ showButton = true }) => showButton
        ? <button type="button">New Invoice</button>
        : <div data-testid="mobile-generator-invoice">Invoice generator modal</div>
}));
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
        hookMocks.expenses = [];
        localStorage.removeItem('exchangeRatesCache');
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
        expect(screen.queryByRole('button', { name: 'New Invoice' })).toBeNull();
    });

    it('keeps the projects title and new project action inline on mobile until wrapping is needed', () => {
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

        const newProjectButton = screen.getByRole('button', { name: 'New Project' });
        const headerRow = newProjectButton.parentElement;
        const menuButton = screen.getByRole('button', { name: 'More actions' });
        const topHeaderRow = menuButton.parentElement?.parentElement;

        expect(newProjectButton.className.includes('shrink-0')).toBe(true);
        expect(headerRow?.className.includes('flex-wrap')).toBe(true);
        expect(headerRow?.className.includes('flex-col')).toBe(false);
        expect(topHeaderRow?.className.includes('flex-col')).toBe(false);
        expect(menuButton.className.includes('border')).toBe(true);
        expect(menuButton.className.includes('rounded-full')).toBe(true);
    });

    it('opens invoice generation from the mobile more-actions menu', async () => {
        const user = userEvent.setup();
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

        expect(screen.queryByTestId('mobile-generator-invoice')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Generate Invoice' }));

        expect(screen.getByTestId('mobile-generator-invoice')).toBeInTheDocument();
    });

    it('shows the quote stage badge on quote-mode project cards', () => {
        render(
            <ClientDashboard
                client={{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }}
                projects={[{
                    id: 'project-1',
                    title: 'Quote Test Project',
                    preferredClientId: 'client-1',
                    defaultCurrency: 'USD',
                    hourlyRate: 50,
                    statusMode: 'quote'
                }]}
                tasks={[]}
                timeEntries={[]}
                onBackToClients={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        expect(screen.getByText('Quote stage')).toBeInTheDocument();
        expect(screen.getByText('Quote Test Project')).toBeInTheDocument();
    });

    it('wraps long project titles on project cards instead of truncating them', () => {
        const longTitle = 'New AI with a very very long title here that will not fit on one line';

        render(
            <ClientDashboard
                client={{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }}
                projects={[{
                    id: 'project-1',
                    title: longTitle,
                    preferredClientId: 'client-1',
                    defaultCurrency: 'USD',
                    hourlyRate: 50,
                }]}
                tasks={[]}
                timeEntries={[]}
                onBackToClients={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        const title = screen.getByRole('heading', { name: longTitle });

        expect(title.className).toContain('whitespace-normal');
        expect(title.className).toContain('break-words');
        expect(title.className).toContain('[overflow-wrap:anywhere]');
        expect(title.className).not.toContain('truncate');
    });

    it('hides the hourly subtitle for flat-rate project cards', () => {
        render(
            <ClientDashboard
                client={{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }}
                projects={[{
                    id: 'project-1',
                    title: 'Quote Test Project',
                    preferredClientId: 'client-1',
                    defaultCurrency: 'USD',
                    hourlyRate: 50,
                    flatRate: true,
                }]}
                tasks={[]}
                timeEntries={[]}
                onBackToClients={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        expect(screen.queryByText(/per hour/i)).not.toBeInTheDocument();
        expect(screen.getByText('Quote Test Project')).toBeInTheDocument();
    });

    it('includes converted project expenses in project card invoice totals', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({ rates: { USD: 1, EUR: 0.92, CHF: 0.88 } })
        });
        hookMocks.expenses = [{
            id: 'expense-1',
            title: 'Project expense',
            projectId: 'project-1',
            clientId: 'client-1',
            amount: 40,
            currency: 'EUR',
            billable: true,
            billingStatus: 'unbilled',
            date: new Date().toISOString().slice(0, 10)
        }];

        render(
            <ClientDashboard
                client={{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }}
                projects={[{
                    id: 'project-1',
                    title: 'Health AI',
                    preferredClientId: 'client-1',
                    flatRate: true,
                }]}
                tasks={[{
                    id: 'task-1',
                    projectId: 'project-1',
                    title: 'Build',
                    billable: true,
                    estimatedFlatAmount: 3000,
                }]}
                timeEntries={[]}
                onBackToClients={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }]}
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

        await waitFor(() => {
            expect(screen.getByText('CHF3038.26')).toBeInTheDocument();
        });
    });

    it('shows an overdue badge on overdue project cards', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-24T12:00:00Z'));

        render(
            <ClientDashboard
                client={{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }}
                projects={[{
                    id: 'project-1',
                    title: 'Website',
                    preferredClientId: 'client-1',
                    defaultCurrency: 'USD',
                    hourlyRate: 50,
                    deadline: '2026-03-20'
                }]}
                tasks={[]}
                timeEntries={[]}
                onBackToClients={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        expect(screen.getByText('Overdue')).toBeInTheDocument();
        expect(screen.getByText(/4 days overdue/i)).toBeInTheDocument();

        vi.useRealTimers();
    });
});
