import { openDB } from 'idb';
import { captureDebugBundleIncident } from '@/utils/debugbundle';

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

/** Remove credentials persisted by the retired pre-Worker auth design. */
export const clearLegacyStoredToken = async (): Promise<void> => {

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

export const clearStoredSession = async (expectedSessionId?: string): Promise<boolean> => {

    try {

        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const stored = await transaction.store.get(SESSION_KEY) as StoredSession | undefined;

        if (expectedSessionId && stored?.sessionId !== expectedSessionId) {
            await transaction.done;
            return false;
        }

        await transaction.store.delete(SESSION_KEY);
        await transaction.done;
        return true;

    } catch (error) {

        console.error('Error clearing session from IndexedDB:', error);
        captureAuthStorageIncident(
            'auth.session_storage_clear_failed',
            'TaskTime Pro could not clear the Google Drive session from IndexedDB',
            error,
            { operation: 'clear', storageKind: 'session' },
        );
        return false;
    }
};

export type { StoredSession };
