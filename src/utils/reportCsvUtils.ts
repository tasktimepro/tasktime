export type ReportCsvColumn<T extends Record<string, unknown>> = {
    key: keyof T;
    header: string;
};

const escapeCsvValue = (value: unknown): string => {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);

    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
};

export const buildCsvContent = <T extends Record<string, unknown>>(
    columns: Array<ReportCsvColumn<T>>,
    rows: T[]
): string => {
    const headerLine = columns.map((column) => escapeCsvValue(column.header)).join(',');
    const rowLines = rows.map((row) => {
        return columns.map((column) => escapeCsvValue(row[column.key])).join(',');
    });

    return [headerLine, ...rowLines].join('\n');
};

export const downloadCsvFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
