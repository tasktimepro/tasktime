import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectDashboard from './ProjectDashboard';

const hookMocks = vi.hoisted(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    getTimerForProject: vi.fn(() => null),
    clearTimer: vi.fn(),
    deleteProject: vi.fn(),
    archiveProject: vi.fn(),
    unarchiveProject: vi.fn(),
    deleteTask: vi.fn(),
    deleteEntry: vi.fn(),
    deleteInvoice: vi.fn(),
    deleteExpense: vi.fn(),
    unbillExpensesForInvoice: vi.fn(),
    deleteRecurrence: vi.fn(),
    preferences: { currency: 'USD' },
}));

vi.mock('../hooks/useToast.ts', () => ({
    useToast: () => ({ showError: hookMocks.showError, showSuccess: hookMocks.showSuccess })
}));

vi.mock('../hooks/useTimers.ts', () => ({
    useTimers: () => ({ getTimerForProject: hookMocks.getTimerForProject, clearTimer: hookMocks.clearTimer })
}));

vi.mock('../hooks/useProjects.ts', () => ({
    useProjects: () => ({ deleteProject: hookMocks.deleteProject, archiveProject: hookMocks.archiveProject, unarchiveProject: hookMocks.unarchiveProject })
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

vi.mock('../utils/invoiceUtils.ts', () => ({
    getInvoicesForProject: (invoices) => invoices,
}));

vi.mock('./TaskTree', () => ({ default: () => <div>Task tree</div> }));
vi.mock('./InvoiceGenerator', () => ({ default: () => <button type="button">New Invoice</button> }));
vi.mock('./InvoicesList', () => ({ default: () => <div>Invoices list</div> }));
vi.mock('./MetricsDisplay', () => ({ default: () => <div>Metrics display</div> }));
vi.mock('./expenses/ExpensesSection', () => ({ default: () => <div>Expenses section</div> }));
vi.mock('./modals/ProjectDeleteDialog', () => ({ default: () => null }));

describe('ProjectDashboard', () => {
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
            <ProjectDashboard
                project={{ id: 'project-1', title: 'Website', hourlyRate: 125, isPersonal: false }}
                tasks={[]}
                timeEntries={[]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[]}
                invoices={[]}
                invoiceTemplates={[]}
                activeModal={null}
                openClientModal={vi.fn()}
                openProjectModal={vi.fn()}
                openBusinessModal={vi.fn()}
                openPaymentMethodModal={vi.fn()}
                openTemplateModal={vi.fn()}
                openTaskModal={vi.fn()}
                onViewTask={vi.fn()}
                navigateToClient={vi.fn()}
                openExpenseModal={vi.fn()}
                openExpenseView={vi.fn()}
            />
        );

        const metricsRow = screen.getByTestId('project-metrics-row');
        expect(metricsRow.className.includes('overflow-x-auto')).toBe(true);
        expect(metricsRow.className.includes('flex')).toBe(true);
        expect(screen.getByText('Task tree')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'New Invoice' })).toHaveLength(1);

        const menuButton = screen.getByRole('button', { name: 'More actions' });
        const topHeaderRow = menuButton.parentElement?.parentElement;

        expect(topHeaderRow?.className.includes('flex-col')).toBe(false);
        expect(menuButton.className.includes('border')).toBe(true);
        expect(menuButton.className.includes('rounded-full')).toBe(true);
    });
});
