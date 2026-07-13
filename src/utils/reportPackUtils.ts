import type { ReportCsvColumn } from './reportCsvUtils';

export type AccountantPackCsvFile<T extends Record<string, unknown> = Record<string, unknown>> = {
    columns: Array<ReportCsvColumn<T>>;
    filename: string;
    rows: T[];
};

export type AccountantPackPdfFile<T = unknown> = {
    exporter: (payload: T) => Promise<void>;
    filename: string;
    payload: T;
};

export type AccountantPackInvoicePdfFile = {
    filename: string;
    htmlContent: string;
    invoiceId: string;
    invoiceNumber: string;
};

export type AccountantPackManifestRow = {
    category: string;
    description: string;
    fileName: string;
    recordCount: number;
};

type BuildAccountantPackFilesInput = {
    csvFiles: AccountantPackCsvFile[];
    invoicePdfFiles?: Array<Pick<AccountantPackInvoicePdfFile, 'filename' | 'invoiceId' | 'invoiceNumber'>>;
    pdfFiles: AccountantPackPdfFile[];
};

export const ACCOUNTANT_PACK_MANIFEST_COLUMNS: Array<ReportCsvColumn<AccountantPackManifestRow>> = [
    { key: 'category', header: 'Category' },
    { key: 'fileName', header: 'File Name' },
    { key: 'description', header: 'Description' },
    { key: 'recordCount', header: 'Record Count' },
];

export const buildAccountantPackManifestRows = ({
    csvFiles,
    pdfFiles,
    invoicePdfFiles = [],
}: BuildAccountantPackFilesInput): AccountantPackManifestRow[] => {
    const csvRows = csvFiles.map((file) => ({
        category: 'csv',
        fileName: file.filename,
        description: file.filename.replace(/\.csv$/i, '').replace(/-/g, ' '),
        recordCount: file.rows.length,
    }));

    const pdfRows = pdfFiles.map((file) => ({
        category: 'pdf',
        fileName: file.filename,
        description: file.filename.replace(/\.pdf$/i, '').replace(/-/g, ' '),
        recordCount: 1,
    }));

    const invoicePdfRows = invoicePdfFiles.map((file) => ({
        category: 'invoice-pdf',
        fileName: file.filename,
        description: `invoice pdf ${file.invoiceNumber}`,
        recordCount: 1,
    }));

    return [...csvRows, ...pdfRows, ...invoicePdfRows];
};
