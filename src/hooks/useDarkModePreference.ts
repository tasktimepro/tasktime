import { useEffect, useState } from 'react';

const DARK_MODE_STORAGE_KEY = 'tasktime-dark-mode';
const THEME_COLOR_META_SELECTOR = 'meta[name="theme-color"]';
const COLOR_SCHEME_META_SELECTOR = 'meta[name="color-scheme"]';
const LIGHT_THEME_COLOR = '#fcfcfc';
const DARK_THEME_COLOR = '#0a0a0a';

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
        if (typeof document === 'undefined') {
            return;
        }

        const colorScheme = darkMode ? 'dark' : 'light';
        const themeColor = darkMode ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
        const themeColorMeta = document.querySelector(THEME_COLOR_META_SELECTOR);
        const colorSchemeMeta = document.querySelector(COLOR_SCHEME_META_SELECTOR);

        document.documentElement.classList.toggle('dark', darkMode);
        document.documentElement.style.colorScheme = colorScheme;
        document.documentElement.style.backgroundColor = themeColor;

        if (document.body) {
            document.body.style.colorScheme = colorScheme;
            document.body.style.backgroundColor = themeColor;
        }

        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', themeColor);
        }

        if (colorSchemeMeta) {
            colorSchemeMeta.setAttribute('content', colorScheme);
        }

        localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));
    }, [darkMode]);

    return [darkMode, setDarkMode] as const;
}