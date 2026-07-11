import { EXCHANGE_RATE_CACHE_MS } from '../constants/app';

export const EXCHANGE_RATES_API_URL = 'https://open.er-api.com/v6/latest/USD';
export const STALE_EXCHANGE_RATES_ERROR = 'Using stale cached exchange rates.';

/**
 * Map of currency codes to their symbols
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: 'CHF',
    CAD: 'CAD$',
    AUD: 'AUD$',
    INR: '₹',
    CNY: '¥',
    JPY: '¥',
    RUB: '₽'
};

/**
 * Map of currency codes to their full names
 */
export const CURRENCY_NAMES: Record<string, string> = {
    EUR: 'Euro',
    USD: 'US Dollar',
    GBP: 'British Pound',
    CHF: 'Swiss Franc',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    INR: 'Indian Rupee',
    CNY: 'Chinese Yuan',
    JPY: 'Japanese Yen',
    RUB: 'Russian Ruble'
};

/**
 * Default currency 
 */
export const DEFAULT_CURRENCY = 'EUR';
const CURRENCY_GROUPING_THRESHOLD = 10000;

type ExchangeRateCache = {
    rates: Record<string, number>;
    timestamp: number;
};

type Preferences = {
    currency?: string;
};

/**
 * Normalize a currency code to uppercase and trim whitespace
 * @param {string} currencyCode
 * @returns {string}
 */
export const normalizeCurrencyCode = (currencyCode: string | null | undefined): string => {
    if (!currencyCode) return DEFAULT_CURRENCY;
    return String(currencyCode).trim().toUpperCase();
};

/**
 * Get the currency symbol for a given currency code
 * @param {string} currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @returns {string} The currency symbol
 */
export const getCurrencySymbol = (currencyCode: string | null | undefined): string => {
    const normalized = normalizeCurrencyCode(currencyCode);
    return CURRENCY_SYMBOLS[normalized] || '$';
};

/**
 * Format an amount with the appropriate currency symbol
 * @param {number} amount - The amount to format
 * @param {string} currencyCode - The currency code
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted amount with currency symbol
 */
export const formatCurrency = (amount: number, currencyCode: string | null | undefined, decimals = 2): string => {
    const symbol = getCurrencySymbol(currencyCode);
    const roundedAmount = Number(amount.toFixed(decimals));
    const shouldUseGrouping = Math.abs(roundedAmount) >= CURRENCY_GROUPING_THRESHOLD;
    const formattedAmount = shouldUseGrouping
        ? roundedAmount.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        })
        : amount.toFixed(decimals);

    return `${symbol}${formattedAmount}`;
};

/**
 * Compatibility fallback for callers without preference context. Persisted
 * preference ownership belongs to the Yjs preferences hook; finance paths
 * must pass that value explicitly instead of consulting legacy localStorage.
 */
export const getPreferredCurrency = (): string => {
    return DEFAULT_CURRENCY;
};

/**
 * Get the currency for a project based on its preferred client's default currency
 * Falls back to the preferred currency if no client is specified or found
 * @param {Object} project - The project object
 * @param {Array} clients - Array of client objects
 * @returns {string} The currency code for the project
 */
export const getProjectCurrency = (
    project: { preferredClientId?: string | null },
    clients: Array<{ id: string; defaultCurrency?: string | null }> | null | undefined,
    fallbackCurrency?: string
): string => {
    const normalizedFallback = normalizeCurrencyCode(fallbackCurrency || getPreferredCurrency());
    const resolvedFallback = normalizedFallback && CURRENCY_SYMBOLS[normalizedFallback]
        ? normalizedFallback
        : DEFAULT_CURRENCY;

    if (project.preferredClientId && clients && clients.length > 0) {
        const client = clients.find(c => c.id === project.preferredClientId);
        const clientCurrency = normalizeCurrencyCode(client?.defaultCurrency);
        return clientCurrency && CURRENCY_SYMBOLS[clientCurrency]
            ? clientCurrency
            : resolvedFallback;
    }
    return resolvedFallback;
};

/**
 * Cache exchange rates in localStorage with timestamp
 * @param {Object} rates - Exchange rates data
 */
const cacheExchangeRates = (rates: Record<string, number>): void => {
    try {
        const cacheData: ExchangeRateCache = {
            rates,
            timestamp: Date.now()
        };
        localStorage.setItem('exchangeRatesCache', JSON.stringify(cacheData));
    } catch (error) {
        console.warn('Error caching exchange rates:', error);
    }
};

/**
 * Get cached exchange rates if they're still valid (less than 24 hours old)
 * @returns {Object|null} Cached exchange rates or null if cache is invalid/missing
 */
const getCachedExchangeRates = (): Record<string, number> | null => {
    try {
        const cacheData = JSON.parse(localStorage.getItem('exchangeRatesCache') || 'null') as ExchangeRateCache | null;
        if (!cacheData || !cacheData.rates) {
            return null;
        }

        const cacheExpiryTime = Date.now() - EXCHANGE_RATE_CACHE_MS;
        if (cacheData.timestamp && cacheData.timestamp > cacheExpiryTime) {
            return cacheData.rates;
        }

        return null;
    } catch (error) {
        console.warn('Error reading cached exchange rates:', error);
        return null;
    }
};

/**
 * Fetch exchange rates from a currency conversion API with caching
 * @returns {Promise<Object>} A map of currency codes to their exchange rates relative to USD
 */
export const fetchExchangeRates = async (): Promise<{ rates: Record<string, number> | null; error: string | null }> => {
    // First try to get cached rates
    const cachedRates = getCachedExchangeRates();
    if (cachedRates) {
        return { rates: cachedRates, error: null };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
            const fallbackCache = JSON.parse(localStorage.getItem('exchangeRatesCache') || 'null') as ExchangeRateCache | null;
            if (fallbackCache && fallbackCache.rates) {
                return { rates: fallbackCache.rates, error: STALE_EXCHANGE_RATES_ERROR };
            }
        } catch {
            // Ignore cache parse errors when offline
        }

        return { rates: null, error: 'Currently offline. Exchange rates unavailable.' };
    }

    // If no valid cache, fetch from API
    try {
        const response = await fetch(EXCHANGE_RATES_API_URL);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        const data = await response.json();

        // Cache the rates for future use
        cacheExchangeRates(data.rates as Record<string, number>);

        return { rates: data.rates as Record<string, number>, error: null };
    } catch (error) {
        console.error('Error fetching exchange rates:', error);

        // Try to return expired cached rates as fallback
        try {
            const fallbackCache = JSON.parse(localStorage.getItem('exchangeRatesCache') || 'null') as ExchangeRateCache | null;
            if (fallbackCache && fallbackCache.rates) {
                console.warn('Using expired cached rates as fallback');
                return { rates: fallbackCache.rates, error: STALE_EXCHANGE_RATES_ERROR };
            }
        } catch {
            console.warn('No fallback rates available');
        }

        return { rates: null, error: 'Unable to load exchange rates.' };
    }
};

/**
 * Convert an amount from one currency to another
 * @param {number} amount - The amount to convert
 * @param {string} fromCurrency - The currency code of the original amount
 * @param {string} toCurrency - The currency code to convert to
 * @param {Object} exchangeRates - A map of currency codes to their exchange rates relative to USD
 * @returns {{success: boolean, amount: number, error?: string}} Result object with conversion status
 */
export const convertCurrency = (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRates: Record<string, number> | null | undefined
): { success: boolean; amount: number; error?: string } => {
    // Handle invalid input
    if (amount === undefined || amount === null || isNaN(amount)) {
        return { success: false, amount: 0, error: 'Invalid amount' };
    }

    // If converting to the same currency, return original amount
    if (fromCurrency === toCurrency) {
        return { success: true, amount };
    }

    // Standardize currency codes
    const fromCurrencyStd = normalizeCurrencyCode(fromCurrency);
    const toCurrencyStd = normalizeCurrencyCode(toCurrency);

    // Re-check after normalization (handles case differences like 'eur' vs 'EUR')
    if (fromCurrencyStd === toCurrencyStd) {
        return { success: true, amount };
    }

    // Check if we have valid exchange rates
    if (!exchangeRates || Object.keys(exchangeRates).length === 0) {
        return {
            success: false,
            amount,
            error: 'No exchange rates available - showing unconverted amount'
        };
    }

    // Handle USD as base currency
    if (fromCurrencyStd === 'USD') {
        const toRate = exchangeRates[toCurrencyStd];
        if (!toRate) {
            return {
                success: false,
                amount,
                error: `Missing exchange rate for ${toCurrencyStd}`
            };
        }
        return { success: true, amount: Math.round(amount * toRate * 100) / 100 };
    }

    if (toCurrencyStd === 'USD') {
        const fromRate = exchangeRates[fromCurrencyStd];
        if (!fromRate) {
            return {
                success: false,
                amount,
                error: `Missing exchange rate for ${fromCurrencyStd}`
            };
        }
        return { success: true, amount: Math.round((amount / fromRate) * 100) / 100 };
    }

    // For non-USD to non-USD conversion, go through USD
    const fromRate = exchangeRates[fromCurrencyStd];
    const toRate = exchangeRates[toCurrencyStd];

    if (!fromRate || !toRate) {
        return {
            success: false,
            amount,
            error: `Missing exchange rate for ${fromCurrencyStd} to ${toCurrencyStd} conversion`
        };
    }

    const amountInUSD = amount / fromRate;
    return { success: true, amount: Math.round(amountInUSD * toRate * 100) / 100 };
};

/**
 * Check if we have all required exchange rates for the currencies in use
 * @param {Array} currencies - Array of currency codes in use
 * @param {Object} exchangeRates - Exchange rates object
 * @returns {boolean} True if all required rates are available
 */
export const hasAllRequiredRates = (
    currencies: string[],
    exchangeRates: Record<string, number> | null | undefined
): boolean => {
    if (!exchangeRates || currencies.length <= 1) return true;

    return currencies.every(currency => {
        if (currency === 'USD') return true; // USD is base currency
        return exchangeRates[currency] !== undefined;
    });
};

/**
 * Generate currency options for select dropdowns
 * @param {boolean} includeFullName - Whether to include the full currency name
 * @returns {Array} Array of objects with value and label properties
 */
export const getCurrencyOptions = (includeFullName = false): Array<{ value: string; label: string }> => {
    return Object.keys(CURRENCY_SYMBOLS).map(currencyCode => ({
        value: currencyCode,
        label: includeFullName ? `${currencyCode} - ${CURRENCY_NAMES[currencyCode]}` : currencyCode
    }));
};
