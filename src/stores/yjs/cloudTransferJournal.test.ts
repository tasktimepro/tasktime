import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearCloudTransferJournal,
    bindCloudWorkspaceId,
    createCloudTransferJournal,
    getOrCreateCloudWorkspaceId,
    readCloudTransferJournal,
    updateCloudTransferJournal,
    type CloudTransferJournalV1,
} from './cloudTransferJournal';

const records = new Map<string, unknown>();
const store = {
    get: vi.fn((key: string) => Promise.resolve(records.get(key))),
    put: vi.fn((value: unknown, key: string) => {
        records.set(key, structuredClone(value));
        return Promise.resolve(key);
    }),
    delete: vi.fn((key: string) => {
        records.delete(key);
        return Promise.resolve();
    }),
};
const db = {
    get: vi.fn((_store: string, key: string) => store.get(key)),
    transaction: vi.fn(() => ({ store, done: Promise.resolve() })),
};

vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve(db)),
}));

function journal(operationId = 'f85f92e3-1584-4d77-8292-3a9977adcf44'): CloudTransferJournalV1 {
    return {
        version: 1,
        operationId,
        ownerId: '42de9b18-445c-4d28-b5c9-88bc476fc7f1',
        workspaceId: 'b0b8dbef-bb0b-46ea-99c1-e83aa10b6b23',
        sourceProvider: 'google-drive',
        sourceGeneration: 2,
        targetProvider: 'dropbox',
        targetGeneration: 3,
        stage: 'preparing-source',
        sourceFingerprint: null,
        documentNames: [],
        handoffBackupName: null,
        startedAt: '2026-08-19T10:00:00.000Z',
        updatedAt: '2026-08-19T10:00:00.000Z',
    };
}

describe('cloudTransferJournal', () => {
    beforeEach(() => {
        records.clear();
        vi.clearAllMocks();
    });

    it('creates one durable workspace id without replacing it', async () => {
        const first = await getOrCreateCloudWorkspaceId();
        const second = await getOrCreateCloudWorkspaceId();

        expect(second).toBe(first);
        expect(store.put).toHaveBeenCalledOnce();
        await expect(bindCloudWorkspaceId(first)).resolves.toBe(first);
        await expect(bindCloudWorkspaceId(
            'f85f92e3-1584-4d77-8292-3a9977adcf44',
        )).rejects.toThrow('different TaskTime workspace');
    });

    it('compare-and-updates and clears only the owned transfer operation', async () => {
        const initial = journal();
        await createCloudTransferJournal(initial);
        await expect(readCloudTransferJournal()).resolves.toEqual(initial);

        const updated = await updateCloudTransferJournal(initial.operationId, {
            stage: 'target-inspected',
            documentNames: ['core', 'entries-active'],
        });
        expect(updated).toMatchObject({
            stage: 'target-inspected',
            documentNames: ['core', 'entries-active'],
        });
        await expect(clearCloudTransferJournal('wrong-operation-id-fixture')).resolves.toBe(false);
        await expect(clearCloudTransferJournal(initial.operationId)).resolves.toBe(true);
        await expect(readCloudTransferJournal()).resolves.toBeNull();
    });

    it('rejects a concurrent operation and malformed persisted state', async () => {
        await createCloudTransferJournal(journal());
        await expect(createCloudTransferJournal(
            journal('c882c804-3a2f-48fb-a366-d27a84750d2d'),
        )).rejects.toThrow('already in progress');

        records.set('cloud-provider-transfer-journal-v1', {
            ...journal(),
            sourceProvider: 'unknown-provider',
        });
        await expect(readCloudTransferJournal()).rejects.toThrow('journal is invalid');

        records.set('cloud-provider-transfer-journal-v1', {
            ...journal(),
            sourceFingerprint: {
                modifiedTime: 'not-a-date',
                accountId: 'must-not-be-persisted',
            },
        });
        await expect(readCloudTransferJournal()).rejects.toThrow('journal is invalid');
    });
});
