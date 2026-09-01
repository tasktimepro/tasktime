export type BillingOfferPrice = {
    currency: string;
    unitAmountMinor: number;
    interval: 'year';
    taxPresentation: 'inclusive' | 'exclusive' | 'calculated_at_checkout';
    renewal: 'automatic';
};

export function formatBillingMoney(
    currency: string,
    unitAmountMinor: number,
    locale?: string,
): string {
    if (!/^[A-Z]{3}$/.test(currency)
        || !Number.isSafeInteger(unitAmountMinor)
        || unitAmountMinor < 0) return 'Price unavailable';
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(unitAmountMinor / 100);
    } catch {
        return `${currency} ${(unitAmountMinor / 100).toFixed(2)}`;
    }
}

export function formatBillingOffer(price: BillingOfferPrice, locale?: string): string {
    return `${formatBillingMoney(price.currency, price.unitAmountMinor, locale)}/year`;
}

export function billingTaxQualifier(
    presentation: BillingOfferPrice['taxPresentation'],
): string {
    if (presentation === 'inclusive') return 'Tax included';
    if (presentation === 'exclusive') return 'Tax added at checkout';
    return 'Tax calculated at checkout';
}
