import { describe, expect, it } from 'vitest';
import { getFiniteInvoiceNumber } from './invoiceNumbers';

describe('invoice numbers', () => {
    it.each([
        [25.3, 25.3],
        ['25.3', 25.3],
        [' 25.3 ', 25.3],
        ['0', 0],
        ['1e2', 100],
    ])('reads finite invoice values from %p', (value, expected) => {
        expect(getFiniteInvoiceNumber(value)).toBe(expected);
    });

    it.each(['', '   ', '25 hours', '0x10', 'Infinity', 'NaN'])('rejects invalid invoice value %p', (value) => {
        expect(getFiniteInvoiceNumber(value)).toBeNull();
    });
});
