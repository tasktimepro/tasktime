// Lightweight debug logger for sync flows. Enable by setting localStorage key:
// localStorage.setItem('tasktime:debug-sync', '1')
// Disable with: localStorage.removeItem('tasktime:debug-sync')

export const isSyncDebugEnabled = (): boolean => {

    // Prefer runtime toggle via localStorage to avoid shipping noisy logs in production
    if (typeof localStorage !== 'undefined') {
        try {
            return localStorage.getItem('tasktime:debug-sync') === '1';
        } catch {
            // Ignore storage access issues
        }
    }

    return false;
};

export const syncLog = (...args: unknown[]): void => {

    if (!isSyncDebugEnabled()) {
        return;
    }

    // eslint-disable-next-line no-console
    console.log('[sync]', ...args);
};
