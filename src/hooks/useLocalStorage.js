import { useState, useEffect } from 'react';

/**
 * Custom hook for managing localStorage state
 * @param {string} key - The localStorage key
 * @param {*} defaultValue - Default value if no stored value exists
 * @returns {Array} [value, setValue] - Current value and setter function
 */
export const useLocalStorage = (key, defaultValue) => {
    // Initialize state with value from localStorage or default
    const [value, setValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);

            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);

            return defaultValue;
        }
    });

    // Update localStorage when value changes
    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, value]);

    return [value, setValue];
};
