import { openDB } from 'idb';

const DB_NAME = 'tasktime-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';
const DEVICE_ID_KEY = 'device-id';

const getDB = () => {

    return openDB(DB_NAME, DB_VERSION, {

        upgrade(db) {

            if (!db.objectStoreNames.contains(STORE_NAME)) {

                db.createObjectStore(STORE_NAME);
            }
        },
    });
};

export const getDeviceId = async (): Promise<string> => {

    const db = await getDB();
    const stored = await db.get(STORE_NAME, DEVICE_ID_KEY) as string | undefined;

    if (stored) {

        return stored;
    }

    const deviceId = crypto.randomUUID();
    await db.put(STORE_NAME, deviceId, DEVICE_ID_KEY);

    return deviceId;
};

const stableStringify = (value: unknown, excludeKeys?: Set<string>): string => {

    if (value === null || typeof value !== 'object') {

        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {

        return `[${value.map(v => stableStringify(v)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !excludeKeys?.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);

    return `{${entries.join(',')}}`;
};

// Keys to exclude from checksum - these are sync metadata, not user data
const CHECKSUM_EXCLUDE_KEYS = new Set(['_sync', 'version', 'exportedAt']);

export const generateChecksum = async (data: unknown): Promise<string> => {

    const payload = stableStringify(data, CHECKSUM_EXCLUDE_KEYS);

    if (!crypto?.subtle) {

        return `${payload.length}`;
    }

    const buffer = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};
