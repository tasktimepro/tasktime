import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
let mockIsMobileLayout = false;
const createDefaultInvoices = () => [
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
];
const createDefaultExpenses = () => [
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
];
const mockInvoices = createDefaultInvoices();
const mockExpenses = createDefaultExpenses();
const mockConvertToCurrency = vi.fn((amountsByCurrency) => ({
    amounts: amountsByCurrency,
    hadConversionError: false,
}));
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
let mockLoadingHistoricalEntries = false;
const mockBusinessBrandAssets = [];

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
        invoices: mockInvoices,
    }),
}));

vi.mock('@/hooks/useBusinessBrandAssets.ts', () => ({
    useBusinessBrandAssets: () => ({
        businessBrandAssets: mockBusinessBrandAssets,
    }),
}));

vi.mock('@/hooks/useExpenses.ts', () => ({
    useExpenses: () => ({
        expenses: mockExpenses,
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
        isLoadingMore: mockLoadingHistoricalEntries,
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
    default: () => mockIsMobileLayout,
}));

vi.mock('@/components/dashboard/hooks/useCurrencyConversion', () => ({
    default: () => ({
        preferredCurrency: 'EUR',
        convertToCurrency: mockConvertToCurrency,
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
        mockIsMobileLayout = false;
        mockUpdateUrl.mockReset();
        mockBuildCsvContent.mockClear();
        mockDownloadCsvFile.mockClear();
        mockDownloadZipFile.mockClear();
        mockExportMonthlyReportPdf.mockClear();
        mockExportInvoicesReportPdf.mockClear();
        mockExportOutstandingReportPdf.mockClear();
        mockExportExpensesReportPdf.mockClear();
        mockGeneratePdfBlob.mockClear();
        mockConvertToCurrency.mockReset();
        mockConvertToCurrency.mockImplementation((amountsByCurrency) => ({
            amounts: amountsByCurrency,
            hadConversionError: false,
        }));
        mockInvoices.splice(0, mockInvoices.length, ...createDefaultInvoices());
        mockExpenses.splice(0, mockExpenses.length, ...createDefaultExpenses());
        mockTaxReturnPeriods.splice(0, mockTaxReturnPeriods.length, {
            id: 'period-1',
            title: 'April 2026 VAT return',
            type: 'vat',
            startDate: '2026-04-01',
            endDate: '2026-04-30',
            status: 'draft',
        });
        mockLoadingHistoricalEntries = false;
        mockSection = null;
    });

    it('keeps a centered loader visible until historical entries finish loading and the report content has painted', async () => {
        vi.useFakeTimers();

        const onReadyChange = vi.fn();

        const originalRequestAnimationFrame = window.requestAnimationFrame;
        const originalCancelAnimationFrame = window.cancelAnimationFrame;

        window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(performance.now()), 16);
        window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);

        try {
            mockLoadingHistoricalEntries = true;

            const { rerender } = render(<Reports onReadyChange={onReadyChange} />);

            expect(onReadyChange).toHaveBeenLastCalledWith(false);

            mockLoadingHistoricalEntries = false;
            rerender(<Reports onReadyChange={onReadyChange} />);

            expect(onReadyChange).toHaveBeenLastCalledWith(false);

            act(() => {
                vi.runAllTimers();
            });

            expect(onReadyChange).toHaveBeenLastCalledWith(true);
        } finally {
            window.requestAnimationFrame = originalRequestAnimationFrame;
            window.cancelAnimationFrame = originalCancelAnimationFrame;
            vi.useRealTimers();
        }
    });

    it('renders the reports dashboard with last month selected by default', async () => {
        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
        expect(screen.getByText('Issued')).toBeInTheDocument();
        expect(screen.getByText('Received')).toBeInTheDocument();
        expect(screen.getByText('Estimated Profit')).toBeInTheDocument();
        expect(screen.getByText('Hours Worked')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Report period' })).toHaveTextContent('Last Month');

        await waitFor(() => {
            expect(mockUpdateUrl).toHaveBeenCalledWith({ section: 'overview' });
        });
    });

    it('counts paid invoices without paidAt in the overview received totals', () => {
        mockInvoices.splice(0, mockInvoices.length,
            {
                id: 'invoice-legacy-paid',
                projectId: 'project-1',
                clientId: 'client-1',
                businessInfoId: 'business-1',
                invoiceNumber: 'INV-LEGACY',
                date: '2026-04-12',
                dueDate: '2026-04-26',
                status: 'paid',
                subtotal: 1000,
                tax: 220,
                total: 1220,
                currency: 'EUR',
            },
        );

        render(<Reports />);

        const receivedCard = screen.getByRole('heading', { name: 'Received' }).closest('div.rounded-lg');
        const estimatedProfitCard = screen.getByRole('heading', { name: 'Estimated Profit' }).closest('div.rounded-lg');

        expect(within(receivedCard).getByText('€1220.00')).toBeInTheDocument();
        expect(within(receivedCard).getByText('1 invoice paid')).toBeInTheDocument();
        expect(within(estimatedProfitCard).getByText('€1100.00')).toBeInTheDocument();
    });

    it('shows review issues as a header tag and opens details on click', () => {
        render(<Reports />);

        expect(screen.queryByText('Some records need review')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Needs review: 1 record' }));

        expect(screen.getByRole('heading', { name: 'Records needing review' })).toBeInTheDocument();
        expect(screen.getByText('Invoices without business profile')).toBeInTheDocument();
    });

    it('keeps the period picker inline, exposes the remaining report filters from More filters, and resets them to defaults', () => {
        render(<Reports />);

        expect(screen.getByRole('button', { name: 'Report period' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'More filters' })).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'Business filter' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Report period' }));
        fireEvent.click(screen.getByRole('button', { name: 'This Month' }));

        fireEvent.pointerDown(screen.getByRole('button', { name: 'More filters' }), {
            button: 0,
            clientX: 24,
            clientY: 24,
            ctrlKey: false,
            pointerType: 'mouse',
        });

        expect(screen.getByRole('combobox', { name: 'Business filter' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Client filter' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Project filter' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Expense status filter' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Expense date filter' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Category filter' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Currency display filter' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Invoice status filter' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Income date filter' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('combobox', { name: 'Expense status filter' }));
        fireEvent.click(screen.getByRole('option', { name: 'Paid only' }));

        fireEvent.click(screen.getByRole('combobox', { name: 'Currency display filter' }));
        fireEvent.click(screen.getByRole('option', { name: 'Source currencies' }));

        expect(document.querySelector('button[aria-label="Report period"]')).toHaveTextContent('This Month');
        expect(screen.getByRole('combobox', { name: 'Expense status filter' })).toHaveTextContent('Paid only');
        expect(screen.getByRole('combobox', { name: 'Currency display filter' })).toHaveTextContent('Source currencies');

        fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));

        expect(document.querySelector('button[aria-label="Report period"]')).toHaveTextContent('Last Month');
        expect(screen.getByRole('combobox', { name: 'Expense status filter' })).toHaveTextContent('All expenses');
        expect(screen.getByRole('combobox', { name: 'Currency display filter' })).toHaveTextContent('Preferred currency');
        expect(screen.getByRole('combobox', { name: 'Invoice status filter' })).toHaveTextContent('Non-draft invoices');
        expect(screen.getByRole('combobox', { name: 'Income date filter' })).toHaveTextContent('Income by invoice date');
    });

    it('uses a horizontally scrollable tab strip on mobile', () => {
        mockIsMobileLayout = true;

        render(<Reports />);

        const tabList = screen.getByRole('tablist');

        expect(tabList.parentElement.className.includes('overflow-x-auto')).toBe(true);
        expect(tabList.className.includes('flex-nowrap')).toBe(true);
        expect(screen.getByRole('tab', { name: 'Overview' }).className.includes('shrink-0')).toBe(true);
    });

    it('keeps desktop tab overflow inside the tab strip instead of the page', () => {
        render(<Reports />);

        const tabList = screen.getByRole('tablist');

        expect(tabList.parentElement.className.includes('overflow-x-auto')).toBe(true);
        expect(tabList.className.includes('flex-nowrap')).toBe(true);
        expect(screen.getByRole('tab', { name: 'Overview' }).className.includes('shrink-0')).toBe(true);
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
        expect(screen.getByText('Payments Received')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Needs review' })).toBeInTheDocument();
        expect(screen.getByText('Invoices without business profile')).toBeInTheDocument();
    });

    it('renders summary lines as a separate section above the monthly breakdown columns', () => {
        mockSection = 'monthly';

        render(<Reports />);

        const summaryHeading = screen.getByRole('heading', { name: 'Summary lines' });
        const topClientsHeading = screen.getByRole('heading', { name: 'Top clients' });
        const summarySection = summaryHeading.closest('section');
        const summaryGrid = summaryHeading.nextElementSibling;

        expect(summarySection).not.toBeNull();
        expect(summaryGrid?.className).toContain('grid');
        expect(summaryGrid?.className).toContain('sm:grid-cols-2');
        expect(summaryGrid?.className).toContain('xl:grid-cols-3');
        expect(summarySection?.compareDocumentPosition(topClientsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('keeps monthly derived totals and breakdowns consistent when currencies are mixed', () => {
        mockSection = 'monthly';
        mockInvoices.splice(0, mockInvoices.length,
            {
                id: 'invoice-eur',
                projectId: 'project-1',
                clientId: 'client-1',
                businessInfoId: 'business-1',
                invoiceNumber: 'INV-EUR',
                date: '2026-04-10',
                dueDate: '2026-04-20',
                status: 'paid',
                subtotal: 80,
                tax: 20,
                total: 100,
                currency: 'EUR',
                paidAt: new Date('2026-04-12T10:00:00Z').getTime(),
            },
            {
                id: 'invoice-usd',
                projectId: 'project-1',
                clientId: 'client-1',
                businessInfoId: 'business-1',
                invoiceNumber: 'INV-USD',
                date: '2026-04-11',
                dueDate: '2026-04-21',
                status: 'paid',
                subtotal: 80,
                tax: 20,
                total: 100,
                currency: 'USD',
                paidAt: new Date('2026-04-13T10:00:00Z').getTime(),
            },
        );
        mockExpenses.splice(0, mockExpenses.length,
            {
                id: 'expense-eur',
                title: 'Hosting EUR',
                date: '2026-04-08',
                currency: 'EUR',
                amount: 50,
                amountExcludingTax: 40,
                paidOn: '2026-04-09',
                paymentStatus: 'paid',
                projectId: 'project-1',
                clientId: 'client-1',
                businessId: 'business-1',
                isTaxExempt: false,
            },
            {
                id: 'expense-usd',
                title: 'Hosting USD',
                date: '2026-04-09',
                currency: 'USD',
                amount: 10,
                amountExcludingTax: 6,
                paidOn: '2026-04-10',
                paymentStatus: 'paid',
                projectId: 'project-1',
                clientId: 'client-1',
                businessId: 'business-1',
                isTaxExempt: false,
            },
        );
        mockConvertToCurrency.mockImplementation((amountsByCurrency) => {
            const total = (amountsByCurrency.EUR || 0) + ((amountsByCurrency.USD || 0) * 0.5);

            return {
                amounts: { EUR: total },
                hadConversionError: false,
            };
        });

        render(<Reports />);

        expect(screen.getByText('Payments Received')).toBeInTheDocument();
        expect(screen.getAllByText('€150.00').length).toBeGreaterThan(0);
        expect(screen.getAllByText('€55.00').length).toBeGreaterThan(0);
        expect(screen.getAllByText('€95.00').length).toBeGreaterThan(0);
        expect(screen.getAllByText('€18.00').length).toBeGreaterThan(0);
        expect(within(screen.getByRole('heading', { name: 'Top clients' }).parentElement).getByText('€150.00')).toBeInTheDocument();
        expect(screen.queryByText('€140.00')).not.toBeInTheDocument();
    });

    it('keeps uninvoiced work totals and exports consistent when billable expenses use another currency', () => {
        mockSection = 'to-invoice';
        mockExpenses.splice(0, mockExpenses.length,
            {
                id: 'billable-expense-usd',
                title: 'Billable Hosting',
                date: '2026-04-08',
                currency: 'USD',
                amount: 10,
                amountExcludingTax: 10,
                paidOn: '2026-04-09',
                paymentStatus: 'paid',
                projectId: 'project-1',
                clientId: 'client-1',
                businessId: 'business-1',
                billable: true,
                billingStatus: 'unbilled',
                isTaxExempt: true,
            },
        );
        mockConvertToCurrency.mockImplementation((amountsByCurrency) => {
            const total = (amountsByCurrency.EUR || 0) + ((amountsByCurrency.USD || 0) * 0.5);

            return {
                amounts: { EUR: total },
                hadConversionError: false,
            };
        });

        render(<Reports />);

        expect(screen.getByRole('heading', { name: 'To invoice' })).toBeInTheDocument();
        expect(screen.getByText('€205.00')).toBeInTheDocument();
        expect(screen.getByText('Time €200.00')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

        expect(mockBuildCsvContent).toHaveBeenCalledWith(
            expect.any(Array),
            expect.arrayContaining([
                expect.objectContaining({
                    expenseAmount: '€5.00',
                    estimatedAmount: '€200.00',
                }),
            ]),
        );
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
