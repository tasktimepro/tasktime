import { openDB } from 'idb';

interface StoredToken {
    accessToken: string;
    expiresAt: number;
    scope?: string;
}

const DB_NAME = 'tasktime-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';
const TOKEN_KEY = 'google-auth-token';
const EXPIRY_BUFFER_MS = 60_000;

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
        return null;
    }
};

export const storeToken = async (token: StoredToken): Promise<void> => {

    try {

        const db = await getDB();
        await db.put(STORE_NAME, token, TOKEN_KEY);

    } catch (error) {

        console.error('Error saving Google auth token to IndexedDB:', error);
    }
};

export const clearStoredToken = async (): Promise<void> => {

    try {

        const db = await getDB();
        await db.delete(STORE_NAME, TOKEN_KEY);

    } catch (error) {

        console.error('Error clearing Google auth token from IndexedDB:', error);
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

export type { StoredToken };
