/**
 * Bundled values used only for loopback review surfaces. The Worker catalog
 * remains authoritative for production availability and every billing action.
 */
export const LOCAL_REVIEW_PRICING = Object.freeze({
    planConfigVersion: 'local-review-v1',
    trialDays: 30,
    trialDurationHours: 720,
    foundingAnnualEur: 39,
    foundingAnnualMinor: 3900,
    foundingMemberLimit: 250,
    standardAnnualEur: 59,
    standardAnnualMinor: 5900,
    invoiceEmailSendsPerUtcMonth: 25,
});

export function buildLocalReviewBillingCatalog() {
    return {
        version: 1,
        planConfigVersion: LOCAL_REVIEW_PRICING.planConfigVersion,
        purchaseEnabled: true,
        trial: {
            durationHours: LOCAL_REVIEW_PRICING.trialDurationHours,
            paymentMethodRequired: false,
            autoCharges: false,
        },
        plans: [
            {
                plan: 'free',
                displayName: 'Free',
                features: ['oneActiveClient', 'basicReportsOverview'],
                activeClients: 1,
                invoiceEmailSendsPerUtcMonth: 0,
                offers: [],
            },
            {
                plan: 'pro',
                displayName: 'Pro',
                features: ['unlimitedActiveClients', 'advancedReports', 'hostedEmail'],
                activeClients: null,
                invoiceEmailSendsPerUtcMonth: LOCAL_REVIEW_PRICING.invoiceEmailSendsPerUtcMonth,
                offers: [
                    {
                        offerId: 'pro-founding-annual-eur',
                        offerKind: 'founding',
                        currency: 'EUR',
                        unitAmountMinor: LOCAL_REVIEW_PRICING.foundingAnnualMinor,
                        interval: 'year',
                        taxPresentation: 'calculated_at_checkout',
                        renewal: 'automatic',
                        founding: {
                            memberLimit: LOCAL_REVIEW_PRICING.foundingMemberLimit,
                            availability: 'available',
                            priceRetention: 'while_same_subscription_continues_or_is_recoverable',
                        },
                    },
                    {
                        offerId: 'pro-standard-annual-eur',
                        offerKind: 'standard',
                        currency: 'EUR',
                        unitAmountMinor: LOCAL_REVIEW_PRICING.standardAnnualMinor,
                        interval: 'year',
                        taxPresentation: 'calculated_at_checkout',
                        renewal: 'automatic',
                        founding: null,
                    },
                ],
            },
        ],
        legal: {
            termsVersion: 'local-review-only',
            privacyVersion: 'local-review-only',
            refundPolicyVersion: 'local-review-only',
        },
    };
}
