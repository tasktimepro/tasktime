import { describe, expect, it } from 'vitest';
import { ACCOUNTANT_PACK_MANIFEST_COLUMNS, buildAccountantPackManifestRows } from './reportPackUtils';

describe('reportPackUtils', () => {
    it('defines stable accountant-pack manifest columns', () => {
        expect(ACCOUNTANT_PACK_MANIFEST_COLUMNS.map((column) => column.header)).toEqual([
            'Category',
            'File Name',
            'Description',
            'Record Count',
        ]);
    });

    it('builds manifest rows for csv, report pdf, and invoice pdf files', () => {
        const rows = buildAccountantPackManifestRows({
            csvFiles: [
                {
                    filename: 'invoices.csv',
                    columns: [],
                    rows: [{ id: 'invoice-1' }],
                },
                {
                    filename: 'time-entries.csv',
                    columns: [],
                    rows: [{ id: 'entry-1' }, { id: 'entry-2' }],
                },
            ],
            pdfFiles: [
                {
                    filename: 'monthly-summary.pdf',
                    exporter: async () => {},
                    payload: {},
                },
            ],
            invoicePdfFiles: [
                {
                    invoiceId: 'invoice-1',
                    invoiceNumber: 'INV-001',
                    filename: 'invoice-INV-001.pdf',
                    htmlContent: '<html />',
                },
            ],
        });

        expect(rows).toEqual([
            {
                category: 'csv',
                fileName: 'invoices.csv',
                description: 'invoices',
                recordCount: 1,
            },
            {
                category: 'csv',
                fileName: 'time-entries.csv',
                description: 'time entries',
                recordCount: 2,
            },
            {
                category: 'pdf',
                fileName: 'monthly-summary.pdf',
                description: 'monthly summary',
                recordCount: 1,
            },
            {
                category: 'invoice-pdf',
                fileName: 'invoice-INV-001.pdf',
                description: 'invoice pdf INV-001',
                recordCount: 1,
            },
        ]);
    });
});
