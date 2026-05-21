import { describe, expect, it } from 'vitest';
import { buildCsvContent } from './reportCsvUtils';

describe('reportCsvUtils', () => {
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
});
