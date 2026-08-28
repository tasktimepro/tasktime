import * as Y from 'yjs';

import {
    activateStagedCloudStorageSession,
    getCloudStorageLifecycle,
    type CloudStorageLifecycleState,
    type CloudStorageSessionRef,
} from './cloudStorageLifecycle';
import {
    bindCloudWorkspaceId,
    clearCloudTransferJournal,
    createCloudTransferJournal,
    getOrCreateCloudWorkspaceId,
    readCloudTransferJournal,
    updateCloudTransferJournal,
    type CloudTransferJournalV1,
    type CloudTransferStage,
} from './cloudTransferJournal';
import {
    CloudFileStoreError,
    type CloudBindingMarkerV1,
    type CloudManifestFingerprint,
    type CloudManifestManager,
    type CloudProviderId,
    type CloudSyncLockPermit,
    withCloudSyncExclusiveLock,
} from './providers';
import {
    YjsStore,
    type CloudTransferWorkspaceSnapshot,
} from './YjsStore';
import type { DocName } from './types';

const MAX_VERIFICATION_ATTEMPTS = 3;

export type CloudTransferErrorCode =
    | 'ACTIVE_SOURCE_MISMATCH'
    | 'FOREIGN_TARGET'
    | 'LOCK_UNAVAILABLE'
    | 'SOURCE_CHANGED'
    | 'TARGET_VERIFICATION_FAILED'
    | 'TRANSFER_STATE_CHANGED'
    | 'UNSUPPORTED_SOURCE_DOCUMENT';

export class CloudTransferError extends Error {
    readonly code: CloudTransferErrorCode;

    constructor(code: CloudTransferErrorCode, message: string) {
        super(message);
        this.name = 'CloudTransferError';
        this.code = code;
    }
}

interface TransferLifecyclePort {
    get(): Promise<CloudStorageLifecycleState>;
    activate(ownerId: string): Promise<CloudStorageLifecycleState>;
}

interface TransferJournalPort {
    read(): Promise<CloudTransferJournalV1 | null>;
    create(journal: CloudTransferJournalV1): Promise<void>;
    update(
        operationId: string,
        changes: Parameters<typeof updateCloudTransferJournal>[1],
    ): Promise<CloudTransferJournalV1>;
    clear(operationId: string): Promise<boolean>;
    getWorkspaceId(): Promise<string>;
    bindWorkspaceId(workspaceId: string): Promise<string>;
}

export interface CloudProviderTransferOptions {
    ownerId: string;
    sourceManifest: CloudManifestManager;
    targetManifest: CloudManifestManager;
    linkHostedServiceIdentity?: (providers: {
        source: CloudStorageSessionRef;
        target: CloudStorageSessionRef;
    }) => Promise<void>;
    clearSourceSession?: () => Promise<void>;
    onStage?: (stage: CloudTransferStage) => void;
}

interface CoordinatorOptions {
    lifecycle?: TransferLifecyclePort;
    journal?: TransferJournalPort;
}

const DEFAULT_LIFECYCLE: TransferLifecyclePort = {
    get: getCloudStorageLifecycle,
    activate: activateStagedCloudStorageSession,
};

const DEFAULT_JOURNAL: TransferJournalPort = {
    read: readCloudTransferJournal,
    create: createCloudTransferJournal,
    update: updateCloudTransferJournal,
    clear: clearCloudTransferJournal,
    getWorkspaceId: getOrCreateCloudWorkspaceId,
    bindWorkspaceId: bindCloudWorkspaceId,
};

function isManagedDocName(value: string): value is DocName {
    return value === 'core'
        || value === 'entries-active'
        || value === 'tasks-archived'
        || value === 'invoices-archived'
        || value === 'expenses-archived'
        || /^entries-\d{4}$/.test(value);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
    return left.byteLength === right.byteLength
        && left.every((value, index) => value === right[index]);
}

function equalFingerprint(
    left: CloudManifestFingerprint | null,
    right: CloudManifestFingerprint | null,
): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function stageAtOrAfter(stage: CloudTransferStage, expected: CloudTransferStage): boolean {
    const stages: CloudTransferStage[] = [
        'preparing-source',
        'target-inspected',
        'uploading-target',
        'target-prepared',
        'target-verified',
        'source-marked',
        'activated',
        'finalizing',
    ];
    return stages.indexOf(stage) >= stages.indexOf(expected);
}

function assertSupportedSourceManifest(manifest: CloudManifestManager): void {
    const unsupported = Object.keys(manifest.getManifest()?.documents ?? {})
        .find(docName => !isManagedDocName(docName));
    if (unsupported) {
        throw new CloudTransferError(
            'UNSUPPORTED_SOURCE_DOCUMENT',
            'This workspace contains data from a newer TaskTime version. Update the app before transferring it.',
        );
    }
}

function isJournalSourceMarker(
    marker: CloudBindingMarkerV1 | null,
    journal: CloudTransferJournalV1,
): boolean {
    return Boolean(
        marker
        && marker.workspaceId === journal.workspaceId
        && marker.operationId === journal.operationId
        && marker.state === 'moved'
        && marker.activeProvider === journal.targetProvider
        && marker.generation === journal.targetGeneration,
    );
}

async function withTransferLock<T>(
    operation: (permit: CloudSyncLockPermit) => Promise<T>,
): Promise<T> {
    const result = await withCloudSyncExclusiveLock(operation);
    if (!result.acquired) {
        throw new CloudTransferError(
            'LOCK_UNAVAILABLE',
            'Another tab is using cloud sync. Close it or wait, then retry the transfer.',
        );
    }
    return result.value;
}

function bindingMarker(
    journal: CloudTransferJournalV1,
    state: CloudBindingMarkerV1['state'],
    provider: CloudProviderId,
): CloudBindingMarkerV1 {
    return {
        version: 1,
        workspaceId: journal.workspaceId,
        generation: journal.targetGeneration,
        activeProvider: provider,
        state,
        operationId: journal.operationId,
        updatedAt: new Date().toISOString(),
    };
}

function validateLifecycleForTransfer(
    lifecycle: CloudStorageLifecycleState,
    ownerId: string,
): { source: CloudStorageSessionRef; target: CloudStorageSessionRef } {
    const source = lifecycle.active;
    const target = lifecycle.stagedTarget;
    if (!source || !target
        || target.ownerId !== ownerId
        || target.sourceProvider !== source.provider
        || target.sourceGeneration !== source.generation) {
        throw new CloudTransferError(
            'TRANSFER_STATE_CHANGED',
            'The provider transfer state changed. The source remains active.',
        );
    }
    return { source, target };
}

async function readManifestUpdates(
    manifest: CloudManifestManager,
): Promise<Array<{ docName: DocName; update: Uint8Array }>> {
    const remote = manifest.getManifest();
    if (!remote) return [];
    const updates: Array<{ docName: DocName; update: Uint8Array }> = [];
    for (const [rawDocName, doc] of Object.entries(remote.documents)) {
        if (!isManagedDocName(rawDocName)) {
            throw new CloudTransferError(
                'FOREIGN_TARGET',
                'The target contains an unsupported TaskTime document.',
            );
        }
        const stateId = await manifest.getFileIdWithFallback(doc.stateFile);
        if (!stateId) {
            throw new CloudTransferError(
                'TARGET_VERIFICATION_FAILED',
                'The target workspace is missing a referenced document.',
            );
        }
        updates.push({
            docName: rawDocName,
            update: new Uint8Array(await manifest.downloadFileAsArrayBuffer(stateId)),
        });
        for (const delta of doc.deltas) {
            const deltaName = `tasktime-yjs-${rawDocName}-delta-${delta.id}.bin`;
            const deltaId = await manifest.getFileIdWithFallback(deltaName);
            if (!deltaId) {
                throw new CloudTransferError(
                    'TARGET_VERIFICATION_FAILED',
                    'The target workspace is missing a referenced update.',
                );
            }
            updates.push({
                docName: rawDocName,
                update: new Uint8Array(await manifest.downloadFileAsArrayBuffer(deltaId)),
            });
        }
    }
    return updates;
}

export class CloudProviderTransferCoordinator {
    private readonly store: YjsStore;
    private readonly lifecycle: TransferLifecyclePort;
    private readonly journal: TransferJournalPort;

    constructor(store: YjsStore, options: CoordinatorOptions = {}) {
        this.store = store;
        this.lifecycle = options.lifecycle ?? DEFAULT_LIFECYCLE;
        this.journal = options.journal ?? DEFAULT_JOURNAL;
    }

    async run(options: CloudProviderTransferOptions): Promise<void> {
        return withTransferLock(permit => this.runLocked(options, permit));
    }

    private async setStage(
        operationId: string,
        stage: CloudTransferStage,
        options: CloudProviderTransferOptions,
        changes: Parameters<TransferJournalPort['update']>[1] = {},
    ): Promise<CloudTransferJournalV1> {
        const next = await this.journal.update(operationId, { ...changes, stage });
        options.onStage?.(stage);
        return next;
    }

    private async runLocked(
        options: CloudProviderTransferOptions,
        lockPermit: CloudSyncLockPermit,
    ): Promise<void> {
        let journal = await this.journal.read();
        const isResume = journal !== null;
        let lifecycle = await this.lifecycle.get();

        if (!journal) {
            const { source, target } = validateLifecycleForTransfer(lifecycle, options.ownerId);
            if (source.provider !== options.sourceManifest.getProviderId()
                || target.provider !== options.targetManifest.getProviderId()) {
                throw new CloudTransferError(
                    'ACTIVE_SOURCE_MISMATCH',
                    'The connected providers do not match the staged transfer.',
                );
            }
            const existingSourceBinding = await options.sourceManifest.readCloudBindingMarker();
            let workspaceId: string;
            if (existingSourceBinding) {
                if (existingSourceBinding.activeProvider !== source.provider
                    || existingSourceBinding.state === 'moved') {
                    throw new CloudTransferError(
                        'ACTIVE_SOURCE_MISMATCH',
                        'The source provider says this workspace has already moved.',
                    );
                }
                workspaceId = await this.journal.bindWorkspaceId(existingSourceBinding.workspaceId);
            } else {
                workspaceId = await this.journal.getWorkspaceId();
            }
            const now = new Date().toISOString();
            journal = {
                version: 1,
                operationId: crypto.randomUUID(),
                ownerId: options.ownerId,
                workspaceId,
                sourceProvider: source.provider,
                sourceGeneration: source.generation,
                targetProvider: target.provider,
                targetGeneration: target.generation,
                stage: 'preparing-source',
                sourceFingerprint: null,
                documentNames: [],
                handoffBackupName: null,
                startedAt: now,
                updatedAt: now,
            };
            await this.journal.create(journal);
            options.onStage?.('preparing-source');
        } else if (journal.ownerId !== options.ownerId
            || journal.sourceProvider !== options.sourceManifest.getProviderId()
            || journal.targetProvider !== options.targetManifest.getProviderId()) {
            throw new CloudTransferError(
                'TRANSFER_STATE_CHANGED',
                'Another provider transfer owns the recovery journal.',
            );
        }

        if (stageAtOrAfter(journal.stage, 'source-marked')) {
            await this.finishAfterSourceMarker(journal, options, lifecycle, lockPermit);
            return;
        }

        if (isResume) {
            const sourceMarker = await options.sourceManifest.readCloudBindingMarker();
            if (sourceMarker?.state === 'moved') {
                if (!isJournalSourceMarker(sourceMarker, journal)) {
                    throw new CloudTransferError(
                        'ACTIVE_SOURCE_MISMATCH',
                        'The source provider was moved by a different transfer.',
                    );
                }
                // The tab may have stopped after publishing the source marker
                // but before advancing the local journal. Touch the manifest so
                // upgraded clients with a warm cache observe the move, then
                // continue forward without ever writing workspace data back to
                // the former provider.
                await options.sourceManifest.load();
                options.sourceManifest.markDirty();
                await options.sourceManifest.save();
                journal = await this.setStage(
                    journal.operationId,
                    'source-marked',
                    options,
                );
                lifecycle = await this.lifecycle.get();
                await this.finishAfterSourceMarker(
                    journal,
                    options,
                    lifecycle,
                    lockPermit,
                );
                return;
            }
        }

        await this.store.forceCloudSync(
            { allowPull: true, forceFullState: true },
            lockPermit,
        );
        assertSupportedSourceManifest(options.sourceManifest);
        const sourceBinding = await options.sourceManifest.readCloudBindingMarker();
        if (!sourceBinding) {
            await options.sourceManifest.writeCloudBindingMarker({
                version: 1,
                workspaceId: journal.workspaceId,
                generation: journal.sourceGeneration,
                activeProvider: journal.sourceProvider,
                state: 'active',
                updatedAt: new Date().toISOString(),
            });
            options.sourceManifest.markDirty();
            await options.sourceManifest.save();
        } else if (sourceBinding.workspaceId !== journal.workspaceId) {
            throw new CloudTransferError('ACTIVE_SOURCE_MISMATCH', 'The source workspace lineage changed.');
        }

        const targetFiles = await options.targetManifest.listSyncFiles();
        await options.targetManifest.load();
        const targetBinding = await options.targetManifest.readCachedCloudBindingMarker();
        const hasReservedTargetFiles = targetFiles.some(file => (
            file.name.startsWith('tasktime-yjs-')
            || file.name === 'tasktime-cloud-binding.json'
        ));
        if (hasReservedTargetFiles && !targetBinding) {
            throw new CloudTransferError(
                'FOREIGN_TARGET',
                'The target contains unbound TaskTime files and was not changed.',
            );
        }
        if (targetBinding && targetBinding.workspaceId !== journal.workspaceId) {
            throw new CloudTransferError(
                'FOREIGN_TARGET',
                'The target belongs to a different TaskTime workspace and was not changed.',
            );
        }
        journal = await this.setStage(journal.operationId, 'target-inspected', options);

        if (targetBinding) {
            const targetUpdates = await readManifestUpdates(options.targetManifest);
            await this.store.mergeCloudTransferUpdates(targetUpdates);
            await this.store.forceCloudSync(
                { allowPull: false, forceFullState: true },
                lockPermit,
            );
        }
        await options.targetManifest.writeCloudBindingMarker(
            bindingMarker(journal, 'transfer-prepared', journal.targetProvider),
        );

        for (let attempt = 0; attempt < MAX_VERIFICATION_ATTEMPTS; attempt += 1) {
            const sourceFingerprint = await options.sourceManifest.getRemoteManifestFingerprint();
            const snapshot = await this.store.createCloudTransferSnapshot();
            journal = await this.setStage(journal.operationId, 'uploading-target', options, {
                sourceFingerprint,
                documentNames: snapshot.documents.map(({ docName }) => docName),
            });
            const handoffBackupName = journal.handoffBackupName
                ?? this.createHandoffBackupName(journal.operationId);
            await this.uploadTarget(snapshot, options.targetManifest, handoffBackupName);
            journal = await this.setStage(journal.operationId, 'target-prepared', options, {
                handoffBackupName,
            });
            await this.verifyTarget(snapshot, options.targetManifest, handoffBackupName, journal);

            if (!this.store.isCloudTransferSnapshotCurrent(snapshot)) {
                await this.store.forceCloudSync(
                    { allowPull: false, forceFullState: true },
                    lockPermit,
                );
                continue;
            }
            const recheckedSource = await options.sourceManifest.getRemoteManifestFingerprint();
            if (!equalFingerprint(sourceFingerprint, recheckedSource)) {
                await this.store.forceCloudSync(
                    { allowPull: true, forceFullState: true },
                    lockPermit,
                );
                continue;
            }

            journal = await this.setStage(journal.operationId, 'target-verified', options);
            lifecycle = await this.lifecycle.get();
            const identityProviders = validateLifecycleForTransfer(
                lifecycle,
                options.ownerId,
            );
            if (identityProviders.source.provider !== journal.sourceProvider
                || identityProviders.source.generation !== journal.sourceGeneration
                || identityProviders.target.provider !== journal.targetProvider
                || identityProviders.target.generation !== journal.targetGeneration) {
                throw new CloudTransferError(
                    'TRANSFER_STATE_CHANGED',
                    'The provider transfer state changed before hosted services could move.',
                );
            }
            await options.linkHostedServiceIdentity?.({
                source: identityProviders.source,
                target: identityProviders.target,
            });
            await options.sourceManifest.writeCloudBindingMarker(
                bindingMarker(journal, 'moved', journal.targetProvider),
            );
            options.sourceManifest.markDirty();
            await options.sourceManifest.save();
            journal = await this.setStage(journal.operationId, 'source-marked', options);
            lifecycle = await this.lifecycle.get();
            await this.finishAfterSourceMarker(
                journal,
                options,
                lifecycle,
                lockPermit,
                snapshot,
            );
            return;
        }

        throw new CloudTransferError(
            'SOURCE_CHANGED',
            'Your data changed during the transfer. Close TaskTime on your other devices and try again.',
        );
    }

    private createHandoffBackupName(operationId: string): string {
        const now = new Date().toISOString();
        const date = now.slice(0, 10);
        const time = now.slice(11, 19).replace(/:/g, '');
        return `tasktime-backup-${date}-${time}-${operationId.slice(0, 8)}.json`;
    }

    private async uploadTarget(
        snapshot: CloudTransferWorkspaceSnapshot,
        target: CloudManifestManager,
        handoffBackupName: string,
    ): Promise<void> {
        const deltasToDelete: string[] = [];
        for (const document of snapshot.documents) {
            const fileName = `tasktime-yjs-${document.docName}.bin`;
            const body = new Blob([new Uint8Array(document.update)]);
            const existing = await target.getFileIdWithFallback(fileName);
            if (existing) {
                await target.updateFile(existing, fileName, body);
            } else {
                await target.createFile(fileName, body);
            }
            const metadata = await target.getFileMetadata(fileName);
            if (!metadata) {
                throw new CloudTransferError(
                    'TARGET_VERIFICATION_FAILED',
                    'The target did not retain an uploaded TaskTime document.',
                );
            }
            const current = target.getDocManifest(document.docName);
            const oldDeltas = current?.deltas ?? [];
            oldDeltas.forEach(delta => {
                deltasToDelete.push(`tasktime-yjs-${document.docName}-delta-${delta.id}.bin`);
            });
            target.updateDocManifest(document.docName, {
                stateFile: fileName,
                stateVersion: (current?.stateVersion ?? 0) + 1,
                lastCompaction: new Date().toISOString(),
                stateModifiedTime: metadata.modifiedTime,
                deltas: [],
                compactedDeltaIds: Array.from(new Set([
                    ...(current?.compactedDeltaIds ?? []),
                    ...oldDeltas.map(delta => delta.id),
                ])).slice(-512),
            });
        }
        const backup = new Blob(
            [JSON.stringify(snapshot.portableBackup, null, 2)],
            { type: 'application/json' },
        );
        const existingBackup = await target.getFileIdWithFallback(handoffBackupName);
        if (existingBackup) await target.updateFile(existingBackup, handoffBackupName, backup);
        else await target.createFile(handoffBackupName, backup);

        // Publish the target manifest only after every referenced state body and
        // the handoff backup exists. Old deltas are removed only after the new
        // manifest no longer references them.
        await target.save();
        for (const deltaName of deltasToDelete) {
            await target.deleteFileByName(deltaName);
        }
    }

    private async verifyTarget(
        snapshot: CloudTransferWorkspaceSnapshot,
        target: CloudManifestManager,
        handoffBackupName: string,
        journal: CloudTransferJournalV1,
    ): Promise<void> {
        await target.reload();
        const remote = target.getManifest();
        if (!remote) {
            throw new CloudTransferError('TARGET_VERIFICATION_FAILED', 'The target manifest is missing.');
        }
        const expectedNames = new Set(snapshot.documents.map(({ docName }) => docName));
        if (Object.keys(remote.documents).some(name => !expectedNames.has(name as DocName))) {
            throw new CloudTransferError(
                'TARGET_VERIFICATION_FAILED',
                'The target manifest contains an unexpected document.',
            );
        }
        for (const document of snapshot.documents) {
            const remoteDoc = remote.documents[document.docName];
            if (!remoteDoc) {
                throw new CloudTransferError(
                    'TARGET_VERIFICATION_FAILED',
                    'The target manifest omitted a managed document.',
                );
            }
            const verification = new Y.Doc();
            try {
                const stateId = await target.getFileIdWithFallback(remoteDoc.stateFile);
                if (!stateId) throw new Error('missing state');
                Y.applyUpdate(verification, new Uint8Array(
                    await target.downloadFileAsArrayBuffer(stateId),
                ));
                for (const delta of remoteDoc.deltas) {
                    const deltaName = `tasktime-yjs-${document.docName}-delta-${delta.id}.bin`;
                    const deltaId = await target.getFileIdWithFallback(deltaName);
                    if (!deltaId) throw new Error('missing delta');
                    Y.applyUpdate(verification, new Uint8Array(
                        await target.downloadFileAsArrayBuffer(deltaId),
                    ));
                }
                if (!equalBytes(Y.encodeStateVector(verification), document.stateVector)) {
                    throw new Error('state vector mismatch');
                }
            } catch {
                throw new CloudTransferError(
                    'TARGET_VERIFICATION_FAILED',
                    'The target could not reconstruct the complete TaskTime workspace.',
                );
            } finally {
                verification.destroy();
            }
        }
        const backupId = await target.getFileIdWithFallback(handoffBackupName);
        if (!backupId) {
            throw new CloudTransferError(
                'TARGET_VERIFICATION_FAILED',
                'The target handoff backup is missing.',
            );
        }
        const backupBytes = await target.downloadFileAsArrayBuffer(backupId);
        if (new TextDecoder().decode(backupBytes)
            !== JSON.stringify(snapshot.portableBackup, null, 2)) {
            throw new CloudTransferError(
                'TARGET_VERIFICATION_FAILED',
                'The target handoff backup did not verify.',
            );
        }
        const marker = await target.readCloudBindingMarker();
        if (!marker
            || marker.workspaceId !== journal.workspaceId
            || marker.operationId !== journal.operationId
            || marker.state !== 'transfer-prepared') {
            throw new CloudTransferError(
                'TARGET_VERIFICATION_FAILED',
                'The target transfer marker did not verify.',
            );
        }
    }

    private async finishAfterSourceMarker(
        journal: CloudTransferJournalV1,
        options: CloudProviderTransferOptions,
        lifecycle: CloudStorageLifecycleState,
        lockPermit: CloudSyncLockPermit,
        knownSnapshot?: CloudTransferWorkspaceSnapshot,
    ): Promise<void> {
        const snapshot = knownSnapshot ?? await this.store.createCloudTransferSnapshot();
        if (!stageAtOrAfter(journal.stage, 'activated')) {
            const handoffBackupName = journal.handoffBackupName
                ?? this.createHandoffBackupName(journal.operationId);
            if (!knownSnapshot) {
                // Recovery after the source marker may include local edits made
                // before the tab stopped. Re-stage and verify them on the target;
                // never resume writes to the moved source.
                await this.uploadTarget(snapshot, options.targetManifest, handoffBackupName);
                await options.targetManifest.writeCloudBindingMarker(
                    bindingMarker(journal, 'transfer-prepared', journal.targetProvider),
                );
                if (!journal.handoffBackupName) {
                    journal = await this.journal.update(journal.operationId, {
                        handoffBackupName,
                    });
                }
            }
            await this.verifyTarget(
                snapshot,
                options.targetManifest,
                handoffBackupName,
                journal,
            );
            const alreadyActivated = lifecycle.active?.provider === journal.targetProvider
                && lifecycle.active.generation === journal.targetGeneration
                && lifecycle.stagedTarget === null;
            if (!alreadyActivated) {
                const { source, target } = validateLifecycleForTransfer(lifecycle, journal.ownerId);
                if (source.provider !== journal.sourceProvider
                    || source.generation !== journal.sourceGeneration
                    || target.provider !== journal.targetProvider
                    || target.generation !== journal.targetGeneration) {
                    throw new CloudTransferError(
                        'TRANSFER_STATE_CHANGED',
                        'The provider lifecycle changed before activation.',
                    );
                }
                await this.lifecycle.activate(journal.ownerId);
            }
            journal = await this.setStage(journal.operationId, 'activated', options);
        }

        await options.targetManifest.writeCloudBindingMarker(
            bindingMarker(journal, 'active', journal.targetProvider),
        );
        await options.clearSourceSession?.();
        this.store.disconnectCloud();
        this.store.setActiveCloudStorageScope({
            provider: journal.targetProvider,
            generation: journal.targetGeneration,
        });
        await this.store.connectCloud({
            provider: journal.targetProvider,
            generation: journal.targetGeneration,
            manifest: options.targetManifest,
        }, lockPermit);
        journal = await this.setStage(journal.operationId, 'finalizing', options);
        await this.store.forceCloudSync(
            { allowPull: false, forceFullState: true },
            lockPermit,
        );
        const cleared = await this.journal.clear(journal.operationId);
        if (!cleared) {
            throw new CloudTransferError(
                'TRANSFER_STATE_CHANGED',
                'The completed transfer journal changed before cleanup.',
            );
        }
    }
}

export function isRecoverableCloudTransferError(error: unknown): boolean {
    return error instanceof CloudTransferError
        || error instanceof CloudFileStoreError;
}
