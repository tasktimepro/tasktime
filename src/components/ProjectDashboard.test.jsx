import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDashboard from './ProjectDashboard';

const hookMocks = vi.hoisted(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    getTimerForProject: vi.fn(() => null),
    clearTimer: vi.fn(),
    updateProject: vi.fn(),
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
    useProjects: () => ({ deleteProject: hookMocks.deleteProject, archiveProject: hookMocks.archiveProject, unarchiveProject: hookMocks.unarchiveProject, updateProject: hookMocks.updateProject })
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

vi.mock('../hooks/useBusinessBrandAssets.ts', () => ({
    useBusinessBrandAssets: () => ({ businessBrandAssets: [] })
}));

vi.mock('../utils/invoiceUtils.ts', () => ({
    getInvoicesForProject: (invoices) => invoices,
}));

vi.mock('./TaskTree', () => ({ default: () => <div>Task tree</div> }));
vi.mock('./InvoiceGenerator', () => ({
    default: ({ mode, showButton = true }) => showButton
        ? <button type="button">{mode === 'quote' ? 'Generate Quote' : 'New Invoice'}</button>
        : <div data-testid={`mobile-generator-${mode}`}>{mode === 'quote' ? 'Quote generator modal' : 'Invoice generator modal'}</div>
}));
vi.mock('./InvoicesList', () => ({ default: () => <div>Invoices list</div> }));
vi.mock('./MetricsDisplay', () => ({ default: () => <div>Metrics display</div> }));
vi.mock('./expenses/ExpensesSection', () => ({ default: () => <div>Expenses section</div> }));
vi.mock('./modals/ProjectDeleteDialog', () => ({ default: () => null }));
vi.mock('./ProjectNotesEditor', () => ({ default: () => <div>Project notes editor</div> }));

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
        hookMocks.updateProject.mockClear();
        hookMocks.showSuccess.mockClear();
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
        expect(screen.getByRole('tab', { name: 'Tasks' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Notes' })).toBeInTheDocument();
        expect(screen.getByText('Task tree')).toBeInTheDocument();
    });

    it('opens invoice generation from the mobile more-actions menu', async () => {
        const user = userEvent.setup();
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

        expect(screen.queryByTestId('mobile-generator-invoice')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Generate Invoice' }));

        expect(screen.getByTestId('mobile-generator-invoice')).toBeInTheDocument();
    });

    it('opens quote generation from the mobile more-actions menu for quote-stage projects', async () => {
        const user = userEvent.setup();
        setMatchMedia(true);

        render(
            <ProjectDashboard
                project={{ id: 'project-1', title: 'Website', hourlyRate: 125, isPersonal: false, statusMode: 'quote' }}
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

        expect(screen.queryByTestId('mobile-generator-quote')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Generate Quote' }));

        expect(screen.getByTestId('mobile-generator-quote')).toBeInTheDocument();
    });

    it('shows quote stage and planning metrics when planning fields exist', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-29T12:00:00Z'));

        render(
            <ProjectDashboard
                project={{
                    id: 'project-1',
                    title: 'Website',
                    hourlyRate: 125,
                    isPersonal: false,
                    preferredClientId: 'client-1',
                    statusMode: 'quote',
                    deadline: '2026-06-05',
                    budgetAmount: 2000,
                }}
                tasks={[
                    { id: 'task-1', title: 'Discovery', projectId: 'project-1', estimatedHours: 4 },
                    { id: 'task-2', title: 'Build', projectId: 'project-1', estimatedHours: 6 },
                ]}
                timeEntries={[
                    { id: 'entry-1', taskId: 'task-1', start: 0, end: 2 * 60 * 60 * 1000 },
                ]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        expect(screen.getByText('Quote stage')).toBeInTheDocument();
        expect(screen.getByText('Planning & Progress')).toBeInTheDocument();
        expect(screen.getByText('Estimated hours')).toBeInTheDocument();
        expect(screen.getByText('Target amount')).toBeInTheDocument();
        expect(screen.getByText('Deadline')).toBeInTheDocument();
        expect(screen.getByText('2 of 10 hours tracked')).toBeInTheDocument();
        expect(screen.getByText('7 days remaining')).toBeInTheDocument();
        expect(screen.queryByText(/Estimated amount:/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Remaining to target:/i)).toBeInTheDocument();
        expect(screen.getByText(/Projected earnings:/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Generate Quote' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Activate Project' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'New Invoice' })).toBeNull();

        const planningCard = screen.getByTestId('planning-progress-card');
        const expensesSection = screen.getByText('Expenses section');
        const bottomMetricsDisplay = screen.getByText('Metrics display');

        expect(planningCard.compareDocumentPosition(expensesSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(expensesSection.compareDocumentPosition(bottomMetricsDisplay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        vi.useRealTimers();
    });

    it('activates a quote-stage project from the planning card', async () => {
        const user = userEvent.setup();

        render(
            <ProjectDashboard
                project={{
                    id: 'project-1',
                    title: 'Website',
                    hourlyRate: 125,
                    isPersonal: false,
                    preferredClientId: 'client-1',
                    statusMode: 'quote',
                    budgetAmount: 2000,
                }}
                tasks={[]}
                timeEntries={[]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        await user.click(screen.getByRole('button', { name: 'Activate Project' }));

        expect(hookMocks.updateProject).toHaveBeenCalledWith('project-1', { statusMode: 'active' });
        expect(hookMocks.showSuccess).toHaveBeenCalledWith('Project is now active and ready to generate invoices.');
    });

    it('shows quoted amount without target progress when no project budget exists', () => {
        render(
            <ProjectDashboard
                project={{
                    id: 'project-1',
                    title: 'Fixed Scope',
                    hourlyRate: 125,
                    flatRate: true,
                    isPersonal: false,
                    preferredClientId: 'client-1',
                    budgetAmount: null,
                }}
                tasks={[
                    { id: 'task-1', title: 'Delivery', projectId: 'project-1', billable: true, estimatedFlatAmount: 3000 },
                ]}
                timeEntries={[
                    { id: 'entry-1', taskId: 'task-1', start: 0, end: 4 * 60 * 60 * 1000 },
                ]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }]}
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

        expect(screen.getByText('Quoted amount')).toBeInTheDocument();
        expect(screen.getByText('Quoted amount: CHF3000.00')).toBeInTheDocument();
        expect(screen.queryByText('Target amount')).not.toBeInTheDocument();
        expect(screen.queryByText('On target')).not.toBeInTheDocument();
        expect(screen.queryByText(/Projected earnings:/i)).not.toBeInTheDocument();
    });

    it('shows an activate action in the more-actions menu for quote-stage projects', async () => {
        const user = userEvent.setup();

        render(
            <ProjectDashboard
                project={{ id: 'project-1', title: 'Website', hourlyRate: 125, isPersonal: false, statusMode: 'quote' }}
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

        await user.click(screen.getByRole('button', { name: 'More actions' }));

        expect(await screen.findByRole('menuitem', { name: 'Activate Project' })).toBeInTheDocument();
    });

    it('hides planning metrics when no planning fields exist', () => {
        render(
            <ProjectDashboard
                project={{ id: 'project-1', title: 'Website', hourlyRate: 125, isPersonal: false, preferredClientId: 'client-1' }}
                tasks={[]}
                timeEntries={[]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        expect(screen.queryByText('Planning & Progress')).not.toBeInTheDocument();
        expect(screen.queryByText('Quote stage')).not.toBeInTheDocument();
    });

    it('marks a deadline complete from the deadline card', async () => {
        const user = userEvent.setup();

        render(
            <ProjectDashboard
                project={{ id: 'project-1', title: 'Website', hourlyRate: 125, isPersonal: false, preferredClientId: 'client-1', deadline: '2026-06-05' }}
                tasks={[]}
                timeEntries={[]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        await user.click(screen.getByRole('button', { name: 'Mark complete' }));

        expect(hookMocks.updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
            deadlineResolvedAt: expect.any(Number),
        }));
    });

    it('shows resolved deadline status with a reopen action', () => {
        render(
            <ProjectDashboard
                project={{ id: 'project-1', title: 'Website', hourlyRate: 125, isPersonal: false, preferredClientId: 'client-1', deadline: '2026-06-05', deadlineResolvedAt: Date.UTC(2026, 4, 29) }}
                tasks={[]}
                timeEntries={[]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        expect(screen.getByText(/Completed/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reopen deadline' })).toBeInTheDocument();
        expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    });

    it('shows an overdue badge in the deadline card when the project is overdue', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-10T12:00:00Z'));

        render(
            <ProjectDashboard
                project={{ id: 'project-1', title: 'Website', hourlyRate: 125, isPersonal: false, preferredClientId: 'client-1', deadline: '2026-06-05' }}
                tasks={[]}
                timeEntries={[]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        expect(screen.getByText('Overdue')).toBeInTheDocument();
        expect(screen.getByText(/5 days overdue/i)).toBeInTheDocument();

        vi.useRealTimers();
    });

    it('shows the client but hides hourly rate details for flat-rate projects', () => {
        render(
            <ProjectDashboard
                project={{ id: 'project-1', title: 'Website', hourlyRate: 125, flatRate: true, isPersonal: false, preferredClientId: 'client-1' }}
                tasks={[]}
                timeEntries={[]}
                onBackToProjects={vi.fn()}
                paymentMethods={[]}
                businessInfos={[]}
                clients={[{ id: 'client-1', title: 'Acme', defaultCurrency: 'USD' }]}
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

        expect(screen.queryByText(/per hour/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Acme' })).toBeInTheDocument();
        expect(screen.getByText('Website')).toBeInTheDocument();
    });
});
