import { describe, expect, it } from 'vitest';
import {
    buildClientStatementHtml,
    buildExpensesReportHtml,
    buildInvoicesReportHtml,
    buildMonthlyReportHtml,
    buildOutstandingReportHtml,
    buildProjectWorkSummaryHtml,
} from './reportPdfUtils';

describe('reportPdfUtils', () => {
    it('builds a monthly report html document with summary and breakdown sections', () => {
        const html = buildMonthlyReportHtml({
            businessLabel: 'TaskTime Studio',
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
                { label: 'TaskTime', value: 'EUR1220.00' },
            ],
        });

        expect(html).toContain('TaskTime Monthly Report');
        expect(html).toContain('TaskTime Studio');
        expect(html).toContain('Revenue Issued');
        expect(html).toContain('Top Clients');
        expect(html).toContain('Top Projects');
        expect(html).toContain('Expense Categories');
        expect(html).toContain('Needs Review');
    });

    it('builds a client statement html document with summary and statement sections', () => {
        const html = buildClientStatementHtml({
            businessLabel: 'TaskTime Studio',
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

        expect(html).toContain('TaskTime Client Statement');
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
            projectLabel: 'TaskTime',
            summaryRows: [
                { label: 'Total worked', value: '3h 30m' },
                { label: 'Billable worked', value: '2h 30m' },
            ],
            taskRows: [
                { task: 'Setup', entries: '2', totalDuration: '2h 30m', billableDuration: '2h 30m' },
            ],
        });

        expect(html).toContain('TaskTime Project Work Summary');
        expect(html).toContain('TaskTime');
        expect(html).toContain('Summary');
        expect(html).toContain('Tasks');
        expect(html).toContain('Setup');
    });

    it('builds an issued invoices report html document with invoice rows', () => {
        const html = buildInvoicesReportHtml({
            businessLabel: 'TaskTime Studio',
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
                    business: 'TaskTime Studio',
                    project: 'TaskTime',
                    invoiceDate: 'Apr 12, 2026',
                    dueDate: 'Apr 26, 2026',
                    paidDate: 'Apr 20, 2026',
                    status: 'paid',
                    currency: 'EUR',
                    subtotal: 'EUR1,000.00',
                    tax: 'EUR220.00',
                    total: 'EUR1,220.00',
                },
            ],
        });

        expect(html).toContain('TaskTime Issued Invoices Report');
        expect(html).toContain('By status');
        expect(html).toContain('INV-001');
        expect(html).toContain('Acme');
        expect(html).toContain('EUR1,220.00');
    });

    it('builds an outstanding invoices report html document with aging and invoice rows', () => {
        const html = buildOutstandingReportHtml({
            businessLabel: 'TaskTime Studio',
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

        expect(html).toContain('TaskTime Outstanding Invoices Report');
        expect(html).toContain('Aging Buckets');
        expect(html).toContain('INV-002');
        expect(html).toContain('29');
        expect(html).toContain('EUR244.00');
    });

    it('builds an expenses report html document with summary and expense rows', () => {
        const html = buildExpensesReportHtml({
            businessLabel: 'TaskTime Studio',
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
                    business: 'TaskTime Studio',
                    client: 'Acme',
                    project: 'TaskTime',
                    paymentStatus: 'paid',
                    billingStatus: 'unbilled',
                    netAmount: 'EUR100.00',
                    taxAmount: 'EUR20.00',
                    grossAmount: 'EUR120.00',
                },
            ],
        });

        expect(html).toContain('TaskTime Expenses Report');
        expect(html).toContain('Ex VAT');
        expect(html).toContain('Hosting');
        expect(html).toContain('Cloud Host');
        expect(html).toContain('Software &amp; subscriptions');
        expect(html).toContain('EUR120.00');
    });
});
