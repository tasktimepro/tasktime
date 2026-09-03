import { openDB } from 'idb';

export interface StoredDropboxSession {
    provider: 'dropbox';
    sessionId: string;
    createdAt: string;
    accountEmail?: string;
}

const DB_NAME = 'tasktime-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';
const SESSION_KEY = 'dropbox-auth-session';

function getDb() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

function normalizedAccountEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const email = value.trim();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? email
        : null;
}

function parseStoredDropboxSession(value: unknown): StoredDropboxSession | null {
    if (!value
        || typeof value !== 'object'
        || Array.isArray(value)
        || (value as Partial<StoredDropboxSession>).provider !== 'dropbox'
        || typeof (value as Partial<StoredDropboxSession>).sessionId !== 'string'
        || !Boolean((value as Partial<StoredDropboxSession>).sessionId)
        || typeof (value as Partial<StoredDropboxSession>).createdAt !== 'string') {
        return null;
    }
    const stored = value as StoredDropboxSession;
    const accountEmail = normalizedAccountEmail(stored.accountEmail);
    return {
        provider: 'dropbox',
        sessionId: stored.sessionId,
        createdAt: stored.createdAt,
        ...(accountEmail ? { accountEmail } : {}),
    };
}

export async function getStoredDropboxSession(): Promise<StoredDropboxSession | null> {
    try {
        const db = await getDb();
        const value: unknown = await db.get(STORE_NAME, SESSION_KEY);
        return parseStoredDropboxSession(value);
    } catch (error) {
        console.error('Error loading Dropbox session from IndexedDB:', error);
        return null;
    }
}

export async function storeDropboxSession(session: StoredDropboxSession): Promise<void> {
    try {
        const db = await getDb();
        const accountEmail = normalizedAccountEmail(session.accountEmail);
        await db.put(STORE_NAME, {
            provider: 'dropbox',
            sessionId: session.sessionId,
            createdAt: session.createdAt,
            ...(accountEmail ? { accountEmail } : {}),
        }, SESSION_KEY);
    } catch (error) {
        console.error('Error saving Dropbox session to IndexedDB:', error);
        throw new Error('Dropbox session could not be saved.');
    }
}

export async function clearStoredDropboxSession(expectedSessionId?: string): Promise<boolean> {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const stored = await transaction.store.get(SESSION_KEY) as StoredDropboxSession | undefined;
        if (expectedSessionId && stored?.sessionId !== expectedSessionId) {
            await transaction.done;
            return false;
        }
        await transaction.store.delete(SESSION_KEY);
        await transaction.done;
        return true;
    } catch (error) {
        console.error('Error clearing Dropbox session from IndexedDB:', error);
        return false;
    }
}
