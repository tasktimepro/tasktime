import { openDB } from 'idb';
import { captureDebugBundleIncident } from '@/utils/debugbundle';

interface StoredToken {
    accessToken: string;
    expiresAt: number;
    scope?: string;
}

/**
 * Session storage for Worker-based auth
 * The session ID is a reference to server-side tokens
 */
interface StoredSession {
    sessionId: string;
    userId: string;
    email: string;
    createdAt: string;
}

const DB_NAME = 'tasktime-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';
const TOKEN_KEY = 'google-auth-token';
const SESSION_KEY = 'google-auth-session';
const EXPIRY_BUFFER_MS = 60_000;
const AUTH_STORAGE_INCIDENT_THROTTLE_MS = 30 * 60 * 1000;

function captureAuthStorageIncident(
    incidentKey: string,
    message: string,
    error: unknown,
    context: Record<string, unknown>,
): void {

    captureDebugBundleIncident({
        incidentKey,
        name: 'TaskTimeAuthStorageError',
        message,
        error,
        context,
        throttleMs: AUTH_STORAGE_INCIDENT_THROTTLE_MS,
    });
}

const getDB = () => {

    return openDB(DB_NAME, DB_VERSION, {

        upgrade(db) {

            if (!db.objectStoreNames.contains(STORE_NAME)) {

                db.createObjectStore(STORE_NAME);
            }
        },
    });
};

export const getStoredToken = async (): Promise<StoredToken | null> => {

    try {

        const db = await getDB();
        const token = await db.get(STORE_NAME, TOKEN_KEY) as StoredToken | undefined;

        return token ?? null;

    } catch (error) {

        console.error('Error loading Google auth token from IndexedDB:', error);
        captureAuthStorageIncident(
            'auth.token_storage_read_failed',
            'TaskTime Pro could not read the Google auth token from IndexedDB',
            error,
            { operation: 'read', storageKind: 'token' },
        );
        return null;
    }
};

const isQuotaError = (error: unknown): boolean => {
    if (error instanceof DOMException) {
        return error.name === 'QuotaExceededError' || error.code === 22;
    }

    const message = error instanceof Error ? error.message : String(error);
    return message.includes('QuotaExceededError') || message.includes('storage quota');
};

export const storeToken = async (token: StoredToken): Promise<void> => {

    try {

        const db = await getDB();
        await db.put(STORE_NAME, token, TOKEN_KEY);

    } catch (error) {

        if (isQuotaError(error)) {
            console.error('IndexedDB storage quota exceeded while saving auth token. Clear browser data to free space.');
            captureAuthStorageIncident(
                'auth.token_storage_quota_exceeded',
                'TaskTime Pro could not save the Google auth token because IndexedDB quota was exceeded',
                error,
                { operation: 'write', storageKind: 'token', quotaExceeded: true },
            );
        } else {
            console.error('Error saving Google auth token to IndexedDB:', error);
            captureAuthStorageIncident(
                'auth.token_storage_write_failed',
                'TaskTime Pro could not save the Google auth token to IndexedDB',
                error,
                { operation: 'write', storageKind: 'token', quotaExceeded: false },
            );
        }
    }
};

export const clearStoredToken = async (): Promise<void> => {

    try {

        const db = await getDB();
        await db.delete(STORE_NAME, TOKEN_KEY);

    } catch (error) {

        console.error('Error clearing Google auth token from IndexedDB:', error);
        captureAuthStorageIncident(
            'auth.token_storage_clear_failed',
            'TaskTime Pro could not clear the Google auth token from IndexedDB',
            error,
            { operation: 'clear', storageKind: 'token' },
        );
    }
};

export const isTokenExpired = (token: StoredToken | null): boolean => {

    if (!token?.expiresAt) {

        return true;
    }

    return Date.now() >= (token.expiresAt - EXPIRY_BUFFER_MS);
};

export const getTokenTimeRemaining = (token: StoredToken | null): number => {

    if (!token?.expiresAt) {

        return 0;
    }

    const remaining = token.expiresAt - Date.now();
    return Math.max(0, remaining);
};

// ============================================================================
// Session Storage (for Worker-based auth)
// ============================================================================

export const getStoredSession = async (): Promise<StoredSession | null> => {

    try {

        const db = await getDB();
        const session = await db.get(STORE_NAME, SESSION_KEY) as StoredSession | undefined;

        return session ?? null;

    } catch (error) {

        console.error('Error loading session from IndexedDB:', error);
        captureAuthStorageIncident(
            'auth.session_storage_read_failed',
            'TaskTime Pro could not read the Google Drive session from IndexedDB',
            error,
            { operation: 'read', storageKind: 'session' },
        );
        return null;
    }
};

export const storeSession = async (session: StoredSession): Promise<void> => {

    try {

        const db = await getDB();
        await db.put(STORE_NAME, session, SESSION_KEY);

    } catch (error) {

        console.error('Error saving session to IndexedDB:', error);
        captureAuthStorageIncident(
            'auth.session_storage_write_failed',
            'TaskTime Pro could not save the Google Drive session to IndexedDB',
            error,
            { operation: 'write', storageKind: 'session' },
        );
    }
};

export const clearStoredSession = async (): Promise<void> => {

    try {

        const db = await getDB();
        await db.delete(STORE_NAME, SESSION_KEY);

    } catch (error) {

        console.error('Error clearing session from IndexedDB:', error);
        captureAuthStorageIncident(
            'auth.session_storage_clear_failed',
            'TaskTime Pro could not clear the Google Drive session from IndexedDB',
            error,
            { operation: 'clear', storageKind: 'session' },
        );
    }
};

export type { StoredToken, StoredSession };
