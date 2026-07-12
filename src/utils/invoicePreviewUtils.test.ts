import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getProjectInvoicePreview } from './invoicePreviewUtils';

const loadLegacyBillingParityFixture = () => JSON.parse(readFileSync(
    path.resolve(process.cwd(), 'test-data/backups/tasktime-legacy-billing-parity-v1.4.json'),
    'utf8'
));

describe('invoicePreviewUtils', () => {
    it('calculates hourly unbilled task amounts with project-specific expenses', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: 100, flatRate: false },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }],
                tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Task', billable: true }],
                timeEntries: [{ id: 'entry-1', taskId: 'task-1', start: 1000, end: 2 * 60 * 60 * 1000 + 1000 }],
                expenses: [
                    { id: 'expense-1', title: 'Hosting', projectId: 'project-1', clientId: 'client-1', amount: 40, currency: 'CHF', billable: true, billingStatus: 'unbilled', date: '2026-05-01' },
                    { id: 'expense-2', title: 'Client fee', projectId: null, clientId: 'client-1', amount: 15, currency: 'CHF', billable: true, billingStatus: 'unbilled', date: '2026-05-01' },
                ],
            }
        );

        expect(preview).toEqual(expect.objectContaining({
            currency: 'CHF',
            taskAmount: 200,
            expenseAmount: 40,
            total: 240,
            unbilledHours: 2,
            selectedExpenseCount: 1,
            excludedExpenseCount: 0,
        }));
        expect(preview.entrySelections).toEqual([expect.objectContaining({
            entryId: 'entry-1',
            taskId: 'task-1',
            billableDurationMs: 2 * 60 * 60 * 1000,
        })]);
        expect(preview.taskSelections).toEqual([{
            taskId: 'task-1',
            title: 'Task',
            pricingMode: 'hourly',
            quantity: 2,
            rate: 100,
            amount: 200,
            quotedAmount: null,
        }]);
        expect(preview.expenseSelections).toEqual([expect.objectContaining({
            expenseId: 'expense-1',
            sourceAmount: 40,
            sourceCurrency: 'CHF',
            invoiceAmount: 40,
            invoiceCurrency: 'CHF',
            exchangeRate: 1,
        })]);
    });

    it('can include client-level expenses when explicitly requested', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: 0, flatRate: false },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }],
                expenses: [
                    { id: 'expense-1', title: 'Hosting', projectId: 'project-1', clientId: 'client-1', amount: 40, currency: 'CHF', billable: true, billingStatus: 'unbilled', date: '2026-05-01' },
                    { id: 'expense-2', title: 'Client fee', projectId: null, clientId: 'client-1', amount: 15, currency: 'CHF', billable: true, billingStatus: 'unbilled', date: '2026-05-01' },
                ],
                includeClientLevelExpenses: true,
            }
        );

        expect(preview.expenseAmount).toBe(55);
        expect(preview.selectedExpenseCount).toBe(2);
    });

    it('uses flat task quote amounts instead of hourly time on flat projects', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: 50, flatRate: true },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }],
                tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Task', billable: true, estimatedFlatAmount: 3000 }],
                timeEntries: [{ id: 'entry-1', taskId: 'task-1', start: 1000, end: 4 * 60 * 60 * 1000 + 1000 }],
                expenses: [{ id: 'expense-1', title: 'Travel', projectId: 'project-1', clientId: 'client-1', amount: 40, currency: 'CHF', billable: true, billingStatus: 'unbilled', date: '2026-05-01' }],
            }
        );

        expect(preview).toEqual(expect.objectContaining({
            taskAmount: 3000,
            expenseAmount: 40,
            total: 3040,
            unbilledHours: 4,
            unpricedHours: 0,
        }));
    });

    it('excludes flat task quote amounts already claimed by an invoice', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: 50, flatRate: true },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }],
                tasks: [{
                    id: 'task-1',
                    projectId: 'project-1',
                    title: 'Task',
                    billable: true,
                    estimatedFlatAmount: 3000,
                    quotedAmountBilling: {
                        invoiceId: 'invoice-1',
                        billedAt: 1000,
                        total: 3000,
                    },
                }],
            }
        );

        expect(preview.taskAmount).toBe(0);
        expect(preview.total).toBe(0);
    });

    it('includes a new flat quote amount on a task with previous quoted billing metadata', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: 50, flatRate: true },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }],
                tasks: [{
                    id: 'task-1',
                    projectId: 'project-1',
                    title: 'Task',
                    billable: true,
                    estimatedFlatAmount: 3500,
                    quotedAmountBilling: {
                        invoiceId: 'invoice-1',
                        billedAt: 1000,
                        total: 3000,
                    },
                }],
            }
        );

        expect(preview.taskAmount).toBe(3500);
        expect(preview.total).toBe(3500);
    });

    it('reports unpriced hours only for hourly projects without an effective rate', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: null, flatRate: false },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'CHF' }],
                tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Task', billable: true }],
                timeEntries: [{ id: 'entry-1', taskId: 'task-1', start: 1000, end: 90 * 60 * 1000 + 1000 }],
            }
        );

        expect(preview.total).toBe(0);
        expect(preview.unpricedHours).toBe(1.5);
    });

    it('converts cross-currency expenses when exchange rates are available', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: 0, flatRate: false },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'EUR' }],
                expenses: [{ id: 'expense-1', title: 'Swiss fee', projectId: 'project-1', clientId: 'client-1', amount: 88, currency: 'CHF', billable: true, billingStatus: 'unbilled', date: '2026-05-01' }],
                exchangeRates: { USD: 1, EUR: 0.92, CHF: 0.88 },
            }
        );

        expect(preview.expenseAmount).toBe(92);
        expect(preview.total).toBe(92);
        expect(preview.excludedExpenseCount).toBe(0);
    });

    it('excludes cross-currency expenses when exchange rates are unavailable', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: 0, flatRate: false },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'EUR' }],
                expenses: [{ id: 'expense-1', title: 'Swiss fee', projectId: 'project-1', clientId: 'client-1', amount: 88, currency: 'CHF', billable: true, billingStatus: 'unbilled', date: '2026-05-01' }],
            }
        );

        expect(preview.total).toBe(0);
        expect(preview.selectedExpenseCount).toBe(0);
        expect(preview.excludedExpenseCount).toBe(1);
    });

    it('keeps late-synced unbilled entries eligible even when they predate the legacy task cutoff', () => {
        const preview = getProjectInvoicePreview(
            { id: 'project-1', title: 'Build', preferredClientId: 'client-1', hourlyRate: 100, flatRate: false },
            {
                clients: [{ id: 'client-1', title: 'Acme', defaultCurrency: 'EUR' }],
                tasks: [{ id: 'task-1', projectId: 'project-1', title: 'Archived work', billable: true, archived: true, lastBilledAt: 10_000 }],
                timeEntries: [
                    { id: 'entry-late', taskId: 'task-1', start: 1_000, end: 3_601_000 },
                    { id: 'entry-billed', taskId: 'task-1', start: 4_000, end: 3_604_000, billedInvoiceId: 'invoice-old' },
                ],
            }
        );

        expect(preview.entrySelections.map((entry) => entry.entryId)).toEqual(['entry-late']);
        expect(preview.unbilledHours).toBe(1);
        expect(preview.total).toBe(100);
    });

    it('does not re-offer markerless entries exactly accounted for by a finalized legacy invoice', () => {
        const fixture = loadLegacyBillingParityFixture();
        const project = fixture.projects[0];
        const preview = getProjectInvoicePreview(project, {
            clients: fixture.clients,
            tasks: fixture.tasks,
            timeEntries: fixture.timeEntries,
            invoices: fixture.invoices,
            preferredCurrency: fixture.preferences.currency,
            billingPeriodStart: '2026-05-01',
            billingPeriodEnd: '2026-05-31',
        });

        expect(preview.entrySelections).toEqual([]);
        expect(preview.unbilledHours).toBe(0);
        expect(preview.total).toBe(0);
    });
});
