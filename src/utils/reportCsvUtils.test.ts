import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsvContent, downloadCsvFile } from './reportCsvUtils';

describe('reportCsvUtils', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('builds rows in the declared column order', () => {
        const content = buildCsvContent(
            [
                { key: 'invoice', header: 'Invoice' },
                { key: 'total', header: 'Total' },
            ],
            [
                { invoice: 'INV-001', total: 1200 },
                { invoice: 'INV-002', total: 500 },
            ]
        );

        expect(content).toBe('Invoice,Total\nINV-001,1200\nINV-002,500');
    });

    it('escapes commas, quotes, and line breaks', () => {
        const content = buildCsvContent(
            [
                { key: 'client', header: 'Client' },
                { key: 'notes', header: 'Notes' },
            ],
            [
                {
                    client: 'Acme, Inc.',
                    notes: 'Line 1\nLine "2"',
                },
            ]
        );

        expect(content).toBe('Client,Notes\n"Acme, Inc.","Line 1\nLine ""2"""');
    });

    it('renders nullish values as empty fields', () => {
        const content = buildCsvContent(
            [
                { key: 'invoice', header: 'Invoice' },
                { key: 'paidDate', header: 'Paid Date' },
                { key: 'notes', header: 'Notes' },
            ],
            [
                { invoice: 'INV-003', paidDate: null, notes: undefined },
            ]
        );

        expect(content).toBe('Invoice,Paid Date,Notes\nINV-003,,');
    });

    it('downloads the csv content using a temporary blob url', () => {
        const createObjectURL = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:report');
        const revokeObjectURL = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
        const appendChild = vi.spyOn(document.body, 'appendChild');
        const removeChild = vi.spyOn(document.body, 'removeChild');
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        downloadCsvFile('report.csv', 'Invoice,Total\nINV-001,1200');

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(click).toHaveBeenCalledTimes(1);
        expect(appendChild).toHaveBeenCalledTimes(1);
        expect(removeChild).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');

        const link = appendChild.mock.calls[0][0] as HTMLAnchorElement;
        expect(link.href).toBe('blob:report');
        expect(link.getAttribute('download')).toBe('report.csv');

        const blob = createObjectURL.mock.calls[0][0] as Blob;
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('text/csv;charset=utf-8;');
    });
});
