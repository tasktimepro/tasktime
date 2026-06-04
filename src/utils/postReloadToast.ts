const POST_RELOAD_TOAST_KEY = 'tasktime-post-reload-toast';
const LAST_SEEN_APP_VERSION_KEY = 'tasktime-last-seen-app-version';

export type PostReloadToast = {
    level: 'success' | 'error' | 'info' | 'warning';
    message: string;
    duration?: number;
};

export function queuePostReloadToast(toast: PostReloadToast): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        sessionStorage.setItem(POST_RELOAD_TOAST_KEY, JSON.stringify(toast));
    } catch {
        // Ignore storage failures and continue with the reload.
    }
}

export function consumePostReloadToast(): PostReloadToast | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const stored = sessionStorage.getItem(POST_RELOAD_TOAST_KEY);
        if (!stored) {
            return null;
        }

        sessionStorage.removeItem(POST_RELOAD_TOAST_KEY);

        const parsed = JSON.parse(stored) as Partial<PostReloadToast>;
        if (!parsed.message || !parsed.level) {
            return null;
        }

        return {
            level: parsed.level,
            message: parsed.message,
            duration: parsed.duration,
        };
    } catch {
        return null;
    }
}

export function rememberAppVersion(currentVersion: string): void {
    if (typeof window === 'undefined' || !currentVersion) {
        return;
    }

    try {
        localStorage.setItem(LAST_SEEN_APP_VERSION_KEY, currentVersion);
    } catch {
        // Ignore storage failures so startup behavior still proceeds.
    }
}
