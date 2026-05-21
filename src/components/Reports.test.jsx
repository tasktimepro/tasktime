import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Reports from './Reports';

const mockUpdateUrl = vi.fn();
const mockBuildCsvContent = vi.fn(() => 'csv-content');
const mockDownloadCsvFile = vi.fn();
const mockDownloadZipFile = vi.fn(() => Promise.resolve());
const mockExportMonthlyReportPdf = vi.fn(() => Promise.resolve());
const mockExportInvoicesReportPdf = vi.fn(() => Promise.resolve());
const mockExportOutstandingReportPdf = vi.fn(() => Promise.resolve());
const mockExportExpensesReportPdf = vi.fn(() => Promise.resolve());
const mockGeneratePdfBlob = vi.fn(() => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' })));
const mockTaxReturnPeriods = [
    {
        id: 'period-1',
        title: 'April 2026 VAT return',
        type: 'vat',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        status: 'draft',
    },
];
let mockSection = null;

vi.mock('@/hooks/useUrlState.ts', () => ({
    useUrlState: () => ({
        urlParams: {
            section: mockSection,
        },
        updateUrl: mockUpdateUrl,
    }),
}));

vi.mock('@/hooks/useInvoices.ts', () => ({
    useInvoices: () => ({
        invoices: [
            {
                id: 'invoice-1',
                projectId: 'project-1',
                clientId: 'client-1',
                businessInfoId: 'business-1',
                invoiceNumber: 'INV-001',
                date: '2026-04-12',
                dueDate: '2026-04-26',
                status: 'paid',
                subtotal: 1000,
                tax: 220,
                total: 1220,
                currency: 'EUR',
                paidAt: new Date('2026-04-20T10:00:00Z').getTime(),
            },
            {
                id: 'invoice-2',
                projectId: 'project-1',
                clientId: 'client-1',
                businessInfoId: 'business-1',
                invoiceNumber: 'INV-002',
                date: '2026-04-16',
                dueDate: '2026-04-01',
                status: 'sent',
                subtotal: 200,
                tax: 44,
                total: 244,
                currency: 'EUR',
            },
            {
                id: 'invoice-3',
                projectId: 'project-1',
                clientId: 'client-1',
                invoiceNumber: 'INV-003',
                date: '2026-04-18',
                dueDate: '2099-01-01',
                status: 'sent',
                subtotal: 300,
                tax: 66,
                total: 366,
                currency: 'EUR',
            },
        ],
    }),
}));

vi.mock('@/hooks/useExpenses.ts', () => ({
    useExpenses: () => ({
        expenses: [
            {
                id: 'expense-1',
                title: 'Hosting',
                date: '2026-04-08',
                supplierName: 'Cloud Host',
                currency: 'EUR',
                amount: 120,
                paidOn: '2026-04-09',
                paymentStatus: 'paid',
                projectId: 'project-1',
                clientId: 'client-1',
                businessId: 'business-1',
                isPersonal: false,
                billable: false,
                billingStatus: 'unbilled',
                isRecurring: false,
                isTaxExempt: false,
                amountExcludingTax: 100,
                taxRate: 20,
            },
        ],
        markManyAsClaimed: vi.fn(),
        markManyAsUnclaimed: vi.fn(),
    }),
}));

vi.mock('@/hooks/useTimeEntries.ts', () => ({
    useTimeEntries: () => ({
        entries: [
            {
                id: 'entry-1',
                taskId: 'task-1',
                start: new Date('2026-04-10T08:00:00Z').getTime(),
                end: new Date('2026-04-10T10:00:00Z').getTime(),
                billedInvoiceId: null,
            },
        ],
        isLoadingMore: false,
    }),
}));

vi.mock('@/hooks/useTasks.ts', () => ({
    useTasks: () => ({
        activeTasks: [
            {
                id: 'task-1',
                projectId: 'project-1',
                title: 'Build report shell',
                billable: true,
            },
        ],
        archivedTasks: [],
    }),
}));

vi.mock('@/hooks/useProjects.ts', () => ({
    useProjects: () => ({
        projects: [
            {
                id: 'project-1',
                title: 'TaskTime',
                preferredClientId: 'client-1',
                hourlyRate: 100,
            },
        ],
    }),
}));

vi.mock('@/hooks/useClients.ts', () => ({
    useClients: () => ({
        clients: [
            {
                id: 'client-1',
                title: 'Acme',
                country: 'SI',
            },
            {
                id: 'client-2',
                title: 'Globex',
                country: 'DE',
            },
        ],
    }),
}));

vi.mock('@/hooks/useBusinessInfos.ts', () => ({
    useBusinessInfos: () => ({
        businessInfos: [
            {
                id: 'business-1',
                businessName: 'TaskTime Studio',
                country: 'SI',
            },
        ],
    }),
}));

vi.mock('@/hooks/useExpenseCategories.ts', () => ({
    useExpenseCategories: () => ({
        expenseCategories: [
            {
                id: 'category-1',
                name: 'Software & subscriptions',
            },
        ],
        allExpenseCategories: [
            {
                id: 'category-1',
                name: 'Software & subscriptions',
            },
        ],
    }),
}));

vi.mock('@/hooks/useTaxReturnPeriods.ts', () => ({
    useTaxReturnPeriods: () => ({
        taxReturnPeriods: mockTaxReturnPeriods,
        createTaxReturnPeriod: vi.fn(() => ({
            id: 'period-created',
            title: 'Created period',
            type: 'vat',
            startDate: '2026-04-01',
            endDate: '2026-04-30',
            status: 'draft',
        })),
    }),
}));

vi.mock('@/hooks/useToast.ts', () => ({
    useToast: () => ({
        showError: vi.fn(),
        showSuccess: vi.fn(),
    }),
}));

vi.mock('@/hooks/useIsMobileLayout', () => ({
    default: () => false,
}));

vi.mock('@/components/dashboard/hooks/useCurrencyConversion', () => ({
    default: () => ({
        preferredCurrency: 'EUR',
        convertToCurrency: (amountsByCurrency) => ({
            amounts: amountsByCurrency,
            hadConversionError: false,
        }),
        exchangeRatesError: null,
        missingExchangeRates: [],
    }),
}));

vi.mock('@/utils/reportCsvUtils', () => ({
    buildCsvContent: (...args) => mockBuildCsvContent(...args),
    downloadCsvFile: (...args) => mockDownloadCsvFile(...args),
}));

vi.mock('@/utils/reportZipUtils', () => ({
    downloadZipFile: (...args) => mockDownloadZipFile(...args),
}));

vi.mock('@/utils/reportPdfUtils', () => ({
    buildMonthlyReportHtml: vi.fn(() => '<html>monthly report</html>'),
    exportClientStatementPdf: vi.fn(() => Promise.resolve()),
    exportExpensesReportPdf: (...args) => mockExportExpensesReportPdf(...args),
    exportInvoicesReportPdf: (...args) => mockExportInvoicesReportPdf(...args),
    exportMonthlyReportPdf: (...args) => mockExportMonthlyReportPdf(...args),
    exportOutstandingReportPdf: (...args) => mockExportOutstandingReportPdf(...args),
    exportProjectWorkSummaryPdf: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/utils/pdfUtils.ts', () => ({
    generatePDFBlob: (...args) => mockGeneratePdfBlob(...args),
    getCurrentInvoiceHtmlContent: (invoice) => `<html>${invoice.invoiceNumber}</html>`,
}));

describe('Reports', () => {
    beforeEach(() => {
        mockUpdateUrl.mockReset();
        mockBuildCsvContent.mockClear();
        mockDownloadCsvFile.mockClear();
        mockDownloadZipFile.mockClear();
        mockExportMonthlyReportPdf.mockClear();
        mockExportInvoicesReportPdf.mockClear();
        mockExportOutstandingReportPdf.mockClear();
        mockExportExpensesReportPdf.mockClear();
        mockGeneratePdfBlob.mockClear();
        mockTaxReturnPeriods.splice(0, mockTaxReturnPeriods.length, {
            id: 'period-1',
            title: 'April 2026 VAT return',
            type: 'vat',
            startDate: '2026-04-01',
            endDate: '2026-04-30',
            status: 'draft',
        });
        mockSection = null;
    });

    it('renders the reports dashboard with last month selected by default', async () => {
        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
        expect(screen.getByText('Revenue Issued')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Report period' })).toHaveTextContent('Last Month');

        await waitFor(() => {
            expect(mockUpdateUrl).toHaveBeenCalledWith({ section: 'overview' });
        });
    });

    it('renders the VAT summary tab with tax buckets and geography breakdown', () => {
        mockSection = 'tax';

        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'VAT / tax summary' })).toBeInTheDocument();
        expect(screen.getByText('Sales buckets')).toBeInTheDocument();
        expect(screen.getByText('Expense buckets')).toBeInTheDocument();
        expect(screen.getByText('Claim status')).toBeInTheDocument();
        expect(screen.getByText('Client geography')).toBeInTheDocument();
        expect(screen.getByText('20%')).toBeInTheDocument();
        expect(screen.getByText('Domestic')).toBeInTheDocument();
    });

    it('exports a monthly CSV pack from the current filtered slice', () => {
        mockSection = 'monthly';

        render(<Reports />);

        fireEvent.click(screen.getByRole('button', { name: 'Export CSV pack' }));

        expect(mockDownloadZipFile).toHaveBeenCalledTimes(1);
        expect(mockDownloadZipFile).toHaveBeenCalledWith(
            'monthly-csv-pack-2026-04-01-to-2026-04-30.zip',
            expect.arrayContaining([
                expect.objectContaining({
                    filename: 'monthly-summary-2026-04-01-to-2026-04-30.csv',
                    content: 'csv-content',
                }),
                expect.objectContaining({
                    filename: 'monthly-invoices-2026-04-01-to-2026-04-30.csv',
                    content: 'csv-content',
                }),
            ]),
        );
    });

    it('exports an accountant pack from the current filtered slice', async () => {
        mockSection = 'monthly';

        render(<Reports />);

        fireEvent.click(screen.getByRole('button', { name: 'Export accountant pack' }));

        await waitFor(() => {
            expect(mockDownloadZipFile).toHaveBeenCalledTimes(1);
            expect(mockGeneratePdfBlob).toHaveBeenCalledTimes(4);
        });

        expect(mockDownloadZipFile).toHaveBeenCalledWith(
            'accountant-pack.zip',
            expect.arrayContaining([
                expect.objectContaining({ filename: 'accountant-pack-manifest.csv' }),
                expect.objectContaining({ filename: 'invoices.csv' }),
                expect.objectContaining({ filename: 'expenses.csv' }),
                expect.objectContaining({ filename: 'time-entries.csv' }),
                expect.objectContaining({ filename: 'tax-summary.csv' }),
                expect.objectContaining({ filename: 'review-checklist.csv' }),
                expect.objectContaining({ filename: 'monthly-summary.pdf' }),
                expect.objectContaining({ filename: 'invoice-INV-001.pdf' }),
                expect.objectContaining({ filename: 'invoice-INV-002.pdf' }),
                expect.objectContaining({ filename: 'invoice-INV-003.pdf' }),
            ]),
        );
    });

    it('renders the monthly tab with a needs review checklist', () => {
        mockSection = 'monthly';

        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'Monthly summary' })).toBeInTheDocument();
        expect(screen.getByText('Needs review')).toBeInTheDocument();
        expect(screen.getByText('Invoices without business profile')).toBeInTheDocument();
    });

    it('renders the invoices tab with register summaries', () => {
        mockSection = 'invoices';

        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'Issued invoices' })).toBeInTheDocument();
        expect(screen.getByText('By status')).toBeInTheDocument();
        expect(screen.getByText('By client')).toBeInTheDocument();
        expect(screen.getByText('By business')).toBeInTheDocument();
        expect(screen.getByText('By currency')).toBeInTheDocument();
    });

    it('renders the client statement tab when the current slice resolves to one client', () => {
        mockSection = 'statement';

        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'Client statement' })).toBeInTheDocument();
        expect(screen.getAllByText('Opening balance').length).toBeGreaterThan(0);
        expect(screen.getByText('Invoices issued in period')).toBeInTheDocument();
        expect(screen.getAllByText('Payments recorded').length).toBeGreaterThan(0);
        expect(screen.getByText('Outstanding at statement date')).toBeInTheDocument();
        expect(screen.getAllByText('INV-002').length).toBeGreaterThan(0);
    });

    it('renders the project work summary tab when the current slice resolves to one project', () => {
        mockSection = 'work-summary';

        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'Project work summary' })).toBeInTheDocument();
        expect(screen.getByText('Tasks')).toBeInTheDocument();
        expect(screen.getByText('Build report shell')).toBeInTheDocument();
        expect(screen.getByText('Estimated billable amount')).toBeInTheDocument();
    });

    it('renders the outstanding aging tab with bucket summaries', () => {
        mockSection = 'outstanding';

        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'Outstanding / aging' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
        expect(screen.getByText('Aging buckets')).toBeInTheDocument();
        expect(screen.getByText('Outstanding invoices')).toBeInTheDocument();
        expect(screen.getByText('1-30 days')).toBeInTheDocument();
        expect(screen.getByText('Not due')).toBeInTheDocument();
        expect(screen.getByText('INV-002')).toBeInTheDocument();
    });

    it('renders expense totals with ex VAT, VAT amount, and inc VAT', () => {
        mockSection = 'expenses';

        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'Expenses', level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument();
        expect(screen.getByText('Ex VAT')).toBeInTheDocument();
        expect(screen.getByText('VAT amount')).toBeInTheDocument();
        expect(screen.getByText('Inc VAT')).toBeInTheDocument();
        expect(screen.getByText('Hosting')).toBeInTheDocument();
    });

    it('uses the shared native date inputs in the claim period modal', async () => {
        mockSection = 'expenses';
        mockTaxReturnPeriods.splice(0, mockTaxReturnPeriods.length);

        render(<Reports />);

        fireEvent.click(screen.getByLabelText('Select Hosting'));
        fireEvent.click(screen.getByRole('button', { name: 'Mark selected as claimed' }));

        const startDateInput = await screen.findByLabelText('Start date');
        const endDateInput = screen.getByLabelText('End date');

        expect(startDateInput).toHaveClass('native-date-input-field');
        expect(endDateInput).toHaveClass('native-date-input-field');
        expect(screen.getAllByRole('button', { name: 'Open date picker' })).toHaveLength(2);
    });
});
