import { useEffect, useMemo, useRef, useState } from 'react';
import { convertCurrency, fetchExchangeRates, getPreferredCurrency, getProjectCurrency, hasAllRequiredRates } from '../../../utils/currencyUtils';
import { useToast } from '../../../hooks/useToast';

type ProjectItem = {
    id: string;
    preferredClientId?: string | null;
};

type InvoiceItem = {
    currency?: string;
};

type ClientItem = {
    id: string;
    defaultCurrency?: string | null;
};

type CurrencyConversionParams = {
    projects: ProjectItem[];
    invoices: InvoiceItem[];
    clients: ClientItem[];
};

type ConversionResult = {
    amounts: Record<string, number>;
    hadConversionError: boolean;
};

/**
 * useCurrencyConversion hook - manages currency preferences and exchange rates.
 * @param {Object} params
 * @param {Array} params.projects
 * @param {Array} params.invoices
 * @param {Array} params.clients
 * @returns {Object}
 */
const useCurrencyConversion = ({ projects, invoices, clients }: CurrencyConversionParams) => {
    const { showWarning } = useToast();
    const [preferredCurrency, setPreferredCurrency] = useState(getPreferredCurrency());
    const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
    const [exchangeRatesLoading, setExchangeRatesLoading] = useState(false);
    const [exchangeRatesError, setExchangeRatesError] = useState<string | null>(null);
    const lastRatesFetchKeyRef = useRef<string | null>(null);

    // Listen for storage changes to update preferred currency
    useEffect(() => {
        const handleStorageChange = () => {
            setPreferredCurrency(getPreferredCurrency());
        };

        window.addEventListener('storage', handleStorageChange);

        // Also listen for custom events in case changes happen within the same tab
        const handlePreferenceChange = () => {
            setPreferredCurrency(getPreferredCurrency());
        };

        window.addEventListener('preferenceChanged', handlePreferenceChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('preferenceChanged', handlePreferenceChange);
        };
    }, []);

    // Track currencies in use across projects and invoices
    const currenciesInUse = useMemo(() => {
        const projectCurrencies = Array.from(new Set(projects.map(p => getProjectCurrency(p, clients))));
        const invoiceCurrencies = Array.from(new Set(invoices.map(i => i.currency || preferredCurrency)));
        return Array.from(new Set([...projectCurrencies, ...invoiceCurrencies]));
    }, [projects, invoices, preferredCurrency, clients]);

    const sortedCurrenciesInUse = useMemo(() => {
        return [...currenciesInUse].sort();
    }, [currenciesInUse]);

    // Check if we need exchange rates (any currency differs from preferred)
    const needsExchangeRates = useMemo(() => {
        return currenciesInUse.some(currency => currency !== preferredCurrency);
    }, [currenciesInUse, preferredCurrency]);

    const missingExchangeRates = useMemo(() => {
        if (!needsExchangeRates || !exchangeRates) return [] as string[];
        return currenciesInUse.filter(currency => currency !== 'USD' && !exchangeRates[currency]);
    }, [needsExchangeRates, exchangeRates, currenciesInUse]);

    // Fetch exchange rates only if we have multiple currencies
    useEffect(() => {
        const loadExchangeRates = async () => {
            if (needsExchangeRates) {
                const fetchKey = `${preferredCurrency}|${sortedCurrenciesInUse.join(',')}`;
                if (exchangeRatesLoading || (exchangeRates && lastRatesFetchKeyRef.current === fetchKey)) {
                    return;
                }
                lastRatesFetchKeyRef.current = fetchKey;
                setExchangeRatesLoading(true);
                const { rates, error } = await fetchExchangeRates();
                setExchangeRates(rates);
                setExchangeRatesError(error || null);
                setExchangeRatesLoading(false);
                if (!rates) {
                    showWarning(error || 'Unable to load current exchange rates. Currency conversion may use outdated rates or show original amounts.');
                    return;
                }

                if (!hasAllRequiredRates(currenciesInUse, rates)) {
                    const missing = currenciesInUse
                        .filter(currency => currency !== 'USD' && !rates[currency]);
                    if (missing.length > 0) {
                        showWarning(`Missing exchange rates for: ${missing.join(', ')}. Amounts will show in original currency.`);
                    }
                }
            } else {
                setExchangeRates(null);
                setExchangeRatesLoading(false);
                setExchangeRatesError(null);
            }
        };
        loadExchangeRates();
    }, [needsExchangeRates, showWarning, preferredCurrency, sortedCurrenciesInUse, exchangeRates, exchangeRatesLoading, currenciesInUse]);

    // Memoize the currency conversion function to prevent unnecessary recalculations
    const convertToCurrency = useMemo(() => {
        return (amountsByCurrency: Record<string, number>): ConversionResult => {
            // If there's only one currency and it matches preferred, or no exchange rates needed, return as-is
            const currencies = Object.keys(amountsByCurrency);
            if (currencies.length === 1 && currencies[0] === preferredCurrency) {
                return { amounts: amountsByCurrency, hadConversionError: false };
            }

            // Check if we actually need to do any conversions
            const hasNonPreferredCurrency = currencies.some(currency => currency !== preferredCurrency);
            if (!hasNonPreferredCurrency) {
                return { amounts: amountsByCurrency, hadConversionError: false };
            }

            // Only convert if we have exchange rates and actually need them
            if (needsExchangeRates && exchangeRates) {
                let totalInPreferredCurrency = 0;
                let hadConversionError = false;

                Object.entries(amountsByCurrency).forEach(([currency, amount]) => {
                    if (currency === preferredCurrency) {
                        totalInPreferredCurrency += amount;
                    } else {
                        const result = convertCurrency(
                            amount,
                            currency,
                            preferredCurrency,
                            exchangeRates
                        );
                        totalInPreferredCurrency += result.amount;
                        if (!result.success) {
                            hadConversionError = true;
                        }
                    }
                });

                return {
                    amounts: { [preferredCurrency]: totalInPreferredCurrency },
                    hadConversionError
                };
            }

            // If we need exchange rates but don't have them, return original amounts with error flag
            return { amounts: amountsByCurrency, hadConversionError: true };
        };
    }, [preferredCurrency, needsExchangeRates, exchangeRates]);

    return {
        preferredCurrency,
        exchangeRates,
        exchangeRatesLoading,
        exchangeRatesError,
        needsExchangeRates,
        missingExchangeRates,
        currenciesInUse,
        convertToCurrency
    };
};

export default useCurrencyConversion;
