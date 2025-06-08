/**
 * Currency utilities for handling different currency symbols
 */

/**
 * Map of currency codes to their symbols
 */
export const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CHF: 'CHF',
    CAD: 'CAD$',
    AUD: 'AUD$'
};

/**
 * Get the currency symbol for a given currency code
 * @param {string} currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @returns {string} The currency symbol
 */
export const getCurrencySymbol = (currencyCode) => {
    return CURRENCY_SYMBOLS[currencyCode] || '$';
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
 * @returns {string} The preferred currency code (default: 'USD')
 */
export const getPreferredCurrency = () => {
    try {
        const preferences = JSON.parse(localStorage.getItem('preferences') || '{}');
        const saved = preferences.currency;
        return saved && CURRENCY_SYMBOLS[saved] ? saved : 'USD';
    } catch (error) {
        console.warn('Error parsing preferences from localStorage:', error);
        return 'USD';
    }
};

/**
 * Set the user's preferred currency in localStorage
 * @param {string} currencyCode - The currency code to save
 */
export const setPreferredCurrency = (currencyCode) => {
    try {
        const preferences = JSON.parse(localStorage.getItem('preferences') || '{}');
        preferences.currency = currencyCode;
        localStorage.setItem('preferences', JSON.stringify(preferences));
    } catch (error) {
        console.warn('Error saving preferences to localStorage:', error);
    }
};
