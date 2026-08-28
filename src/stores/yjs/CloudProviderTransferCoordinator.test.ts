import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    CloudProviderTransferCoordinator,
    CloudTransferError,
} from './CloudProviderTransferCoordinator';
import type { CloudStorageLifecycleState } from './cloudStorageLifecycle';
import type { CloudTransferJournalV1 } from './cloudTransferJournal';
import {
    CloudFileStoreError,
    type CloudFileStore,
    type CloudNamespace,
    type CloudObjectMetadata,
} from './providers/CloudFileStore';
import { CloudManifestManager } from './providers/ManifestManager';

class MemoryFileStore implements CloudFileStore {
    readonly provider;
    private revision = 0;
    private readonly objects = new Map<string, { metadata: CloudObjectMetadata; bytes: ArrayBuffer }>();
    private readonly corruptedDownloads = new Set<string>();
    private readonly changingMetadata = new Set<string>();

    constructor(provider: 'google-drive' | 'dropbox') {
        this.provider = provider;
    }

    private key(namespace: CloudNamespace, logicalName: string) {
        return `${namespace}:${logicalName}`;
    }

    private async bytes(body: Blob): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => resolve(reader.result as ArrayBuffer));
            reader.addEventListener('error', () => reject(reader.error));
            reader.readAsArrayBuffer(body);
        });
    }

    private metadata(namespace: CloudNamespace, logicalName: string): CloudObjectMetadata {
        this.revision += 1;
        return {
            logicalName,
            opaqueId: `id:${namespace}:${logicalName}`,
            revision: `rev-${this.revision}`,
            modifiedTime: new Date(1_700_000_000_000 + this.revision * 1000).toISOString(),
        };
    }

    async list(namespace: CloudNamespace): Promise<CloudObjectMetadata[]> {
        return Array.from(this.objects.entries())
            .filter(([key]) => key.startsWith(`${namespace}:`))
            .map(([, value]) => structuredClone(value.metadata));
    }

    async getMetadata(
        namespace: CloudNamespace,
        logicalName: string,
    ): Promise<CloudObjectMetadata | null> {
        const key = this.key(namespace, logicalName);
        const entry = this.objects.get(key);
        if (!entry) return null;
        if (this.changingMetadata.has(logicalName)) {
            entry.metadata = this.metadata(namespace, logicalName);
        }
        return structuredClone(entry.metadata);
    }

    async download(object: CloudObjectMetadata): Promise<ArrayBuffer> {
        const entry = Array.from(this.objects.values())
            .find(value => value.metadata.opaqueId === object.opaqueId);
        if (!entry) {
            throw new CloudFileStoreError('not-found', 'fixture missing', { provider: this.provider });
        }
        const bytes = entry.bytes.slice(0);
        if (!this.corruptedDownloads.has(object.logicalName)) return bytes;
        const corrupted = new Uint8Array(bytes);
        if (corrupted.byteLength > 0) corrupted[0] ^= 0xff;
        return corrupted.buffer;
    }

    async create(
        namespace: CloudNamespace,
        logicalName: string,
        body: Blob,
    ): Promise<CloudObjectMetadata> {
        const key = this.key(namespace, logicalName);
        if (this.objects.has(key)) {
            throw new CloudFileStoreError('conflict', 'fixture conflict', { provider: this.provider });
        }
        const metadata = this.metadata(namespace, logicalName);
        this.objects.set(key, { metadata, bytes: await this.bytes(body) });
        return structuredClone(metadata);
    }

    async replace(
        object: CloudObjectMetadata,
        body: Blob,
        expectedRevision?: string,
    ): Promise<CloudObjectMetadata> {
        const entry = Array.from(this.objects.entries())
            .find(([, value]) => value.metadata.opaqueId === object.opaqueId);
        if (!entry || entry[1].metadata.revision !== expectedRevision) {
            throw new CloudFileStoreError('conflict', 'fixture conflict', { provider: this.provider });
        }
        const [key] = entry;
        const namespace = key.startsWith('backups:') ? 'backups' : 'sync';
        const metadata = this.metadata(namespace, object.logicalName);
        this.objects.set(key, { metadata, bytes: await this.bytes(body) });
        return structuredClone(metadata);
    }

    async delete(object: CloudObjectMetadata, expectedRevision?: string): Promise<void> {
        const entry = Array.from(this.objects.entries())
            .find(([, value]) => value.metadata.opaqueId === object.opaqueId);
        if (!entry) return;
        if (expectedRevision && entry[1].metadata.revision !== expectedRevision) {
            throw new CloudFileStoreError('conflict', 'fixture conflict', { provider: this.provider });
        }
        this.objects.delete(entry[0]);
    }

    has(namespace: CloudNamespace, logicalName: string): boolean {
        return this.objects.has(this.key(namespace, logicalName));
    }

    corruptDownload(logicalName: string): void {
        this.corruptedDownloads.add(logicalName);
    }

    changeMetadataOnEveryRead(logicalName: string): void {
        this.changingMetadata.add(logicalName);
    }
}

async function seedSource(manifest: CloudManifestManager, update: Uint8Array) {
    await manifest.load();
    const name = 'tasktime-yjs-core.bin';
    await manifest.createFile(name, new Blob([new Uint8Array(update)]));
    const metadata = await manifest.getFileMetadata(name);
    manifest.updateDocManifest('core', {
        stateFile: name,
        stateVersion: 1,
        lastCompaction: '2026-08-19T10:00:00.000Z',
        stateModifiedTime: metadata!.modifiedTime,
        deltas: [],
    });
    await manifest.save();
}

type ProviderId = 'google-drive' | 'dropbox';

const OWNER_ID = '42de9b18-445c-4d28-b5c9-88bc476fc7f1';
const WORKSPACE_ID = 'b0b8dbef-bb0b-46ea-99c1-e83aa10b6b23';

function createSnapshot(title = 'Transferred') {
    const doc = new Y.Doc();
    doc.getMap('projects').set('project-1', new Y.Map([['title', title]]));
    const snapshot = {
        documents: [{
            docName: 'core' as const,
            update: Y.encodeStateAsUpdate(doc),
            stateVector: Y.encodeStateVector(doc),
        }],
        portableBackup: {
            version: '1.4',
            exportDate: '2026-08-19T10:00:00.000Z',
            backupType: 'manual' as const,
            projects: [],
            tasks: [],
            timeEntries: [],
            invoices: [],
            paymentMethods: [],
            expenseCategories: [],
            taxReturnPeriods: [],
            businessInfos: [],
            businessBrandAssets: [],
            clients: [],
            invoiceTemplates: [],
            emailTemplates: [],
            expenses: [],
            expenseRecurrences: [],
            dailyGoals: [],
            plannerAttachments: [],
            preferences: {},
        },
    };
    doc.destroy();
    return snapshot;
}

function createLifecycle(sourceProvider: ProviderId, targetProvider: ProviderId): CloudStorageLifecycleState {
    return {
        version: 1,
        revision: 2,
        active: {
            provider: sourceProvider,
            sessionId: `${sourceProvider}-session-fixture`,
            generation: 2,
        },
        stagedTarget: {
            provider: targetProvider,
            sessionId: `${targetProvider}-session-fixture`,
            generation: 3,
            ownerId: OWNER_ID,
            sourceProvider,
            sourceGeneration: 2,
        },
        updatedAt: Date.now(),
    };
}

function createHarness(
    initialLifecycle: CloudStorageLifecycleState,
    snapshot = createSnapshot(),
    options: { failJournalStageOnce?: CloudTransferJournalV1['stage'] } = {},
) {
    let lifecycleState = structuredClone(initialLifecycle);
    let journal: CloudTransferJournalV1 | null = null;
    let failedStage = false;
    const store = {
        forceCloudSync: vi.fn(async () => {}),
        createCloudTransferSnapshot: vi.fn(async () => snapshot),
        mergeCloudTransferUpdates: vi.fn(async () => {}),
        isCloudTransferSnapshotCurrent: vi.fn(() => true),
        disconnectCloud: vi.fn(),
        setActiveCloudStorageScope: vi.fn(),
        connectCloud: vi.fn(async () => {}),
    };
    const activate = vi.fn(async () => {
        const staged = lifecycleState.stagedTarget;
        if (!staged) throw new Error('fixture staged target missing');
        lifecycleState = {
            ...lifecycleState,
            revision: lifecycleState.revision + 1,
            active: {
                provider: staged.provider,
                sessionId: staged.sessionId,
                generation: staged.generation,
            },
            stagedTarget: null,
        };
        return structuredClone(lifecycleState);
    });
    const update = vi.fn(async (
        _operationId: string,
        changes: Partial<CloudTransferJournalV1>,
    ) => {
        if (changes.stage === options.failJournalStageOnce && !failedStage) {
            failedStage = true;
            throw new Error(`crash after ${changes.stage}`);
        }
        journal = {
            ...journal!,
            ...changes,
            updatedAt: new Date().toISOString(),
        };
        return structuredClone(journal);
    });
    const coordinator = new CloudProviderTransferCoordinator(store as never, {
        lifecycle: {
            get: vi.fn(async () => structuredClone(lifecycleState)),
            activate,
        },
        journal: {
            read: vi.fn(async () => structuredClone(journal)),
            create: vi.fn(async value => { journal = structuredClone(value); }),
            update,
            clear: vi.fn(async operationId => {
                if (journal?.operationId !== operationId) return false;
                journal = null;
                return true;
            }),
            getWorkspaceId: vi.fn(async () => WORKSPACE_ID),
            bindWorkspaceId: vi.fn(async value => value),
        },
    });
    return {
        activate,
        coordinator,
        getJournal: () => structuredClone(journal),
        getLifecycle: () => structuredClone(lifecycleState),
        store,
        update,
    };
}

describe('CloudProviderTransferCoordinator', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        { sourceProvider: 'google-drive' as const, targetProvider: 'dropbox' as const },
        { sourceProvider: 'dropbox' as const, targetProvider: 'google-drive' as const },
    ])('verifies $sourceProvider to $targetProvider, activates the target, and preserves source data', async ({
        sourceProvider,
        targetProvider,
    }) => {
        const requestLock = vi.fn(async (
            _name: string,
            _options: LockOptions,
            callback: (lock: Lock) => Promise<unknown>,
        ) => callback({ name: 'tasktime-drive-sync', mode: 'exclusive' } as Lock));
        vi.stubGlobal('navigator', { locks: { request: requestLock }, onLine: true });
        const sourceFiles = new MemoryFileStore(sourceProvider);
        const targetFiles = new MemoryFileStore(targetProvider);
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const snapshot = createSnapshot();
        await seedSource(sourceManifest, snapshot.documents[0].update);
        await sourceManifest.createFile(
            'tasktime-backup-2026-08-18-0900.json',
            new Blob(['{"source":"retained"}']),
        );
        const harness = createHarness(
            createLifecycle(sourceProvider, targetProvider),
            snapshot,
        );
        const clearSourceSession = vi.fn(async () => undefined);
        const linkHostedServiceIdentity = vi.fn(async () => undefined);

        await harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
            clearSourceSession,
            linkHostedServiceIdentity,
        });

        expect(harness.getLifecycle().active).toMatchObject({ provider: targetProvider, generation: 3 });
        expect(harness.getJournal()).toBeNull();
        expect(sourceFiles.has('sync', 'tasktime-yjs-core.bin')).toBe(true);
        expect(sourceFiles.has('backups', 'tasktime-backup-2026-08-18-0900.json')).toBe(true);
        expect(targetFiles.has('sync', 'tasktime-yjs-core.bin')).toBe(true);
        expect((await sourceManifest.readCloudBindingMarker())).toMatchObject({
            state: 'moved',
            activeProvider: targetProvider,
        });
        expect((await targetManifest.readCloudBindingMarker())).toMatchObject({
            state: 'active',
            activeProvider: targetProvider,
        });
        expect(clearSourceSession).toHaveBeenCalledOnce();
        expect(linkHostedServiceIdentity).toHaveBeenCalledWith({
            source: expect.objectContaining({ provider: sourceProvider }),
            target: expect.objectContaining({ provider: targetProvider }),
        });
        expect(linkHostedServiceIdentity.mock.invocationCallOrder[0])
            .toBeLessThan(harness.activate.mock.invocationCallOrder[0]);
        expect(harness.store.connectCloud).toHaveBeenCalledWith(expect.objectContaining({
            provider: targetProvider,
            generation: 3,
        }), expect.any(Object));
        expect(harness.store.forceCloudSync.mock.calls.every(call => call[1])).toBe(true);
        expect(requestLock).toHaveBeenCalledOnce();
        expect(requestLock).toHaveBeenCalledWith(
            'tasktime-drive-sync',
            { ifAvailable: true },
            expect.any(Function),
        );
    });

    it('does not mark or activate the source when hosted-service identity linking fails', async () => {
        const sourceFiles = new MemoryFileStore('google-drive');
        const targetFiles = new MemoryFileStore('dropbox');
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const snapshot = createSnapshot();
        await seedSource(sourceManifest, snapshot.documents[0].update);
        const harness = createHarness(createLifecycle('google-drive', 'dropbox'), snapshot);

        await expect(harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
            linkHostedServiceIdentity: vi.fn(async () => {
                throw new Error('hosted identity unavailable');
            }),
        })).rejects.toThrow('hosted identity unavailable');

        expect(harness.getLifecycle().active?.provider).toBe('google-drive');
        expect(harness.activate).not.toHaveBeenCalled();
        expect((await sourceManifest.readCloudBindingMarker())).toMatchObject({ state: 'active' });
    });

    it('refuses a foreign target without changing lifecycle ownership', async () => {
        const lifecycle = {
            version: 1 as const,
            revision: 2,
            active: { provider: 'google-drive' as const, sessionId: 'google-session', generation: 2 },
            stagedTarget: {
                provider: 'dropbox' as const,
                sessionId: 'dropbox-session',
                generation: 3,
                ownerId: OWNER_ID,
                sourceProvider: 'google-drive' as const,
                sourceGeneration: 2,
            },
            updatedAt: Date.now(),
        };
        const source = new CloudManifestManager({ fileStore: new MemoryFileStore('google-drive') });
        const target = new CloudManifestManager({ fileStore: new MemoryFileStore('dropbox') });
        await source.load();
        await target.load();
        await target.writeCloudBindingMarker({
            version: 1,
            workspaceId: 'f85f92e3-1584-4d77-8292-3a9977adcf44',
            generation: 1,
            activeProvider: 'dropbox',
            state: 'active',
            updatedAt: '2026-08-19T10:00:00.000Z',
        });
        let journal: CloudTransferJournalV1 | null = null;
        const store = {
            forceCloudSync: vi.fn(async () => {}),
        };
        const activate = vi.fn();
        const coordinator = new CloudProviderTransferCoordinator(store as never, {
            lifecycle: { get: vi.fn(async () => lifecycle), activate },
            journal: {
                read: vi.fn(async () => journal),
                create: vi.fn(async value => { journal = value; }),
                update: vi.fn(async (_id, changes) => {
                    journal = { ...journal!, ...changes };
                    return journal;
                }),
                clear: vi.fn(),
                getWorkspaceId: vi.fn(async () => WORKSPACE_ID),
                bindWorkspaceId: vi.fn(async value => value),
            },
        });

        await expect(coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest: source,
            targetManifest: target,
        })).rejects.toEqual(expect.objectContaining<Partial<CloudTransferError>>({
            code: 'FOREIGN_TARGET',
        }));
        expect(activate).not.toHaveBeenCalled();
    });

    it('reconciles an existing target only when it carries the same workspace lineage', async () => {
        const sourceFiles = new MemoryFileStore('google-drive');
        const targetFiles = new MemoryFileStore('dropbox');
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const sourceSnapshot = createSnapshot('Source workspace');
        const targetSnapshot = createSnapshot('Prior target workspace');
        await seedSource(sourceManifest, sourceSnapshot.documents[0].update);
        await seedSource(targetManifest, targetSnapshot.documents[0].update);
        await targetManifest.writeCloudBindingMarker({
            version: 1,
            workspaceId: WORKSPACE_ID,
            generation: 1,
            activeProvider: 'dropbox',
            state: 'active',
            updatedAt: '2026-08-19T10:00:00.000Z',
        });
        const harness = createHarness(
            createLifecycle('google-drive', 'dropbox'),
            sourceSnapshot,
        );

        await harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        });

        expect(harness.store.mergeCloudTransferUpdates).toHaveBeenCalledOnce();
        expect(harness.getLifecycle().active?.provider).toBe('dropbox');
        expect((await targetManifest.readCloudBindingMarker())).toMatchObject({
            workspaceId: WORKSPACE_ID,
            state: 'active',
            activeProvider: 'dropbox',
        });
    });

    it('keeps the source active when target readback is corrupt', async () => {
        const sourceFiles = new MemoryFileStore('google-drive');
        const targetFiles = new MemoryFileStore('dropbox');
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const snapshot = createSnapshot();
        await seedSource(sourceManifest, snapshot.documents[0].update);
        targetFiles.corruptDownload('tasktime-yjs-core.bin');
        const harness = createHarness(createLifecycle('google-drive', 'dropbox'), snapshot);

        await expect(harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        })).rejects.toEqual(expect.objectContaining<Partial<CloudTransferError>>({
            code: 'TARGET_VERIFICATION_FAILED',
        }));

        expect(harness.getLifecycle().active?.provider).toBe('google-drive');
        expect(harness.getJournal()?.stage).toBe('target-prepared');
        expect((await sourceManifest.readCloudBindingMarker())).toMatchObject({
            state: 'active',
            activeProvider: 'google-drive',
        });
        expect(harness.activate).not.toHaveBeenCalled();
    });

    it('stops without activation when the source manifest keeps changing', async () => {
        const sourceFiles = new MemoryFileStore('google-drive');
        const targetFiles = new MemoryFileStore('dropbox');
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const snapshot = createSnapshot();
        await seedSource(sourceManifest, snapshot.documents[0].update);
        await sourceManifest.writeCloudBindingMarker({
            version: 1,
            workspaceId: WORKSPACE_ID,
            generation: 2,
            activeProvider: 'google-drive',
            state: 'active',
            updatedAt: '2026-08-19T10:00:00.000Z',
        });
        sourceFiles.changeMetadataOnEveryRead('tasktime-yjs-manifest.json');
        const harness = createHarness(createLifecycle('google-drive', 'dropbox'), snapshot);

        await expect(harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        })).rejects.toEqual(expect.objectContaining<Partial<CloudTransferError>>({
            code: 'SOURCE_CHANGED',
            message: 'Your data changed during the transfer. Close TaskTime on your other devices and try again.',
        }));

        expect(harness.store.createCloudTransferSnapshot).toHaveBeenCalledTimes(3);
        expect(harness.getLifecycle().active?.provider).toBe('google-drive');
        expect(harness.activate).not.toHaveBeenCalled();
        expect((await sourceManifest.readCloudBindingMarker())).toMatchObject({ state: 'active' });
    });

    it('resumes when the browser stops after publishing the source move marker', async () => {
        const sourceFiles = new MemoryFileStore('google-drive');
        const targetFiles = new MemoryFileStore('dropbox');
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const snapshot = createSnapshot();
        await seedSource(sourceManifest, snapshot.documents[0].update);
        const harness = createHarness(
            createLifecycle('google-drive', 'dropbox'),
            snapshot,
            { failJournalStageOnce: 'source-marked' },
        );

        await expect(harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        })).rejects.toThrow('crash after source-marked');
        expect(harness.getJournal()?.stage).toBe('target-verified');
        expect((await sourceManifest.readCloudBindingMarker())).toMatchObject({ state: 'moved' });
        expect(harness.getLifecycle().active?.provider).toBe('google-drive');

        await harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        });

        expect(harness.getLifecycle().active?.provider).toBe('dropbox');
        expect(harness.getJournal()).toBeNull();
        expect(harness.activate).toHaveBeenCalledOnce();
    });

    it('resumes when activation committed before the journal advanced', async () => {
        const sourceFiles = new MemoryFileStore('dropbox');
        const targetFiles = new MemoryFileStore('google-drive');
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const snapshot = createSnapshot();
        await seedSource(sourceManifest, snapshot.documents[0].update);
        const harness = createHarness(
            createLifecycle('dropbox', 'google-drive'),
            snapshot,
            { failJournalStageOnce: 'activated' },
        );

        await expect(harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        })).rejects.toThrow('crash after activated');
        expect(harness.getLifecycle().active?.provider).toBe('google-drive');
        expect(harness.getJournal()?.stage).toBe('source-marked');

        await harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        });

        expect(harness.getLifecycle().active?.provider).toBe('google-drive');
        expect(harness.getJournal()).toBeNull();
        expect(harness.activate).toHaveBeenCalledOnce();
    });

    it('keeps the activated transfer recoverable when source-session cleanup fails', async () => {
        const sourceFiles = new MemoryFileStore('google-drive');
        const targetFiles = new MemoryFileStore('dropbox');
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const snapshot = createSnapshot();
        await seedSource(sourceManifest, snapshot.documents[0].update);
        const harness = createHarness(
            createLifecycle('google-drive', 'dropbox'),
            snapshot,
        );
        const failedCleanup = vi.fn(async () => {
            throw new Error('source session cleanup unavailable');
        });

        await expect(harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
            linkHostedServiceIdentity: vi.fn(async () => undefined),
            clearSourceSession: failedCleanup,
        })).rejects.toThrow('source session cleanup unavailable');

        expect(harness.getLifecycle().active?.provider).toBe('dropbox');
        expect(harness.getJournal()?.stage).toBe('activated');
        expect((await sourceManifest.readCloudBindingMarker())).toMatchObject({
            state: 'moved',
            activeProvider: 'dropbox',
        });
        expect(harness.store.connectCloud).not.toHaveBeenCalled();

        const recoveredCleanup = vi.fn(async () => undefined);
        await harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
            clearSourceSession: recoveredCleanup,
        });

        expect(recoveredCleanup).toHaveBeenCalledOnce();
        expect(harness.getJournal()).toBeNull();
        expect(harness.store.connectCloud).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'dropbox',
            generation: 3,
        }), expect.any(Object));
        expect(harness.activate).toHaveBeenCalledOnce();
    });

    it('rejects an unknown future source document instead of omitting it', async () => {
        const sourceFiles = new MemoryFileStore('google-drive');
        const targetFiles = new MemoryFileStore('dropbox');
        const sourceManifest = new CloudManifestManager({ fileStore: sourceFiles });
        const targetManifest = new CloudManifestManager({ fileStore: targetFiles });
        const snapshot = createSnapshot();
        await seedSource(sourceManifest, snapshot.documents[0].update);
        sourceManifest.updateDocManifest('entries-future-format', {
            stateFile: 'tasktime-yjs-entries-future-format.bin',
            stateVersion: 1,
            lastCompaction: '2026-08-19T10:00:00.000Z',
            deltas: [],
        });
        await sourceManifest.save();
        const harness = createHarness(createLifecycle('google-drive', 'dropbox'), snapshot);

        await expect(harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        })).rejects.toEqual(expect.objectContaining<Partial<CloudTransferError>>({
            code: 'UNSUPPORTED_SOURCE_DOCUMENT',
        }));

        expect(harness.getLifecycle().active?.provider).toBe('google-drive');
        expect(harness.activate).not.toHaveBeenCalled();
        expect(targetFiles.has('sync', 'tasktime-cloud-binding.json')).toBe(false);
    });

    it('fails immediately when another tab owns the shared sync lock', async () => {
        const requestLock = vi.fn(async (
            _name: string,
            _options: LockOptions,
            callback: (lock: Lock | null) => Promise<unknown>,
        ) => callback(null));
        vi.stubGlobal('navigator', { locks: { request: requestLock }, onLine: true });
        const harness = createHarness(createLifecycle('google-drive', 'dropbox'));
        const sourceManifest = new CloudManifestManager({
            fileStore: new MemoryFileStore('google-drive'),
        });
        const targetManifest = new CloudManifestManager({
            fileStore: new MemoryFileStore('dropbox'),
        });

        await expect(harness.coordinator.run({
            ownerId: OWNER_ID,
            sourceManifest,
            targetManifest,
        })).rejects.toEqual(expect.objectContaining<Partial<CloudTransferError>>({
            code: 'LOCK_UNAVAILABLE',
        }));
        expect(harness.store.forceCloudSync).not.toHaveBeenCalled();
        expect(harness.getJournal()).toBeNull();
    });
});
