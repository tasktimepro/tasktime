import { useEffect, useState } from 'react';

const DARK_MODE_STORAGE_KEY = 'tasktime-dark-mode';

function getInitialDarkModePreference() {
    if (typeof window === 'undefined') {
        return false;
    }

    const savedPreference = localStorage.getItem(DARK_MODE_STORAGE_KEY);

    if (savedPreference !== null) {
        return savedPreference === 'true';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Persist and apply the global dark mode preference.
 */
export function useDarkModePreference() {
    const [darkMode, setDarkMode] = useState(getInitialDarkModePreference);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));
    }, [darkMode]);

    return [darkMode, setDarkMode] as const;
}