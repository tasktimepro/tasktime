import { openDB } from 'idb';

import type { CloudProviderId } from './providers/CloudFileStore';

const DB_NAME = 'tasktime-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';
const LIFECYCLE_KEY = 'cloud-storage-lifecycle-v1';
const LEGACY_GOOGLE_SESSION_KEY = 'google-auth-session';
const DROPBOX_SESSION_KEY = 'dropbox-auth-session';
const INVALIDATION_CHANNEL = 'tasktime-cloud-storage-lifecycle';
export const CLOUD_STORAGE_LIFECYCLE_EVENT = 'tasktime:cloud-storage-lifecycle-changed';

export type CloudStorageSessionRole = 'active' | 'staged' | 'inactive';

export interface CloudStorageSessionRef {
    provider: CloudProviderId;
    sessionId: string;
    generation: number;
}

export interface StagedCloudStorageSessionRef extends CloudStorageSessionRef {
    ownerId: string;
    sourceProvider: CloudProviderId;
    sourceGeneration: number;
}

export interface CloudStorageLifecycleState {
    version: 1;
    revision: number;
    active: CloudStorageSessionRef | null;
    stagedTarget: StagedCloudStorageSessionRef | null;
    updatedAt: number;
}

export interface CloudStorageIdentityBinding {
    activeStorageProvider: CloudProviderId | null;
    activeStorageSessionId: string | null;
    activeStorageGeneration: number | null;
    hostedServiceSessionId: string | null;
    isGoogleStorageActive: boolean;
}

export interface CloudStorageAuthSessions {
    googleSessionId: string | null;
    dropboxSessionId: string | null;
}

type LifecycleErrorCode =
    | 'ACTIVE_PROVIDER_CONFLICT'
    | 'INVALID_LIFECYCLE_STATE'
    | 'INVALID_OWNER'
    | 'INVALID_SESSION'
    | 'STAGED_TARGET_OWNED'
    | 'STORAGE_UNAVAILABLE'
    | 'TARGET_PROVIDER_MATCHES_SOURCE'
    | 'TRANSFER_IN_PROGRESS'
    | 'TRANSFER_SOURCE_CHANGED';

export class CloudStorageLifecycleError extends Error {
    readonly code: LifecycleErrorCode;

    constructor(code: LifecycleErrorCode, message: string) {
        super(message);
        this.name = 'CloudStorageLifecycleError';
        this.code = code;
    }
}

function getDb() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        },
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProvider(value: unknown): value is CloudProviderId {
    return value === 'google-drive' || value === 'dropbox';
}

function isSessionId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

function isGeneration(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseSessionRef(value: unknown): CloudStorageSessionRef | null {
    if (!isRecord(value)
        || !isProvider(value.provider)
        || !isSessionId(value.sessionId)
        || !isGeneration(value.generation)) return null;
    return {
        provider: value.provider,
        sessionId: value.sessionId,
        generation: value.generation,
    };
}

function parseLifecycle(value: unknown): CloudStorageLifecycleState | null {
    if (!isRecord(value)
        || value.version !== 1
        || !isGeneration(value.revision)
        || typeof value.updatedAt !== 'number'
        || !Number.isFinite(value.updatedAt)) return null;
    const active = value.active === null ? null : parseSessionRef(value.active);
    if (value.active !== null && !active) return null;

    let stagedTarget: StagedCloudStorageSessionRef | null = null;
    if (value.stagedTarget !== null) {
        const staged = parseSessionRef(value.stagedTarget);
        if (!staged
            || !isRecord(value.stagedTarget)
            || typeof value.stagedTarget.ownerId !== 'string'
            || value.stagedTarget.ownerId.length < 12
            || !isProvider(value.stagedTarget.sourceProvider)
            || !isGeneration(value.stagedTarget.sourceGeneration)) return null;
        stagedTarget = {
            ...staged,
            ownerId: value.stagedTarget.ownerId,
            sourceProvider: value.stagedTarget.sourceProvider,
            sourceGeneration: value.stagedTarget.sourceGeneration,
        };
        if (!active
            || stagedTarget.provider === active.provider
            || stagedTarget.sourceProvider !== active.provider
            || stagedTarget.sourceGeneration !== active.generation) return null;
    }

    return {
        version: 1,
        revision: value.revision,
        active,
        stagedTarget,
        updatedAt: value.updatedAt,
    };
}

function sessionIdFromLegacyRecord(value: unknown): string | null {
    return isRecord(value) && isSessionId(value.sessionId) ? value.sessionId : null;
}

function validateSession(provider: CloudProviderId, sessionId: string): void {
    if (!isProvider(provider) || !isSessionId(sessionId)) {
        throw new CloudStorageLifecycleError(
            'INVALID_SESSION',
            'Cloud storage refused an invalid provider session.',
        );
    }
}

function validateOwner(ownerId: string): void {
    if (typeof ownerId !== 'string' || ownerId.length < 12 || ownerId.length > 200) {
        throw new CloudStorageLifecycleError(
            'INVALID_OWNER',
            'Cloud storage refused an invalid transfer owner.',
        );
    }
}

function maxGeneration(state: CloudStorageLifecycleState): number {
    return Math.max(
        state.active?.generation ?? 0,
        state.stagedTarget?.generation ?? 0,
    );
}

function changedState(
    current: CloudStorageLifecycleState,
    changes: Pick<CloudStorageLifecycleState, 'active' | 'stagedTarget'>,
): CloudStorageLifecycleState {
    return {
        version: 1,
        revision: current.revision + 1,
        active: changes.active,
        stagedTarget: changes.stagedTarget,
        updatedAt: Date.now(),
    };
}

function publishLifecycleChange(state: CloudStorageLifecycleState): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CLOUD_STORAGE_LIFECYCLE_EVENT, {
            detail: { revision: state.revision },
        }));
    }
    if (typeof BroadcastChannel === 'undefined') return;
    try {
        const channel = new BroadcastChannel(INVALIDATION_CHANNEL);
        channel.postMessage({ type: 'changed', revision: state.revision });
        channel.close();
    } catch {
        // IndexedDB remains authoritative when broadcast support is unavailable.
    }
}

async function readOrInitialize(
    store: {
        get(key: string): Promise<unknown>;
        put(value: unknown, key: string): Promise<unknown>;
    },
): Promise<{ state: CloudStorageLifecycleState; initialized: boolean }> {
    const persisted = await store.get(LIFECYCLE_KEY);
    if (persisted !== undefined) {
        const parsed = parseLifecycle(persisted);
        if (!parsed) {
            throw new CloudStorageLifecycleError(
                'INVALID_LIFECYCLE_STATE',
                'Cloud storage state is invalid. Sync remains disconnected.',
            );
        }
        return { state: parsed, initialized: false };
    }

    const [googleRecord, dropboxRecord] = await Promise.all([
        store.get(LEGACY_GOOGLE_SESSION_KEY),
        store.get(DROPBOX_SESSION_KEY),
    ]);
    const googleSessionId = sessionIdFromLegacyRecord(googleRecord);
    const dropboxSessionId = sessionIdFromLegacyRecord(dropboxRecord);
    const active: CloudStorageSessionRef | null = googleSessionId
        ? { provider: 'google-drive', sessionId: googleSessionId, generation: 0 }
        : (dropboxSessionId
            ? { provider: 'dropbox', sessionId: dropboxSessionId, generation: 1 }
            : null);
    const state: CloudStorageLifecycleState = {
        version: 1,
        revision: 0,
        active,
        stagedTarget: null,
        updatedAt: Date.now(),
    };
    await store.put(state, LIFECYCLE_KEY);
    return { state, initialized: true };
}

async function withLifecycleTransaction(
    mutate?: (state: CloudStorageLifecycleState) => CloudStorageLifecycleState,
): Promise<CloudStorageLifecycleState> {
    try {
        const db = await getDb();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const { state, initialized } = await readOrInitialize(transaction.store);
        const next = mutate ? mutate(state) : state;
        if (next !== state) await transaction.store.put(next, LIFECYCLE_KEY);
        await transaction.done;
        if (initialized || next !== state) publishLifecycleChange(next);
        return next;
    } catch (error) {
        if (error instanceof CloudStorageLifecycleError) throw error;
        throw new CloudStorageLifecycleError(
            'STORAGE_UNAVAILABLE',
            'Cloud storage state is temporarily unavailable. Sync remains disconnected.',
        );
    }
}

/** Read and, on first use, conservatively migrate the current storage provider. */
export function getCloudStorageLifecycle(): Promise<CloudStorageLifecycleState> {
    return withLifecycleTransaction();
}

/** Claim or replace the active session only when no other provider is active. */
export function claimActiveCloudStorageSession(
    provider: CloudProviderId,
    sessionId: string,
): Promise<CloudStorageLifecycleState> {
    validateSession(provider, sessionId);
    return withLifecycleTransaction((current) => {
        const active = current.active;
        if (active?.provider !== undefined && active.provider !== provider) {
            throw new CloudStorageLifecycleError(
                'ACTIVE_PROVIDER_CONFLICT',
                `Disconnect or transfer from ${active.provider} before activating ${provider}.`,
            );
        }
        if (current.stagedTarget) {
            throw new CloudStorageLifecycleError(
                'TRANSFER_IN_PROGRESS',
                'Cloud storage cannot replace the active session during a transfer.',
            );
        }
        if (active?.sessionId === sessionId) return current;
        // A first Google claim must remain on the legacy generation-zero
        // namespace. The lifecycle record may already exist because the app
        // initialized while signed out; moving that first connection to a new
        // generation would strand pre-connection dirty-doc evidence and break
        // rolling clients that still use the legacy Google keys.
        const generation = provider === 'google-drive'
            && current.revision === 0
            && current.active === null
            && current.stagedTarget === null
            ? 0
            : maxGeneration(current) + 1;
        return changedState(current, {
            active: {
                provider,
                sessionId,
                generation,
            },
            stagedTarget: null,
        });
    });
}

/** Reserve the inactive provider for one explicit transfer coordinator. */
export function stageCloudStorageSession(
    provider: CloudProviderId,
    sessionId: string,
    ownerId: string,
): Promise<CloudStorageLifecycleState> {
    validateSession(provider, sessionId);
    validateOwner(ownerId);
    return withLifecycleTransaction((current) => {
        if (!current.active) {
            throw new CloudStorageLifecycleError(
                'ACTIVE_PROVIDER_CONFLICT',
                'Connect an active cloud provider before staging a transfer target.',
            );
        }
        if (current.active.provider === provider) {
            throw new CloudStorageLifecycleError(
                'TARGET_PROVIDER_MATCHES_SOURCE',
                'The transfer target must use another cloud provider.',
            );
        }
        if (current.stagedTarget && current.stagedTarget.ownerId !== ownerId) {
            throw new CloudStorageLifecycleError(
                'STAGED_TARGET_OWNED',
                'Another transfer already owns the staged cloud provider.',
            );
        }
        if (current.stagedTarget?.provider === provider
            && current.stagedTarget.sessionId === sessionId
            && current.stagedTarget.ownerId === ownerId) return current;
        return changedState(current, {
            active: current.active,
            stagedTarget: {
                provider,
                sessionId,
                generation: maxGeneration(current) + 1,
                ownerId,
                sourceProvider: current.active.provider,
                sourceGeneration: current.active.generation,
            },
        });
    });
}

/** Clear only the exact provider/session/generation observed by the caller. */
export function clearCloudStorageSession(
    expected: CloudStorageSessionRef,
    options: { force?: boolean } = {},
): Promise<CloudStorageLifecycleState> {
    validateSession(expected.provider, expected.sessionId);
    if (!isGeneration(expected.generation)) {
        throw new CloudStorageLifecycleError('INVALID_SESSION', 'Cloud storage generation is invalid.');
    }
    return withLifecycleTransaction((current) => {
        const activeMatches = current.active?.provider === expected.provider
            && current.active.sessionId === expected.sessionId
            && current.active.generation === expected.generation;
        const stagedMatches = current.stagedTarget?.provider === expected.provider
            && current.stagedTarget.sessionId === expected.sessionId
            && current.stagedTarget.generation === expected.generation;
        if (!activeMatches && !stagedMatches) return current;
        if (activeMatches && current.stagedTarget && options.force !== true) {
            throw new CloudStorageLifecycleError(
                'TRANSFER_IN_PROGRESS',
                'Cancel the provider transfer before disconnecting its source.',
            );
        }
        return changedState(current, {
            active: activeMatches ? null : current.active,
            stagedTarget: activeMatches || stagedMatches ? null : current.stagedTarget,
        });
    });
}

/** Release staged ownership without changing the active source provider. */
export function clearStagedCloudStorageSession(
    ownerId: string,
): Promise<CloudStorageLifecycleState> {
    validateOwner(ownerId);
    return withLifecycleTransaction((current) => {
        if (!current.stagedTarget) return current;
        if (current.stagedTarget.ownerId !== ownerId) {
            throw new CloudStorageLifecycleError(
                'STAGED_TARGET_OWNED',
                'Another transfer owns the staged cloud provider.',
            );
        }
        return changedState(current, { active: current.active, stagedTarget: null });
    });
}

/** Atomically promote the verified staged target when its source fence still matches. */
export function activateStagedCloudStorageSession(
    ownerId: string,
): Promise<CloudStorageLifecycleState> {
    validateOwner(ownerId);
    return withLifecycleTransaction((current) => {
        const staged = current.stagedTarget;
        if (!staged || staged.ownerId !== ownerId) {
            throw new CloudStorageLifecycleError(
                'STAGED_TARGET_OWNED',
                'The provider transfer no longer owns its staged target.',
            );
        }
        if (!current.active
            || current.active.provider !== staged.sourceProvider
            || current.active.generation !== staged.sourceGeneration) {
            throw new CloudStorageLifecycleError(
                'TRANSFER_SOURCE_CHANGED',
                'The active cloud provider changed during transfer.',
            );
        }
        return changedState(current, {
            active: {
                provider: staged.provider,
                sessionId: staged.sessionId,
                generation: staged.generation,
            },
            stagedTarget: null,
        });
    });
}

export function getCloudStorageSessionRole(
    state: CloudStorageLifecycleState,
    provider: CloudProviderId,
    sessionId: string,
): CloudStorageSessionRole {
    if (state.active?.provider === provider && state.active.sessionId === sessionId) return 'active';
    if (state.stagedTarget?.provider === provider
        && state.stagedTarget.sessionId === sessionId) return 'staged';
    return 'inactive';
}

/** Bind hosted services to the same authenticated provider that owns storage. */
export function resolveCloudStorageIdentity(
    state: CloudStorageLifecycleState | null,
    sessions: CloudStorageAuthSessions,
): CloudStorageIdentityBinding {
    const active = state?.active ?? null;
    const activeAuthSessionId = active?.provider === 'dropbox'
        ? sessions.dropboxSessionId
        : sessions.googleSessionId;
    const hostedServiceSessionId = active
        && activeAuthSessionId === active.sessionId
        ? activeAuthSessionId
        : null;
    return {
        activeStorageProvider: active?.provider ?? null,
        activeStorageSessionId: active?.sessionId ?? null,
        activeStorageGeneration: active?.generation ?? null,
        hostedServiceSessionId,
        isGoogleStorageActive: Boolean(
            sessions.googleSessionId
            && active?.provider === 'google-drive'
            && active.sessionId === sessions.googleSessionId,
        ),
    };
}
