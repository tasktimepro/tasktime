import { describe, expect, it } from 'vitest';
import {
    buildClientStatementSummary,
    buildExpenseTotalsSummary,
    buildInvoiceRegisterSummary,
    buildOutstandingInvoiceSummary,
    buildProjectWorkSummary,
    buildVatReportSummary,
    getClientGeographyLabel,
    getExpenseNetAmount,
    getExpenseTaxClaimStatus,
    getExpenseTaxAmount,
    getInvoiceNetAmount,
    getInvoiceDaysOverdue,
    getOutstandingAgingBucket,
    getTaxBucketLabel,
} from './reportCalculations';

describe('reportCalculations', () => {
    it('derives expense tax and net values from tax-exclusive amounts', () => {
        const expense = {
            amount: 120,
            amountExcludingTax: 100,
            isTaxExempt: false,
            taxRate: 20,
        };

        expect(getExpenseTaxAmount(expense)).toBe(20);
        expect(getExpenseNetAmount(expense)).toBe(100);
        expect(getExpenseTaxAmount({ amount: 120, isTaxExempt: false, taxRate: 20 })).toBeCloseTo(20);
        expect(getExpenseTaxAmount({ isTaxExempt: false, taxRate: 20 })).toBe(0);
    });

    it('derives invoice net amount from subtotal and tax fallback', () => {
        expect(getInvoiceNetAmount({ subtotal: 100, tax: 20, total: 120 })).toBe(100);
        expect(getInvoiceNetAmount({ total: 120, tax: 20 })).toBe(100);
    });

    it('builds readable tax bucket labels', () => {
        expect(getTaxBucketLabel({ taxLabel: 'Reverse charge', taxRate: null })).toBe('Reverse charge');
        expect(getTaxBucketLabel({ taxRate: 20 })).toBe('20%');
        expect(getTaxBucketLabel({ isTaxExempt: true })).toBe('Exempt');
        expect(getTaxBucketLabel({})).toBe('Needs review');
    });

    it('normalizes expense tax-claim status from optional fields', () => {
        expect(getExpenseTaxClaimStatus({})).toBe('unclaimed');
        expect(getExpenseTaxClaimStatus({ taxClaimStatus: 'excluded' })).toBe('excluded');
        expect(getExpenseTaxClaimStatus({ taxClaimPeriodId: 'period-1' })).toBe('claimed');
    });

    it('classifies client geography relative to the business country', () => {
        expect(getClientGeographyLabel({ businessCountry: 'SI', clientCountry: 'SI' })).toBe('Domestic');
        expect(getClientGeographyLabel({ businessCountry: 'SI', clientCountry: 'DE' })).toBe('EU cross-border');
        expect(getClientGeographyLabel({ businessCountry: 'SI', clientCountry: 'US' })).toBe('Non-EU');
        expect(getClientGeographyLabel({ businessCountry: 'SI', clientCountry: null })).toBe('Needs review');
    });

    it('builds a VAT summary with sales, expenses, geography, and review counts', () => {
        const invoices = [
            {
                id: 'invoice-1',
                clientId: 'client-1',
                businessInfoId: 'business-1',
                subtotal: 100,
                tax: 20,
                total: 120,
                taxRate: 20,
                currency: 'EUR',
            },
            {
                id: 'invoice-2',
                clientId: 'client-2',
                businessInfoId: 'business-1',
                subtotal: 200,
                tax: 0,
                total: 200,
                taxLabel: 'Reverse charge',
                currency: 'EUR',
            },
        ];

        const expenses = [
            {
                id: 'expense-1',
                amount: 60,
                amountExcludingTax: 50,
                isTaxExempt: false,
                taxRate: 20,
                currency: 'EUR',
            },
            {
                id: 'expense-2',
                amount: 40,
                isTaxExempt: false,
                currency: 'EUR',
            },
            {
                id: 'expense-exempt',
                amount: 15,
                isTaxExempt: true,
                currency: 'EUR',
            },
        ];

        const clientsById = new Map([
            ['client-1', { id: 'client-1', country: 'SI' }],
            ['client-2', { id: 'client-2', country: 'DE' }],
        ]);
        const businessInfosById = new Map([
            ['business-1', { id: 'business-1', country: 'SI' }],
        ]);

        const summary = buildVatReportSummary({
            invoices,
            expenses,
            clientsById,
            businessInfosById,
        });

        expect(summary.totals.outputTax).toBe(20);
        expect(summary.totals.inputTax).toBe(10);
        expect(summary.totals.netVat).toBe(10);
        expect(summary.totalsByCurrency.outputTax).toEqual({ EUR: 20 });
        expect(summary.totalsByCurrency.inputTax).toEqual({ EUR: 10 });
        expect(summary.totalsByCurrency.netVat).toEqual({ EUR: 10 });
        expect(summary.salesBuckets).toHaveLength(2);
        expect(summary.expenseBuckets).toHaveLength(3);
        expect(summary.geographyBuckets.map((bucket) => bucket.geography)).toEqual(['Domestic', 'EU cross-border']);
        expect(summary.needsReview.missingExpenseTaxMetadata).toBe(1);
        expect(summary.needsReview.needsReviewExpenseBuckets).toBe(1);
    });

    it('sorts matching tax buckets by currency', () => {
        const summary = buildVatReportSummary({
            invoices: [
                {
                    id: 'invoice-usd',
                    clientId: 'client-1',
                    businessInfoId: 'business-1',
                    subtotal: 100,
                    tax: 20,
                    total: 120,
                    taxRate: 20,
                    currency: 'USD',
                },
                {
                    id: 'invoice-eur',
                    clientId: 'client-1',
                    businessInfoId: 'business-1',
                    subtotal: 100,
                    tax: 20,
                    total: 120,
                    taxRate: 20,
                    currency: 'EUR',
                },
            ],
            expenses: [],
            clientsById: new Map([
                ['client-1', { id: 'client-1', country: 'SI' }],
            ]),
            businessInfosById: new Map([
                ['business-1', { id: 'business-1', country: 'SI' }],
            ]),
        });

        expect(summary.salesBuckets.map((bucket) => bucket.currency)).toEqual(['EUR', 'USD']);
    });

    it('keeps VAT totals separated by source currency', () => {
        const summary = buildVatReportSummary({
            invoices: [
                {
                    id: 'invoice-eur',
                    clientId: 'client-1',
                    businessInfoId: 'business-1',
                    subtotal: 100,
                    tax: 20,
                    total: 120,
                    taxRate: 20,
                    currency: 'EUR',
                },
                {
                    id: 'invoice-usd',
                    clientId: 'client-1',
                    businessInfoId: 'business-1',
                    subtotal: 200,
                    tax: 10,
                    total: 210,
                    taxRate: 5,
                    currency: 'USD',
                },
            ],
            expenses: [
                {
                    id: 'expense-usd',
                    amount: 105,
                    amountExcludingTax: 100,
                    isTaxExempt: false,
                    taxRate: 5,
                    currency: 'USD',
                },
            ],
            clientsById: new Map([
                ['client-1', { id: 'client-1', country: 'SI' }],
            ]),
            businessInfosById: new Map([
                ['business-1', { id: 'business-1', country: 'SI' }],
            ]),
        });

        expect(summary.totalsByCurrency.outputTax).toEqual({
            EUR: 20,
            USD: 10,
        });
        expect(summary.totalsByCurrency.inputTax).toEqual({
            USD: 5,
        });
        expect(summary.totalsByCurrency.netVat).toEqual({
            EUR: 20,
            USD: 5,
        });
    });

    it('tracks claimed, unclaimed, and excluded expense tax separately', () => {
        const summary = buildVatReportSummary({
            invoices: [],
            expenses: [
                {
                    id: 'expense-claimed',
                    amount: 120,
                    amountExcludingTax: 100,
                    isTaxExempt: false,
                    taxRate: 20,
                    currency: 'EUR',
                    taxClaimStatus: 'claimed',
                    taxClaimPeriodId: 'period-1',
                },
                {
                    id: 'expense-unclaimed',
                    amount: 55,
                    amountExcludingTax: 50,
                    isTaxExempt: false,
                    taxRate: 10,
                    currency: 'EUR',
                },
                {
                    id: 'expense-excluded',
                    amount: 24,
                    amountExcludingTax: 20,
                    isTaxExempt: false,
                    taxRate: 20,
                    currency: 'EUR',
                    taxClaimStatus: 'excluded',
                },
            ],
            clientsById: new Map(),
            businessInfosById: new Map(),
        });

        expect(summary.totals.inputTax).toBe(25);
        expect(summary.totals.claimedInputTax).toBe(20);
        expect(summary.totals.unclaimedInputTax).toBe(5);
        expect(summary.totals.excludedInputTax).toBe(4);
        expect(summary.totalsByCurrency.inputTax).toEqual({ EUR: 25 });
        expect(summary.totalsByCurrency.claimedInputTax).toEqual({ EUR: 20 });
        expect(summary.totalsByCurrency.unclaimedInputTax).toEqual({ EUR: 5 });
        expect(summary.totalsByCurrency.excludedInputTax).toEqual({ EUR: 4 });
        expect(summary.claimStatusBuckets.map((row) => row.bucketLabel)).toEqual([
            'Claimed',
            'Excluded',
            'Unclaimed',
        ]);
    });

    it('derives overdue days and aging buckets for unpaid invoices', () => {
        const referenceDate = new Date('2026-05-20T12:00:00Z');

        expect(getInvoiceDaysOverdue({ dueDate: '2026-05-19', status: 'sent' }, referenceDate)).toBe(1);
        expect(getInvoiceDaysOverdue({ dueDate: '2026-05-20', status: 'sent' }, referenceDate)).toBe(0);
        expect(getInvoiceDaysOverdue({ status: 'sent' }, referenceDate)).toBe(0);
        expect(getInvoiceDaysOverdue({ dueDate: 'not-a-date', status: 'sent' }, referenceDate)).toBe(0);
        expect(getInvoiceDaysOverdue({ dueDate: '2026-05-01', status: 'paid' }, referenceDate)).toBe(0);

        expect(getOutstandingAgingBucket({ dueDate: '2026-05-25', status: 'sent' }, referenceDate)).toBe('Not due');
        expect(getOutstandingAgingBucket({ dueDate: '2026-05-10', status: 'sent' }, referenceDate)).toBe('1-30 days');
        expect(getOutstandingAgingBucket({ dueDate: '2026-04-01', status: 'sent' }, referenceDate)).toBe('31-60 days');
        expect(getOutstandingAgingBucket({ dueDate: '2026-02-25', status: 'sent' }, referenceDate)).toBe('61-90 days');
        expect(getOutstandingAgingBucket({ dueDate: '2025-12-31', status: 'sent' }, referenceDate)).toBe('90+ days');
        expect(getOutstandingAgingBucket({ status: 'sent' }, referenceDate)).toBe('Needs review');
    });

    it('builds outstanding aging totals by bucket and currency', () => {
        const summary = buildOutstandingInvoiceSummary([
            {
                id: 'invoice-not-due',
                dueDate: '2099-01-01',
                status: 'sent',
                total: 100,
                currency: 'EUR',
            },
            {
                id: 'invoice-overdue',
                dueDate: '2026-05-01',
                status: 'sent',
                total: 50,
                currency: 'EUR',
            },
            {
                id: 'invoice-old',
                dueDate: '2026-01-01',
                status: 'sent',
                total: 75,
                currency: 'USD',
            },
            {
                id: 'invoice-no-due-date',
                status: 'sent',
                total: 20,
                currency: 'EUR',
            },
            {
                id: 'invoice-paid',
                dueDate: '2026-05-01',
                status: 'paid',
                total: 999,
                currency: 'EUR',
            },
        ], new Date('2026-05-20T12:00:00Z'));

        expect(summary).toEqual([
            { bucketLabel: 'Needs review', currency: 'EUR', total: 20, count: 1 },
            { bucketLabel: 'Not due', currency: 'EUR', total: 100, count: 1 },
            { bucketLabel: '1-30 days', currency: 'EUR', total: 50, count: 1 },
            { bucketLabel: '90+ days', currency: 'USD', total: 75, count: 1 },
        ]);
    });

    it('sorts outstanding buckets with matching bucket order by currency', () => {
        const summary = buildOutstandingInvoiceSummary([
            {
                id: 'invoice-usd',
                dueDate: '2026-05-01',
                status: 'sent',
                total: 50,
                currency: 'USD',
            },
            {
                id: 'invoice-eur',
                dueDate: '2026-05-01',
                status: 'sent',
                total: 50,
                currency: 'EUR',
            },
        ], new Date('2026-05-20T12:00:00Z'));

        expect(summary.map((row) => row.currency)).toEqual(['EUR', 'USD']);
    });

    it('builds expense totals for gross, net, and VAT amounts', () => {
        const summary = buildExpenseTotalsSummary([
            {
                amount: 120,
                amountExcludingTax: 100,
                isTaxExempt: false,
                taxRate: 20,
                currency: 'EUR',
            },
            {
                amount: 50,
                isTaxExempt: true,
                currency: 'EUR',
            },
            {
                amount: 40,
                isTaxExempt: false,
                currency: 'USD',
            },
        ]);

        expect(summary.grossByCurrency).toEqual({ EUR: 170, USD: 40 });
        expect(summary.netByCurrency).toEqual({ EUR: 150, USD: 40 });
        expect(summary.taxByCurrency).toEqual({ EUR: 20, USD: 0 });
        expect(summary.missingTaxMetadataCount).toBe(1);
        expect(summary.count).toBe(3);
    });

    it('builds a client statement with opening balance, issued invoices, payments, and closing balance', () => {
        const summary = buildClientStatementSummary({
            startDate: '2026-04-01',
            endDate: '2026-04-30',
            referenceDate: new Date('2026-04-30T23:59:59Z'),
            invoices: [
                {
                    id: 'opening-unpaid',
                    invoiceNumber: 'INV-OPEN',
                    date: '2026-03-15',
                    dueDate: '2026-03-30',
                    status: 'sent',
                    total: 100,
                    currency: 'EUR',
                },
                {
                    id: 'opening-paid-in-range',
                    invoiceNumber: 'INV-PAID',
                    date: '2026-03-20',
                    dueDate: '2026-04-05',
                    status: 'paid',
                    total: 80,
                    currency: 'EUR',
                    paidAt: new Date('2026-04-10T10:00:00Z').getTime(),
                },
                {
                    id: 'paid-before-range',
                    invoiceNumber: 'INV-BEFORE',
                    date: '2026-03-01',
                    status: 'paid',
                    total: 60,
                    currency: 'EUR',
                    paidAt: new Date('2026-03-15T10:00:00Z').getTime(),
                },
                {
                    id: 'issued-in-range',
                    invoiceNumber: 'INV-APR',
                    date: '2026-04-12',
                    dueDate: '2026-04-26',
                    status: 'sent',
                    total: 120,
                    currency: 'EUR',
                },
                {
                    id: 'issued-and-paid-in-range',
                    invoiceNumber: 'INV-APR-PAID',
                    date: '2026-04-05',
                    dueDate: '2026-04-12',
                    status: 'paid',
                    total: 40,
                    currency: 'USD',
                    paidAt: new Date('2026-04-20T10:00:00Z').getTime(),
                },
                {
                    id: 'legacy-paid-in-range',
                    invoiceNumber: 'INV-LEGACY',
                    date: '2026-04-15',
                    dueDate: '2026-04-25',
                    status: 'paid',
                    total: 70,
                    currency: 'EUR',
                },
            ],
        });

        expect(summary.openingBalanceInvoices.map((invoice) => invoice.invoiceNumber)).toEqual(['INV-OPEN', 'INV-PAID']);
        expect(summary.invoicesIssuedInRange.map((invoice) => invoice.invoiceNumber)).toEqual(['INV-APR-PAID', 'INV-APR', 'INV-LEGACY']);
        expect(summary.paymentsRecordedInRange.map((invoice) => invoice.invoiceNumber)).toEqual(['INV-PAID', 'INV-LEGACY', 'INV-APR-PAID']);
        expect(summary.outstandingInvoices.map((invoice) => invoice.invoiceNumber)).toEqual(['INV-OPEN', 'INV-APR']);
        expect(summary.totalsByCurrency.openingBalance).toEqual({ EUR: 180 });
        expect(summary.totalsByCurrency.issued).toEqual({ EUR: 190, USD: 40 });
        expect(summary.totalsByCurrency.payments).toEqual({ EUR: 150, USD: 40 });
        expect(summary.totalsByCurrency.closingBalance).toEqual({ EUR: 220 });
    });

    it('builds a project work summary grouped by task', () => {
        const summary = buildProjectWorkSummary([
            {
                id: 'entry-1',
                taskId: 'task-1',
                start: new Date('2026-04-10T08:00:00Z').getTime(),
                end: new Date('2026-04-10T09:00:00Z').getTime(),
                note: 'Initial setup',
                task: {
                    id: 'task-1',
                    title: 'Setup',
                    billable: true,
                },
            },
            {
                id: 'entry-2',
                taskId: 'task-1',
                start: new Date('2026-04-10T09:00:00Z').getTime(),
                end: new Date('2026-04-10T10:30:00Z').getTime(),
                task: {
                    id: 'task-1',
                    title: 'Setup',
                    billable: true,
                },
            },
            {
                id: 'entry-3',
                taskId: 'task-2',
                start: new Date('2026-04-11T10:00:00Z').getTime(),
                end: new Date('2026-04-11T11:00:00Z').getTime(),
                note: 'Internal review',
                task: {
                    id: 'task-2',
                    title: 'Review',
                    billable: false,
                },
            },
        ]);

        expect(summary.rows).toHaveLength(2);
        expect(summary.rows[0].taskTitle).toBe('Setup');
        expect(summary.rows[0].actualMs).toBe((2.5 * 60 * 60 * 1000));
        expect(summary.rows[0].billableMs).toBe((2.5 * 60 * 60 * 1000));
        expect(summary.rows[0].notesCount).toBe(1);
        expect(summary.rows[1].taskTitle).toBe('Review');
        expect(summary.rows[1].billableMs).toBe(0);
        expect(summary.totals.actualMs).toBe((3.5 * 60 * 60 * 1000));
        expect(summary.totals.billableMs).toBe((2.5 * 60 * 60 * 1000));
        expect(summary.totals.entriesCount).toBe(3);
        expect(summary.totals.notesCount).toBe(2);
        expect(summary.totals.tasksCount).toBe(2);
    });

    it('builds an invoice register summary by status, client, business, and currency', () => {
        const summary = buildInvoiceRegisterSummary({
            invoices: [
                {
                    id: 'invoice-1',
                    clientId: 'client-1',
                    businessInfoId: 'business-1',
                    status: 'paid',
                    paidAt: new Date('2026-04-20T10:00:00Z').getTime(),
                    subtotal: 100,
                    tax: 20,
                    total: 120,
                    currency: 'EUR',
                },
                {
                    id: 'invoice-2',
                    clientId: 'client-2',
                    businessInfoId: 'business-1',
                    status: 'sent',
                    dueDate: '2099-01-01',
                    subtotal: 200,
                    tax: 40,
                    total: 240,
                    currency: 'EUR',
                },
                {
                    id: 'invoice-3',
                    clientId: 'client-1',
                    businessInfoId: 'business-2',
                    status: 'sent',
                    dueDate: '2026-04-01',
                    subtotal: 50,
                    tax: 0,
                    total: 50,
                    currency: 'USD',
                },
                {
                    id: 'invoice-4',
                    clientId: null,
                    businessInfoId: null,
                    status: 'sent',
                    dueDate: '2099-01-01',
                    subtotal: 10,
                    tax: 0,
                    total: 10,
                },
            ],
            clientsById: new Map([
                ['client-1', { id: 'client-1', title: 'Acme' }],
                ['client-2', { id: 'client-2', title: 'Globex' }],
            ]),
            businessInfosById: new Map([
                ['business-1', { id: 'business-1', businessName: 'TaskTime Studio' }],
                ['business-2', { id: 'business-2', businessName: 'Other Studio' }],
            ]),
        });

        expect(summary.totalsByStatus.map((row) => row.label)).toEqual(['sent', 'paid', 'overdue']);
        expect(summary.totalsByClient[0]).toEqual({
            label: 'Acme',
            count: 2,
            totalByCurrency: { EUR: 120, USD: 50 },
        });
        expect(summary.totalsByBusiness[0]).toEqual({
            label: 'TaskTime Studio',
            count: 2,
            totalByCurrency: { EUR: 360 },
        });
        expect(summary.totalsByCurrency).toEqual([
            { currency: 'EUR', count: 3, subtotal: 310, tax: 60, total: 370 },
            { currency: 'USD', count: 1, subtotal: 50, tax: 0, total: 50 },
        ]);
    });
});
