import { openDB } from 'idb';

const DB_NAME = 'tasktime-usage-metrics';
const DB_VERSION = 1;
const STORE_NAME = 'metrics';
const STATE_KEY = 'state';

const MAX_STORED_BUCKETS = 30;
const MAX_BATCH_DAYS = 14;
const SESSION_GAP_MS = 30 * 60 * 1000;
const OPEN_SEND_DELAY_MS = 30 * 1000;
const MAX_SESSION_COUNT_PER_DAY = 100;

interface DayBucket {
    day: string;
    sessionCount: number;
    meaningfulActivity: boolean;
    meaningfulActionCount: number;
    syncEnabled: boolean;
    sent: boolean;
}

interface StoredUsageMetricsState {
    deviceInstallId: string | null;
    lastSendDay: string | null;
    dayBuckets: DayBucket[];
}

interface UsageMetricsStartOptions {
    endpoint?: string | null;
    appVersion: string;
    sessionId?: string | null;
}

const DEFAULT_STATE: StoredUsageMetricsState = {
    deviceInstallId: null,
    lastSendDay: null,
    dayBuckets: [],
};

const runtime = {
    endpoint: null as string | null,
    appVersion: '0.0.0',
    sessionId: null as string | null,
    started: false,
    hiddenAt: null as number | null,
    openSendTimer: null as ReturnType<typeof window.setTimeout> | null,
};

let operationQueue = Promise.resolve<unknown>(undefined);

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const isIndexedDbUnavailableError = (error: unknown): boolean => {
    if (error instanceof ReferenceError) {
        return error.message.includes('indexedDB');
    }

    if (error instanceof Error) {
        return error.message.includes('indexedDB');
    }

    return false;
};

const getDB = () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
};

const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = operationQueue.then(operation, operation);
    operationQueue = run.catch(() => undefined);
    return run;
};

const getLocalDayString = (date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const cloneState = (state: StoredUsageMetricsState): StoredUsageMetricsState => ({
    deviceInstallId: state.deviceInstallId,
    lastSendDay: state.lastSendDay,
    dayBuckets: state.dayBuckets.map(bucket => ({ ...bucket })),
});

const normalizeState = (state: StoredUsageMetricsState): StoredUsageMetricsState => {
    const normalizedBuckets = [...state.dayBuckets]
        .sort((left, right) => left.day.localeCompare(right.day))
        .slice(-MAX_STORED_BUCKETS);

    return {
        deviceInstallId: state.deviceInstallId ?? null,
        lastSendDay: state.lastSendDay ?? null,
        dayBuckets: normalizedBuckets,
    };
};

const readState = async (): Promise<StoredUsageMetricsState> => {
    try {
        const db = await getDB();
        const stored = await db.get(STORE_NAME, STATE_KEY) as StoredUsageMetricsState | undefined;

        if (!stored) {
            return cloneState(DEFAULT_STATE);
        }

        return normalizeState(stored);
    } catch (error) {
        if (isIndexedDbUnavailableError(error)) {
            return cloneState(DEFAULT_STATE);
        }

        throw error;
    }
};

const writeState = async (state: StoredUsageMetricsState): Promise<void> => {
    try {
        const db = await getDB();
        await db.put(STORE_NAME, normalizeState(state), STATE_KEY);
    } catch (error) {
        if (isIndexedDbUnavailableError(error)) {
            return;
        }

        throw error;
    }
};

const getOrCreateBucket = (state: StoredUsageMetricsState, day: string): DayBucket => {
    const existing = state.dayBuckets.find(bucket => bucket.day === day);
    if (existing) {
        return existing;
    }

    const nextBucket: DayBucket = {
        day,
        sessionCount: 0,
        meaningfulActivity: false,
        meaningfulActionCount: 0,
        syncEnabled: false,
        sent: false,
    };

    state.dayBuckets.push(nextBucket);
    return nextBucket;
};

const ensureDeviceInstallId = (state: StoredUsageMetricsState): string => {
    if (!state.deviceInstallId) {
        state.deviceInstallId = crypto.randomUUID();
    }

    return state.deviceInstallId;
};

const touchBucketAfterChange = (bucket: DayBucket): void => {
    if (bucket.sent) {
        bucket.sent = false;
    }
};

const shouldUseSyncForBucket = (bucket: DayBucket): boolean => {
    return bucket.syncEnabled === true && Boolean(runtime.sessionId);
};

const isOnline = (): boolean => {
    if (typeof navigator === 'undefined') {
        return true;
    }

    return navigator.onLine;
};

const clearOpenSendTimer = (): void => {
    if (!runtime.openSendTimer) {
        return;
    }

    window.clearTimeout(runtime.openSendTimer);
    runtime.openSendTimer = null;
};

const scheduleOpenSend = (): void => {
    if (!isBrowser() || !runtime.endpoint || document.visibilityState === 'hidden') {
        return;
    }

    clearOpenSendTimer();
    runtime.openSendTimer = window.setTimeout(() => {
        runtime.openSendTimer = null;
        void maybeSendPendingUsageMetrics('open-delay');
    }, OPEN_SEND_DELAY_MS);
};

const recordSession = async (): Promise<void> => {
    const day = getLocalDayString();

    await enqueue(async () => {
        const state = await readState();
        const bucket = getOrCreateBucket(state, day);

        const nextCount = Math.min(MAX_SESSION_COUNT_PER_DAY, bucket.sessionCount + 1);
        if (nextCount !== bucket.sessionCount) {
            bucket.sessionCount = nextCount;
            if (runtime.sessionId) {
                bucket.syncEnabled = true;
            }
            touchBucketAfterChange(bucket);
            await writeState(state);
        }
    }).catch((error) => {
        console.error('[UsageMetrics] Failed to record session:', error);
    });
};

export function markMeaningfulActivity(): void {
    if (!isBrowser()) {
        return;
    }

    void enqueue(async () => {
        const state = await readState();
        ensureDeviceInstallId(state);

        const bucket = getOrCreateBucket(state, getLocalDayString());

        bucket.meaningfulActivity = true;
        bucket.meaningfulActionCount = (bucket.meaningfulActionCount || 0) + 1;
        if (runtime.sessionId) {
            bucket.syncEnabled = true;
        }

        touchBucketAfterChange(bucket);
        await writeState(state);
    }).catch((error) => {
        console.error('[UsageMetrics] Failed to mark meaningful activity:', error);
    });
}

export function setUsageMetricsSessionId(sessionId: string | null): void {
    runtime.sessionId = sessionId;

    if (!isBrowser() || !sessionId) {
        return;
    }

    void enqueue(async () => {
        const state = await readState();
        const bucket = state.dayBuckets.find(dayBucket => dayBucket.day === getLocalDayString());

        if (!bucket || bucket.syncEnabled) {
            return;
        }

        bucket.syncEnabled = true;
        touchBucketAfterChange(bucket);
        await writeState(state);
    }).then(() => maybeSendPendingUsageMetrics('session-update')).catch((error) => {
        console.error('[UsageMetrics] Failed to update session state:', error);
    });
}

export async function maybeSendPendingUsageMetrics(reason = 'manual'): Promise<boolean> {
    if (!isBrowser() || !runtime.endpoint || !isOnline()) {
        return false;
    }

    void reason;

    return enqueue(async () => {
        const state = await readState();
        const today = getLocalDayString();

        if (!state.deviceInstallId || state.lastSendDay === today) {
            return false;
        }

        const pendingBuckets = state.dayBuckets
            .filter(bucket => bucket.meaningfulActivity && !bucket.sent)
            .sort((left, right) => left.day.localeCompare(right.day))
            .slice(0, MAX_BATCH_DAYS);

        if (pendingBuckets.length === 0) {
            return false;
        }

        const body = {
            schemaVersion: 1,
            appVersion: runtime.appVersion,
            deviceInstallId: state.deviceInstallId,
            days: pendingBuckets.map(bucket => ({
                day: bucket.day,
                sessionCount: bucket.sessionCount,
                meaningfulActivity: bucket.meaningfulActivity,
                meaningfulActionCount: bucket.meaningfulActionCount || 0,
                syncEnabled: bucket.syncEnabled,
            })),
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (runtime.sessionId && pendingBuckets.some(shouldUseSyncForBucket)) {
            headers['X-Session-Id'] = runtime.sessionId;
        }

        const response = await fetch(runtime.endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            return false;
        }

        const acceptedDays = new Set(pendingBuckets.map(bucket => bucket.day));
        state.dayBuckets = state.dayBuckets.map(bucket => {
            if (!acceptedDays.has(bucket.day)) {
                return bucket;
            }

            return {
                ...bucket,
                sent: true,
            };
        });
        state.lastSendDay = today;

        await writeState(state);
        return true;
    }).catch((error) => {
        console.error('[UsageMetrics] Failed to send pending usage metrics:', error);
        return false;
    });
}

export function startUsageMetrics(options: UsageMetricsStartOptions): () => void {
    if (!isBrowser()) {
        return () => {};
    }

    runtime.endpoint = options.endpoint ?? null;
    runtime.appVersion = options.appVersion;
    runtime.sessionId = options.sessionId ?? null;

    if (runtime.started || !runtime.endpoint) {
        return () => {};
    }

    runtime.started = true;

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            runtime.hiddenAt = Date.now();
            clearOpenSendTimer();
            void maybeSendPendingUsageMetrics('hidden');
            return;
        }

        const now = Date.now();
        const hiddenAt = runtime.hiddenAt;
        runtime.hiddenAt = null;

        if (hiddenAt == null || (now - hiddenAt) >= SESSION_GAP_MS) {
            void recordSession();
        }

        scheduleOpenSend();
    };

    const handleOnline = () => {
        scheduleOpenSend();
        void maybeSendPendingUsageMetrics('online');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    if (document.visibilityState !== 'hidden') {
        void recordSession();
        scheduleOpenSend();
    }

    return () => {
        clearOpenSendTimer();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
        runtime.started = false;
        runtime.hiddenAt = null;
    };
}

export async function getStoredUsageMetricsState(): Promise<StoredUsageMetricsState> {
    await operationQueue;
    return readState();
}

export async function resetUsageMetricsForTests(): Promise<void> {
    runtime.endpoint = null;
    runtime.appVersion = '0.0.0';
    runtime.sessionId = null;
    runtime.started = false;
    runtime.hiddenAt = null;
    clearOpenSendTimer();
    operationQueue = Promise.resolve(undefined);

    try {
        const db = await getDB();
        await db.put(STORE_NAME, cloneState(DEFAULT_STATE), STATE_KEY);
    } catch (error) {
        if (isIndexedDbUnavailableError(error)) {
            return;
        }

        throw error;
    }
}