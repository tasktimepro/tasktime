export const THEME_STORAGE_KEY = 'tasktime-dark-mode';

export const THEME_INIT_SCRIPT = `(() => {
    const storageKey = '${THEME_STORAGE_KEY}';
    const root = document.documentElement;
    const storedPreference = window.localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const darkMode = storedPreference === null ? prefersDark : storedPreference === 'true';

    root.dataset.theme = darkMode ? 'dark' : 'light';
    root.classList.toggle('dark', darkMode);
})();`;

export const THEME_TOGGLE_SCRIPT = `(() => {
    const storageKey = '${THEME_STORAGE_KEY}';
    const root = document.documentElement;
    const button = document.getElementById('theme-toggle');

    if (!button) {
        return;
    }

    const applyTheme = (darkMode) => {
        root.dataset.theme = darkMode ? 'dark' : 'light';
        root.classList.toggle('dark', darkMode);
        window.localStorage.setItem(storageKey, String(darkMode));
        button.setAttribute('aria-label', darkMode ? 'Switch to light mode' : 'Switch to dark mode');
        button.setAttribute('title', darkMode ? 'Switch to light mode' : 'Switch to dark mode');
        button.setAttribute('data-theme-state', darkMode ? 'dark' : 'light');
    };

    const currentDarkMode = root.dataset.theme === 'dark';
    applyTheme(currentDarkMode);

    button.addEventListener('click', () => {
        applyTheme(root.dataset.theme !== 'dark');
    });
})();`;