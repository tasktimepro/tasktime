import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    CloudStorageLifecycleError,
    activateStagedCloudStorageSession,
    claimActiveCloudStorageSession,
    clearCloudStorageSession,
    clearStagedCloudStorageSession,
    getCloudStorageLifecycle,
    getCloudStorageSessionRole,
    resolveCloudStorageIdentity,
    stageCloudStorageSession,
} from './cloudStorageLifecycle';

const records = new Map<string, unknown>();
const mockStore = {
    get: vi.fn((key: string) => Promise.resolve(records.get(key))),
    put: vi.fn((value: unknown, key: string) => {
        records.set(key, structuredClone(value));
        return Promise.resolve(key);
    }),
};
const mockDb = {
    transaction: vi.fn(() => ({ store: mockStore, done: Promise.resolve() })),
};

vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve(mockDb)),
}));

describe('cloudStorageLifecycle', () => {
    beforeEach(() => {
        records.clear();
        vi.clearAllMocks();
    });

    it('migrates an existing Google session as generation zero and does not select Dropbox', async () => {
        records.set('google-auth-session', {
            sessionId: 'legacy-google-session',
            userId: 'google-user-fixture',
            email: 'person@example.com',
            createdAt: '2026-08-19T10:00:00.000Z',
        });
        records.set('dropbox-auth-session', {
            provider: 'dropbox',
            sessionId: 'dropbox-session-fixture',
            createdAt: '2026-08-19T10:00:00.000Z',
        });

        await expect(getCloudStorageLifecycle()).resolves.toMatchObject({
            version: 1,
            active: {
                provider: 'google-drive',
                sessionId: 'legacy-google-session',
                generation: 0,
            },
            stagedTarget: null,
        });
        expect(records.get('cloud-storage-lifecycle-v1')).toBeDefined();
    });

    it('keeps the first Google claim on generation zero after an empty lifecycle was initialized', async () => {
        await expect(getCloudStorageLifecycle()).resolves.toMatchObject({
            revision: 0,
            active: null,
        });

        await expect(
            claimActiveCloudStorageSession('google-drive', 'first-google-session'),
        ).resolves.toMatchObject({
            active: {
                provider: 'google-drive',
                sessionId: 'first-google-session',
                generation: 0,
            },
        });
    });

    it('claims one active provider idempotently and fences replacement generations', async () => {
        const claimed = await claimActiveCloudStorageSession('dropbox', 'dropbox-session-1');
        const repeated = await claimActiveCloudStorageSession('dropbox', 'dropbox-session-1');
        const replaced = await claimActiveCloudStorageSession('dropbox', 'dropbox-session-2');

        expect(claimed.active?.generation).toBe(1);
        expect(repeated).toEqual(claimed);
        expect(replaced.active).toMatchObject({
            provider: 'dropbox',
            sessionId: 'dropbox-session-2',
            generation: 2,
        });
        await expect(
            claimActiveCloudStorageSession('google-drive', 'google-session-fixture'),
        ).rejects.toMatchObject({ code: 'ACTIVE_PROVIDER_CONFLICT' });
    });

    it('allows a second provider only as a transfer-owner staged target', async () => {
        const source = await claimActiveCloudStorageSession('google-drive', 'google-session-fixture');
        const staged = await stageCloudStorageSession(
            'dropbox',
            'dropbox-session-fixture',
            'transfer-owner-fixture',
        );

        expect(staged.active).toEqual(source.active);
        expect(staged.stagedTarget).toMatchObject({
            provider: 'dropbox',
            sessionId: 'dropbox-session-fixture',
            ownerId: 'transfer-owner-fixture',
            sourceGeneration: source.active?.generation,
        });
        expect(getCloudStorageSessionRole(
            staged,
            'dropbox',
            'dropbox-session-fixture',
        )).toBe('staged');
        await expect(stageCloudStorageSession(
            'dropbox',
            'other-dropbox-session',
            'other-owner-fixture',
        )).rejects.toMatchObject({ code: 'STAGED_TARGET_OWNED' });
        await expect(clearStagedCloudStorageSession('other-owner-fixture')).rejects.toMatchObject({
            code: 'STAGED_TARGET_OWNED',
        });
        await expect(clearStagedCloudStorageSession('transfer-owner-fixture')).resolves.toMatchObject({
            stagedTarget: null,
            active: source.active,
        });
    });

    it('does not let stale tabs clear a replacement generation or an active transfer source', async () => {
        const first = await claimActiveCloudStorageSession('google-drive', 'google-session-1');
        const replacement = await claimActiveCloudStorageSession('google-drive', 'google-session-2');

        await expect(clearCloudStorageSession({
            provider: 'google-drive',
            sessionId: 'google-session-1',
            generation: first.active!.generation,
        })).resolves.toEqual(replacement);

        await stageCloudStorageSession(
            'dropbox',
            'dropbox-session-fixture',
            'transfer-owner-fixture',
        );
        await expect(clearCloudStorageSession(replacement.active!)).rejects.toBeInstanceOf(
            CloudStorageLifecycleError,
        );
        await expect(clearCloudStorageSession(replacement.active!, {
            force: true,
        })).resolves.toMatchObject({ active: null, stagedTarget: null });
    });

    it('atomically activates only the transfer-owned target generation', async () => {
        await claimActiveCloudStorageSession('google-drive', 'google-session-fixture');
        const staged = await stageCloudStorageSession(
            'dropbox',
            'dropbox-session-fixture',
            'transfer-owner-fixture',
        );

        await expect(activateStagedCloudStorageSession('other-owner-fixture')).rejects.toMatchObject({
            code: 'STAGED_TARGET_OWNED',
        });
        await expect(
            activateStagedCloudStorageSession('transfer-owner-fixture'),
        ).resolves.toMatchObject({
            active: {
                provider: 'dropbox',
                sessionId: 'dropbox-session-fixture',
                generation: staged.stagedTarget?.generation,
            },
            stagedTarget: null,
        });
    });

    it('rejects invalid provider/session/owner input without persisting it', async () => {
        expect(() => claimActiveCloudStorageSession('dropbox', '')).toThrow(
            expect.objectContaining({ code: 'INVALID_SESSION' }),
        );
        expect(() => stageCloudStorageSession('dropbox', 'dropbox-session', 'short')).toThrow(
            expect.objectContaining({ code: 'INVALID_OWNER' }),
        );
        expect(records.get('cloud-storage-lifecycle-v1')).toBeUndefined();
    });

    it('uses the active Dropbox session for hosted services while Dropbox owns storage', () => {
        const binding = resolveCloudStorageIdentity({
            version: 1,
            revision: 3,
            active: {
                provider: 'dropbox',
                sessionId: 'dropbox-storage-session',
                generation: 3,
            },
            stagedTarget: null,
            updatedAt: Date.now(),
        }, {
            googleSessionId: 'google-inactive-session',
            dropboxSessionId: 'dropbox-storage-session',
        });

        expect(binding).toEqual({
            activeStorageProvider: 'dropbox',
            activeStorageSessionId: 'dropbox-storage-session',
            activeStorageGeneration: 3,
            hostedServiceSessionId: 'dropbox-storage-session',
            isGoogleStorageActive: false,
        });
        expect(binding.hostedServiceSessionId).toBe(binding.activeStorageSessionId);
    });

    it('fails hosted services closed when the active provider session is unavailable', () => {
        const binding = resolveCloudStorageIdentity({
            version: 1,
            revision: 3,
            active: {
                provider: 'dropbox',
                sessionId: 'dropbox-storage-session',
                generation: 3,
            },
            stagedTarget: null,
            updatedAt: Date.now(),
        }, {
            googleSessionId: 'google-inactive-session',
            dropboxSessionId: null,
        });

        expect(binding.hostedServiceSessionId).toBeNull();
    });
});
