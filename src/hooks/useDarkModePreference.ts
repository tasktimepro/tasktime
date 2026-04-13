import { useEffect, useLayoutEffect, useState } from 'react';

const DARK_MODE_STORAGE_KEY = 'tasktime-dark-mode';
const THEME_COLOR_META_SELECTOR = 'meta[name="theme-color"]';
const COLOR_SCHEME_META_SELECTOR = 'meta[name="color-scheme"]';
const LIGHT_THEME_COLOR = '#fcfcfc';
const DARK_THEME_COLOR = '#0a0a0a';
const useBrowserThemeEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function upsertMetaTag(selector: string, name: string) {
    const existingMetaTag = document.querySelector(selector);

    if (existingMetaTag instanceof HTMLMetaElement) {
        return existingMetaTag;
    }

    const metaTag = document.createElement('meta');

    metaTag.setAttribute('name', name);
    document.head.appendChild(metaTag);

    return metaTag;
}

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

    useBrowserThemeEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const colorScheme = darkMode ? 'dark' : 'light';
        const themeColor = darkMode ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
        const themeColorMeta = upsertMetaTag(THEME_COLOR_META_SELECTOR, 'theme-color');
        const colorSchemeMeta = upsertMetaTag(COLOR_SCHEME_META_SELECTOR, 'color-scheme');

        document.documentElement.classList.toggle('dark', darkMode);
        document.documentElement.style.colorScheme = colorScheme;
        document.documentElement.style.backgroundColor = themeColor;

        if (document.body) {
            document.body.style.colorScheme = colorScheme;
            document.body.style.backgroundColor = themeColor;
        }

        themeColorMeta.setAttribute('content', themeColor);
        colorSchemeMeta.setAttribute('content', colorScheme);

        const animationFrameId = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame(() => {
                themeColorMeta.setAttribute('content', themeColor);
                colorSchemeMeta.setAttribute('content', colorScheme);
            })
            : undefined;

        localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));

        return () => {
            if (typeof animationFrameId === 'number' && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(animationFrameId);
            }
        };
    }, [darkMode]);

    return [darkMode, setDarkMode] as const;
}