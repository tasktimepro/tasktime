const RETRY_DELAYS_MS = [1500, 5000, 15000];
const AUTH_TIMEOUT_MS = 10_000;

/** Read a bounded Retry-After deadline without retaining response contents. */
export function cloudAuthRetryAfter(response: Pick<Response, 'headers'>): number {
    const value = response.headers?.get('Retry-After');
    if (!value) return 0;
    const seconds = Number(value);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
    return Number.isFinite(delay) && delay > 0
        ? Date.now() + Math.min(delay, 60 * 60 * 1000)
        : 0;
}

/** Bound status/token requests and body reads, including stalled fetches. */
export async function withCloudAuthTimeout<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Cloud authentication is temporarily unavailable.'));
        }, AUTH_TIMEOUT_MS);
    });
    try {
        return await Promise.race([request(controller.signal), timeout]);
    } finally {
        clearTimeout(timer!);
    }
}

/**
 * One bounded recovery loop per provider and tab, shared by mounted consumers.
 * Callers retain ownership of requests, session validation and product data.
 */
export class CloudAuthRecovery {
    private key: string | null = null;
    private attempts = 0;
    private notBefore = 0;
    private lastWakeAt = -Infinity;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private running: object | null = null;
    private listeners = new Set<() => Promise<void>>();

    pending(key: string, notBefore = 0): void {
        if (this.key !== key) {
            this.clear();
            this.key = key;
        }
        this.notBefore = notBefore;
        this.schedule();
    }

    clear(key?: string): void {
        if (key && this.key !== key) return;
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        this.key = null;
        this.attempts = 0;
        this.notBefore = 0;
        this.lastWakeAt = -Infinity;
        this.running = null;
    }

    subscribe(listener: () => Promise<void>): () => void {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            window.addEventListener('online', this.wake);
            document.addEventListener('visibilitychange', this.wake);
        }
        this.schedule();
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size > 0) return;
            window.removeEventListener('online', this.wake);
            document.removeEventListener('visibilitychange', this.wake);
            if (this.timer !== null) clearTimeout(this.timer);
            this.timer = null;
        };
    }

    private eligible(): boolean {
        return navigator.onLine && document.visibilityState !== 'hidden';
    }

    private wake = (): void => {
        if (!this.key || this.running || !this.eligible() || Date.now() - this.lastWakeAt < 1000) return;
        this.lastWakeAt = Date.now();
        this.attempts = 0;
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        this.schedule(0);
    };

    private schedule(delay = RETRY_DELAYS_MS[this.attempts]): void {
        if (!this.key || this.timer !== null || this.running || !this.listeners.size
            || !this.eligible() || this.attempts >= RETRY_DELAYS_MS.length) return;
        this.timer = setTimeout(() => { void this.retry(); }, Math.max(delay, this.notBefore - Date.now()));
    }

    private async retry(): Promise<void> {
        this.timer = null;
        if (!this.key || !this.eligible()) return;
        if (Date.now() < this.notBefore) {
            this.schedule(0);
            return;
        }
        const run = {};
        this.running = run;
        this.attempts += 1;
        await Promise.allSettled(Array.from(this.listeners, listener => Promise.resolve().then(listener)));
        if (this.running !== run) return;
        this.running = null;
        this.schedule();
    }
}
