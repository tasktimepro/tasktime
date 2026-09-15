import { describe, expect, it } from 'vitest';
import { LOCAL_REVIEW_PRICING, buildLocalReviewBillingCatalog } from './localReviewPricing';

describe('local review subscription pricing', () => {
    it('keeps both annual amounts VAT-inclusive without changing free or trial behavior', () => {
        expect(LOCAL_REVIEW_PRICING.invoiceEmailSendsPerUtcMonth).toBe(100);
        const catalog = buildLocalReviewBillingCatalog();
        expect(catalog.plans[1].offers.map(offer => [offer.unitAmountMinor, offer.taxPresentation])).toEqual([
            [3900, 'inclusive'], [5900, 'inclusive'],
        ]);
        expect(catalog.plans[0].offers).toEqual([]);
        expect(catalog.trial).toMatchObject({ paymentMethodRequired: false, autoCharges: false });
    });
});
