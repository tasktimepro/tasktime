import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    billingTaxQualifier,
    formatBillingMoney,
    formatBillingOffer,
    type BillingOfferPrice,
} from './billingOfferFormatter';

const price: BillingOfferPrice = {
    currency: 'EUR',
    unitAmountMinor: 3900,
    interval: 'year',
    taxPresentation: 'inclusive',
    renewal: 'automatic',
};

describe('billing offer formatting', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('formats the authoritative minor-unit offer without hard-coded display copy', () => {
        const money = formatBillingMoney('EUR', 3900, 'en-IE');
        expect(money).toContain('€');
        expect(money).toContain('39');
        expect(formatBillingOffer(price, 'en-IE')).toBe(`${money}/year`);
    });

    it('rejects invalid currency and minor-unit inputs', () => {
        expect(formatBillingMoney('eur', 3900)).toBe('Price unavailable');
        expect(formatBillingMoney('EUR', -1)).toBe('Price unavailable');
        expect(formatBillingMoney('EUR', 1.5)).toBe('Price unavailable');
    });

    it('uses a deterministic fallback when the runtime cannot format the currency', () => {
        vi.spyOn(Intl, 'NumberFormat').mockImplementationOnce(function NumberFormatFailure() {
            throw new RangeError('unsupported locale');
        });
        expect(formatBillingMoney('EUR', 3900, 'invalid')).toBe('EUR 39.00');
    });

    it('projects each tax presentation explicitly', () => {
        expect(billingTaxQualifier('inclusive')).toBe('Tax included');
        expect(billingTaxQualifier('exclusive')).toBe('Tax added at checkout');
        expect(billingTaxQualifier('calculated_at_checkout')).toBe('Tax calculated at checkout');
    });
});
