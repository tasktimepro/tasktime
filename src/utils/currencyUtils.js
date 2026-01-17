import { EXCHANGE_RATE_CACHE_MS, ONE_HOUR_MS } from '../constants/app';

/**
 * Map of currency codes to their symbols
 */
export const CURRENCY_SYMBOLS = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: 'CHF',
    CAD: 'CAD$',
    AUD: 'AUD$'
};

/**
 * Map of currency codes to their full names
 */
export const CURRENCY_NAMES = {
    EUR: 'Euro',
    USD: 'US Dollar',
    GBP: 'British Pound',
    CHF: 'Swiss Franc',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar'
};

/**
 * Default currency 
 */
export const DEFAULT_CURRENCY = 'EUR';

/**
 * Normalize a currency code to uppercase and trim whitespace
 * @param {string} currencyCode
 * @returns {string}
 */
export const normalizeCurrencyCode = (currencyCode) => {
    if (!currencyCode) return DEFAULT_CURRENCY;
    return String(currencyCode).trim().toUpperCase();
};

/**
 * Get the currency symbol for a given currency code
 * @param {string} currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @returns {string} The currency symbol
 */
export const getCurrencySymbol = (currencyCode) => {
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
export const formatCurrency = (amount, currencyCode, decimals = 2) => {
    const symbol = getCurrencySymbol(currencyCode);
    return `${symbol}${amount.toFixed(decimals)}`;
};

/**
 * Get the user's preferred currency from localStorage
 * @returns {string} The preferred currency code (default: 'EUR')
 */
export const getPreferredCurrency = () => {
    try {
        const preferences = JSON.parse(localStorage.getItem('preferences') || '{}');
        const saved = normalizeCurrencyCode(preferences.currency);
        return saved && CURRENCY_SYMBOLS[saved] ? saved : DEFAULT_CURRENCY;
    } catch (error) {
        console.warn('Error parsing preferences from localStorage:', error);
        return DEFAULT_CURRENCY;
    }
};

/**
 * Get the currency for a project based on its preferred client's default currency
 * Falls back to the preferred currency if no client is specified or found
 * @param {Object} project - The project object
 * @param {Array} clients - Array of client objects
 * @returns {string} The currency code for the project
 */
export const getProjectCurrency = (project, clients) => {
    if (project.preferredClientId && clients && clients.length > 0) {
        const client = clients.find(c => c.id === project.preferredClientId);
        const clientCurrency = normalizeCurrencyCode(client?.defaultCurrency);
        return clientCurrency && CURRENCY_SYMBOLS[clientCurrency]
            ? clientCurrency
            : getPreferredCurrency();
    }
    return getPreferredCurrency();
};

/**
 * Set the user's preferred currency in localStorage
 * @param {string} currencyCode - The currency code to save
 */
export const setPreferredCurrency = (currencyCode) => {
    try {
        const preferences = JSON.parse(localStorage.getItem('preferences') || '{}');
        preferences.currency = normalizeCurrencyCode(currencyCode);
        localStorage.setItem('preferences', JSON.stringify(preferences));
    } catch (error) {
        console.warn('Error saving preferences to localStorage:', error);
    }
};

/**
 * Cache exchange rates in localStorage with timestamp
 * @param {Object} rates - Exchange rates data
 */
const cacheExchangeRates = (rates) => {
    try {
        const cacheData = {
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
const getCachedExchangeRates = () => {
    try {
        const cacheData = JSON.parse(localStorage.getItem('exchangeRatesCache') || 'null');
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
export const fetchExchangeRates = async () => {
    // First try to get cached rates
    const cachedRates = getCachedExchangeRates();
    if (cachedRates) {
        return { rates: cachedRates, error: null };
    }

    // If no valid cache, fetch from API
    const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        const data = await response.json();
        
        // Cache the rates for future use
        cacheExchangeRates(data.rates);
        
        return { rates: data.rates, error: null };
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        
        // Try to return expired cached rates as fallback
        try {
            const fallbackCache = JSON.parse(localStorage.getItem('exchangeRatesCache') || 'null');
            if (fallbackCache && fallbackCache.rates) {
                console.warn('Using expired cached rates as fallback');
                return { rates: fallbackCache.rates, error: 'Using cached exchange rates (may be outdated).' };
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
export const convertCurrency = (amount, fromCurrency, toCurrency, exchangeRates) => {
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
        return { success: true, amount: amount * toRate };
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
        return { success: true, amount: amount / fromRate };
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
    return { success: true, amount: amountInUSD * toRate };
};

/**
 * Check if we have all required exchange rates for the currencies in use
 * @param {Array} currencies - Array of currency codes in use
 * @param {Object} exchangeRates - Exchange rates object
 * @returns {boolean} True if all required rates are available
 */
export const hasAllRequiredRates = (currencies, exchangeRates) => {
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
export const getCurrencyOptions = (includeFullName = false) => {
    return Object.keys(CURRENCY_SYMBOLS).map(currencyCode => ({
        value: currencyCode,
        label: includeFullName ? `${currencyCode} - ${CURRENCY_NAMES[currencyCode]}` : currencyCode
    }));
};
