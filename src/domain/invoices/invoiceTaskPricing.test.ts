import { describe, expect, it } from 'vitest';
import { usesInvoiceTaskFlatRate } from './invoiceTaskPricing';

describe('invoice task pricing mode', () => {
    it('lets an explicit hourly override win over project and legacy flat-rate fallbacks', () => {
        expect(usesInvoiceTaskFlatRate({
            useFlatRate: false,
            projectFlatRate: true,
            flatRate: 500,
        })).toBe(false);
    });

    it('uses explicit and legacy flat-rate evidence when no hourly override exists', () => {
        expect(usesInvoiceTaskFlatRate({ useFlatRate: true })).toBe(true);
        expect(usesInvoiceTaskFlatRate({ projectFlatRate: true })).toBe(true);
        expect(usesInvoiceTaskFlatRate({ flatRate: 500 })).toBe(true);
        expect(usesInvoiceTaskFlatRate({ flatRate: 0 })).toBe(true);
    });

    it('does not treat empty or malformed legacy flat-rate fields as flat pricing', () => {
        expect(usesInvoiceTaskFlatRate({ flatRate: null })).toBe(false);
        expect(usesInvoiceTaskFlatRate({ flatRate: '' })).toBe(false);
        expect(usesInvoiceTaskFlatRate({ flatRate: 'not-a-number' })).toBe(false);
    });
});
