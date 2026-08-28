import { openDB } from 'idb';

import type { CloudManifestFingerprint, CloudProviderId } from './providers';

const DB_NAME = 'tasktime-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';
const JOURNAL_KEY = 'cloud-provider-transfer-journal-v1';
const WORKSPACE_ID_KEY = 'cloud-workspace-id-v1';

export type CloudTransferStage =
    | 'preparing-source'
    | 'target-inspected'
    | 'uploading-target'
    | 'target-prepared'
    | 'target-verified'
    | 'source-marked'
    | 'activated'
    | 'finalizing';

export interface CloudTransferJournalV1 {
    version: 1;
    operationId: string;
    ownerId: string;
    workspaceId: string;
    sourceProvider: CloudProviderId;
    sourceGeneration: number;
    targetProvider: CloudProviderId;
    targetGeneration: number;
    stage: CloudTransferStage;
    sourceFingerprint: CloudManifestFingerprint | null;
    documentNames: string[];
    handoffBackupName: string | null;
    startedAt: string;
    updatedAt: string;
}

const STAGES: CloudTransferStage[] = [
    'preparing-source',
    'target-inspected',
    'uploading-target',
    'target-prepared',
    'target-verified',
    'source-marked',
    'activated',
    'finalizing',
];

function getDb() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        },
    });
}

function isProvider(value: unknown): value is CloudProviderId {
    return value === 'google-drive' || value === 'dropbox';
}

function isId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9-]{20,200}$/i.test(value);
}

function isManifestFingerprint(value: unknown): value is CloudManifestFingerprint {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const fingerprint = value as Record<string, unknown>;
    const keys = Object.keys(fingerprint);
    return keys.every(key => ['revision', 'modifiedTime', 'contentHash', 'size'].includes(key))
        && typeof fingerprint.modifiedTime === 'string'
        && Number.isFinite(Date.parse(fingerprint.modifiedTime))
        && (fingerprint.revision === undefined || typeof fingerprint.revision === 'string')
        && (fingerprint.contentHash === undefined || typeof fingerprint.contentHash === 'string')
        && (fingerprint.size === undefined
            || (typeof fingerprint.size === 'number'
                && Number.isSafeInteger(fingerprint.size)
                && fingerprint.size >= 0));
}

function parseJournal(value: unknown): CloudTransferJournalV1 | null {
    if (value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('The provider transfer journal is invalid.');
    }
    const journal = value as Record<string, unknown>;
    if (journal.version !== 1
        || !isId(journal.operationId)
        || !isId(journal.ownerId)
        || !isId(journal.workspaceId)
        || !isProvider(journal.sourceProvider)
        || !isProvider(journal.targetProvider)
        || journal.sourceProvider === journal.targetProvider
        || typeof journal.sourceGeneration !== 'number'
        || !Number.isSafeInteger(journal.sourceGeneration)
        || journal.sourceGeneration < 0
        || typeof journal.targetGeneration !== 'number'
        || !Number.isSafeInteger(journal.targetGeneration)
        || journal.targetGeneration < 0
        || !STAGES.includes(journal.stage as CloudTransferStage)
        || (journal.sourceFingerprint !== null
            && !isManifestFingerprint(journal.sourceFingerprint))
        || !Array.isArray(journal.documentNames)
        || journal.documentNames.some(name => typeof name !== 'string' || name.length > 100)
        || (journal.handoffBackupName !== null && typeof journal.handoffBackupName !== 'string')
        || typeof journal.startedAt !== 'string'
        || !Number.isFinite(Date.parse(journal.startedAt))
        || typeof journal.updatedAt !== 'string'
        || !Number.isFinite(Date.parse(journal.updatedAt))) {
        throw new Error('The provider transfer journal is invalid.');
    }
    return journal as unknown as CloudTransferJournalV1;
}

export async function getOrCreateCloudWorkspaceId(): Promise<string> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const current = await tx.store.get(WORKSPACE_ID_KEY);
    if (isId(current)) {
        await tx.done;
        return current;
    }
    if (current !== undefined) throw new Error('The cloud workspace identity is invalid.');
    const workspaceId = crypto.randomUUID();
    await tx.store.put(workspaceId, WORKSPACE_ID_KEY);
    await tx.done;
    return workspaceId;
}

export async function bindCloudWorkspaceId(workspaceId: string): Promise<string> {
    if (!isId(workspaceId)) throw new Error('The cloud workspace identity is invalid.');
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const current = await tx.store.get(WORKSPACE_ID_KEY);
    if (current !== undefined && current !== workspaceId) {
        throw new Error('This provider belongs to a different TaskTime workspace.');
    }
    if (current === undefined) await tx.store.put(workspaceId, WORKSPACE_ID_KEY);
    await tx.done;
    return workspaceId;
}

export async function readCloudTransferJournal(): Promise<CloudTransferJournalV1 | null> {
    const db = await getDb();
    return parseJournal(await db.get(STORE_NAME, JOURNAL_KEY));
}

export async function createCloudTransferJournal(
    journal: CloudTransferJournalV1,
): Promise<void> {
    parseJournal(journal);
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const current = parseJournal(await tx.store.get(JOURNAL_KEY));
    if (current && current.operationId !== journal.operationId) {
        throw new Error('Another provider transfer is already in progress.');
    }
    await tx.store.put(structuredClone(journal), JOURNAL_KEY);
    await tx.done;
}

export async function updateCloudTransferJournal(
    operationId: string,
    changes: Partial<Pick<
        CloudTransferJournalV1,
        'stage' | 'sourceFingerprint' | 'documentNames' | 'handoffBackupName'
    >>,
): Promise<CloudTransferJournalV1> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const current = parseJournal(await tx.store.get(JOURNAL_KEY));
    if (!current || current.operationId !== operationId) {
        throw new Error('The provider transfer journal changed in another tab.');
    }
    const next = {
        ...current,
        ...changes,
        updatedAt: new Date().toISOString(),
    };
    parseJournal(next);
    await tx.store.put(next, JOURNAL_KEY);
    await tx.done;
    return next;
}

export async function clearCloudTransferJournal(operationId: string): Promise<boolean> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const current = parseJournal(await tx.store.get(JOURNAL_KEY));
    if (!current || current.operationId !== operationId) {
        await tx.done;
        return false;
    }
    await tx.store.delete(JOURNAL_KEY);
    await tx.done;
    return true;
}
