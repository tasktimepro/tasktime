import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMocks = vi.hoisted(() => ({
    generatePDF: vi.fn(async () => undefined),
}));

vi.mock('./pdfUtils', () => ({
    generatePDF: pdfMocks.generatePDF,
}));

import {
    buildClientStatementHtml,
    buildExpensesReportHtml,
    buildInvoicesReportHtml,
    buildMonthlyReportHtml,
    buildOutstandingReportHtml,
    buildProjectWorkSummaryHtml,
    exportClientStatementPdf,
    exportExpensesReportPdf,
    exportInvoicesReportPdf,
    exportMonthlyReportPdf,
    exportOutstandingReportPdf,
    exportProjectWorkSummaryPdf,
} from './reportPdfUtils';

describe('reportPdfUtils', () => {
    beforeEach(() => {
        pdfMocks.generatePDF.mockClear();
    });

    it('builds a monthly report html document with summary and breakdown sections', () => {
        const html = buildMonthlyReportHtml({
            businessLabel: 'TaskTime Pro Studio',
            categoryBreakdown: [
                { label: 'Software & subscriptions', value: 'EUR120.00' },
            ],
            generatedAtLabel: '2026-05-20',
            periodLabel: '2026-04-01 to 2026-04-30',
            reviewRows: [
                { label: 'Invoices without business profile', value: '2 invoices' },
            ],
            summaryRows: [
                { label: 'Revenue Issued', value: 'EUR1220.00' },
                { label: 'Expenses', value: 'EUR120.00' },
            ],
            topClientBreakdown: [
                { label: 'Acme', value: 'EUR1220.00' },
            ],
            projectBreakdown: [
                { label: 'TaskTime Pro', value: 'EUR1220.00' },
            ],
        });

        expect(html).toContain('TaskTime Pro Monthly Report');
        expect(html).toContain('TaskTime Pro Studio');
        expect(html).toContain('Revenue Issued');
        expect(html).toContain('Top Clients');
        expect(html).toContain('Top Projects');
        expect(html).toContain('Expense Categories');
        expect(html).toContain('Needs Review');
    });

    it('builds a client statement html document with summary and statement sections', () => {
        const html = buildClientStatementHtml({
            businessLabel: 'TaskTime Pro Studio',
            clientLabel: 'Acme',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            statementDateLabel: 'Apr 30, 2026',
            summaryRows: [
                { label: 'Opening balance', value: 'EUR180.00' },
                { label: 'Closing balance', value: 'EUR220.00' },
            ],
            openingRows: [
                { invoiceNumber: 'INV-OPEN', date: 'Mar 15, 2026', dueDate: 'Mar 30, 2026', status: 'sent', amount: 'EUR100.00' },
            ],
            paymentRows: [
                { invoiceNumber: 'INV-PAID', paidDate: 'Apr 10, 2026', amount: 'EUR80.00' },
            ],
            outstandingRows: [
                { invoiceNumber: 'INV-APR', date: 'Apr 12, 2026', dueDate: 'Apr 26, 2026', status: 'sent', amount: 'EUR120.00' },
            ],
        });

        expect(html).toContain('TaskTime Pro Client Statement');
        expect(html).toContain('Acme');
        expect(html).toContain('Opening Balance');
        expect(html).toContain('Payments in Period');
        expect(html).toContain('Outstanding at Statement Date');
    });

    it('builds a project work summary html document with summary and task rows', () => {
        const html = buildProjectWorkSummaryHtml({
            clientLabel: 'Acme',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            projectLabel: 'TaskTime Pro',
            summaryRows: [
                { label: 'Total worked', value: '3h 30m' },
                { label: 'Billable worked', value: '2h 30m' },
            ],
            taskRows: [
                { task: 'Setup', entries: '2', totalDuration: '2h 30m', billableDuration: '2h 30m' },
            ],
        });

        expect(html).toContain('TaskTime Pro Project Work Summary');
        expect(html).toContain('TaskTime Pro');
        expect(html).toContain('Summary');
        expect(html).toContain('Tasks');
        expect(html).toContain('Setup');
    });

    it('builds an issued invoices report html document with invoice rows', () => {
        const html = buildInvoicesReportHtml({
            businessLabel: 'TaskTime Pro Studio',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            summarySections: [
                {
                    title: 'By status',
                    rows: [
                        { label: 'paid', value: '1 invoices • EUR1,220.00' },
                    ],
                },
            ],
            rows: [
                {
                    invoiceNumber: 'INV-001',
                    client: 'Acme',
                    business: 'TaskTime Pro Studio',
                    project: 'TaskTime Pro',
                    invoiceDate: 'Apr 12, 2026',
                    dueDate: 'Apr 26, 2026',
                    paidDate: 'Apr 20, 2026',
                    canceledAt: 'Jul 14, 2026, 10:30 AM',
                    cancellationReason: 'Duplicate <invoice>',
                    status: 'paid',
                    currency: 'EUR',
                    subtotal: 'EUR1,000.00',
                    tax: 'EUR220.00',
                    total: 'EUR1,220.00',
                },
            ],
        });

        expect(html).toContain('TaskTime Pro Issued Invoices Report');
        expect(html).toContain('By status');
        expect(html).toContain('INV-001');
        expect(html).toContain('Acme');
        expect(html).toContain('EUR1,220.00');
        expect(html).toContain('Canceled');
        expect(html).toContain('Cancellation Reason');
        expect(html).toContain('Duplicate &lt;invoice&gt;');
    });

    it('builds an outstanding invoices report html document with aging and invoice rows', () => {
        const html = buildOutstandingReportHtml({
            businessLabel: 'TaskTime Pro Studio',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            referenceDateLabel: 'Apr 30, 2026',
            summaryRows: [
                { label: 'Outstanding total', value: 'EUR244.00' },
            ],
            agingRows: [
                { label: '1-30 days (EUR)', value: '1 invoices • EUR244.00' },
            ],
            invoiceRows: [
                {
                    invoiceNumber: 'INV-002',
                    client: 'Acme',
                    invoiceDate: 'Apr 16, 2026',
                    dueDate: 'Apr 1, 2026',
                    status: 'overdue',
                    daysOverdue: '29',
                    amount: 'EUR244.00',
                },
            ],
        });

        expect(html).toContain('TaskTime Pro Outstanding Invoices Report');
        expect(html).toContain('Aging Buckets');
        expect(html).toContain('INV-002');
        expect(html).toContain('29');
        expect(html).toContain('EUR244.00');
    });

    it('builds an expenses report html document with summary and expense rows', () => {
        const html = buildExpensesReportHtml({
            businessLabel: 'TaskTime Pro Studio',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            summaryRows: [
                { label: 'Ex VAT', value: 'EUR100.00' },
                { label: 'VAT amount', value: 'EUR20.00' },
            ],
            rows: [
                {
                    date: 'Apr 8, 2026',
                    paidDate: 'Apr 9, 2026',
                    title: 'Hosting',
                    supplier: 'Cloud Host',
                    category: 'Software & subscriptions',
                    business: 'TaskTime Pro Studio',
                    client: 'Acme',
                    project: 'TaskTime Pro',
                    paymentStatus: 'paid',
                    billingStatus: 'unbilled',
                    netAmount: 'EUR100.00',
                    taxAmount: 'EUR20.00',
                    grossAmount: 'EUR120.00',
                },
            ],
        });

        expect(html).toContain('TaskTime Pro Expenses Report');
        expect(html).toContain('Ex VAT');
        expect(html).toContain('Hosting');
        expect(html).toContain('Cloud Host');
        expect(html).toContain('Software &amp; subscriptions');
        expect(html).toContain('EUR120.00');
    });

    it('renders empty-state rows and escapes unsafe labels across report builders', () => {
        const monthlyHtml = buildMonthlyReportHtml({
            businessLabel: 'TaskTime Pro <Studio>',
            categoryBreakdown: [],
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1 < Apr 30',
            projectBreakdown: [
                { label: 'Launch & Grow', value: 'EUR100.00' },
            ],
            reviewRows: [],
            summaryRows: [
                { label: 'Quoted "total"', value: "O'Reilly" },
            ],
            topClientBreakdown: [
                { label: 'Client > Alpha', value: 'EUR100.00' },
            ],
        });

        expect(monthlyHtml).toContain('TaskTime Pro &lt;Studio&gt;');
        expect(monthlyHtml).toContain('Apr 1 &lt; Apr 30');
        expect(monthlyHtml).toContain('Quoted &quot;total&quot;');
        expect(monthlyHtml).toContain('O&#39;Reilly');
        expect(monthlyHtml).toContain('No expense category totals in this period');
        expect(monthlyHtml).toContain('No review issues in this period');

        const statementHtml = buildClientStatementHtml({
            businessLabel: 'TaskTime Pro Studio',
            clientLabel: 'Acme',
            generatedAtLabel: '2026-05-21',
            openingRows: [],
            outstandingRows: [],
            paymentRows: [],
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            statementDateLabel: 'Apr 30, 2026',
            summaryRows: [
                { label: 'Closing balance', value: 'EUR0.00' },
            ],
        });

        expect(statementHtml).toContain('No opening balance items');
        expect(statementHtml).toContain('No payments recorded in this period');
        expect(statementHtml).toContain('No outstanding invoices at the statement date');

        const projectHtml = buildProjectWorkSummaryHtml({
            clientLabel: 'Acme',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            projectLabel: 'TaskTime Pro',
            summaryRows: [
                { label: 'Total worked', value: '0h' },
            ],
            taskRows: [],
        });

        expect(projectHtml).toContain('No worked tasks in this period');

        const invoicesHtml = buildInvoicesReportHtml({
            businessLabel: 'TaskTime Pro Studio',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            rows: [],
        });

        expect(invoicesHtml).not.toContain('grid-template-columns');
        expect(invoicesHtml).toContain('No invoices in this period');

        const outstandingHtml = buildOutstandingReportHtml({
            agingRows: [],
            businessLabel: 'TaskTime Pro Studio',
            generatedAtLabel: '2026-05-21',
            invoiceRows: [],
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            referenceDateLabel: 'Apr 30, 2026',
            summaryRows: [
                { label: 'Outstanding total', value: 'EUR0.00' },
            ],
        });

        expect(outstandingHtml).toContain('No aging rows in this period');
        expect(outstandingHtml).toContain('No outstanding invoices in this period');

        const expensesHtml = buildExpensesReportHtml({
            businessLabel: 'TaskTime Pro Studio',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            rows: [],
            summaryRows: [
                { label: 'Ex VAT', value: 'EUR0.00' },
            ],
        });

        expect(expensesHtml).toContain('No expenses in this period');
    });

    it('exports every report pdf via generatePDF with the built html and filename', async () => {
        await exportMonthlyReportPdf({
            businessLabel: 'TaskTime Pro Studio',
            categoryBreakdown: [],
            filename: 'monthly.pdf',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            projectBreakdown: [],
            summaryRows: [
                { label: 'Revenue', value: 'EUR0.00' },
            ],
            topClientBreakdown: [],
        });

        await exportClientStatementPdf({
            businessLabel: 'TaskTime Pro Studio',
            clientLabel: 'Acme',
            filename: 'statement.pdf',
            generatedAtLabel: '2026-05-21',
            openingRows: [],
            outstandingRows: [],
            paymentRows: [],
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            statementDateLabel: 'Apr 30, 2026',
            summaryRows: [
                { label: 'Closing balance', value: 'EUR0.00' },
            ],
        });

        await exportProjectWorkSummaryPdf({
            clientLabel: 'Acme',
            filename: 'project.pdf',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            projectLabel: 'TaskTime Pro',
            summaryRows: [
                { label: 'Total worked', value: '0h' },
            ],
            taskRows: [],
        });

        await exportInvoicesReportPdf({
            businessLabel: 'TaskTime Pro Studio',
            filename: 'invoices.pdf',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            rows: [],
        });

        await exportOutstandingReportPdf({
            agingRows: [],
            businessLabel: 'TaskTime Pro Studio',
            filename: 'outstanding.pdf',
            generatedAtLabel: '2026-05-21',
            invoiceRows: [],
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            referenceDateLabel: 'Apr 30, 2026',
            summaryRows: [
                { label: 'Outstanding total', value: 'EUR0.00' },
            ],
        });

        await exportExpensesReportPdf({
            businessLabel: 'TaskTime Pro Studio',
            filename: 'expenses.pdf',
            generatedAtLabel: '2026-05-21',
            periodLabel: 'Apr 1, 2026 - Apr 30, 2026',
            rows: [],
            summaryRows: [
                { label: 'Ex VAT', value: 'EUR0.00' },
            ],
        });

        expect(pdfMocks.generatePDF).toHaveBeenCalledTimes(6);
        expect(pdfMocks.generatePDF).toHaveBeenNthCalledWith(1, expect.stringContaining('TaskTime Pro Monthly Report'), 'monthly.pdf');
        expect(pdfMocks.generatePDF).toHaveBeenNthCalledWith(2, expect.stringContaining('TaskTime Pro Client Statement'), 'statement.pdf');
        expect(pdfMocks.generatePDF).toHaveBeenNthCalledWith(3, expect.stringContaining('TaskTime Pro Project Work Summary'), 'project.pdf');
        expect(pdfMocks.generatePDF).toHaveBeenNthCalledWith(4, expect.stringContaining('TaskTime Pro Issued Invoices Report'), 'invoices.pdf');
        expect(pdfMocks.generatePDF).toHaveBeenNthCalledWith(5, expect.stringContaining('TaskTime Pro Outstanding Invoices Report'), 'outstanding.pdf');
        expect(pdfMocks.generatePDF).toHaveBeenNthCalledWith(6, expect.stringContaining('TaskTime Pro Expenses Report'), 'expenses.pdf');
    });
});
