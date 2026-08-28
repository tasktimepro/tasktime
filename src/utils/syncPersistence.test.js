import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getSyncPersistenceState,
    markPendingChanges,
    clearPendingChanges,
    markPendingDocsSynced,
    markSyncStarted,
    markSyncCompleted,
    markSyncFailed,
    shouldSyncOnLoad,
    hasPersistedPendingChanges,
    getPersistedPendingDocNames,
    hasPersistedRetryNeeded,
    wasSyncInterrupted,
    clearSyncPersistence,
    getSyncPersistenceStorageKey,
    getDisconnectedDirtyDocNames,
    getDisconnectedDirtyDocsStorageKey,
    setDisconnectedDirtyDocNames,
} from './syncPersistence';

describe('syncPersistence', () => {

    const defaultState = {
        hasPendingChanges: false,
        syncInterrupted: false,
        syncStartedAt: null,
        lastSyncCompletedAt: null,
        pendingDocNames: [],
        needsRetry: false,
    };

    const originalLocalStorage = global.localStorage;

    const createMemoryStorage = () => {
        let store = {};
        return {
            getItem: (key) => (key in store ? store[key] : null),
            setItem: (key, value) => {
                store[key] = String(value);
            },
            removeItem: (key) => {
                delete store[key];
            },
            clear: () => {
                store = {};
            },
        };
    };

    beforeEach(() => {
        global.localStorage = createMemoryStorage();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
    });

    afterEach(() => {
        global.localStorage = originalLocalStorage;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('returns default state when nothing is stored', () => {
        expect(getSyncPersistenceState()).toEqual(defaultState);
    });

    it('hydrates state with defaults for missing fields', () => {
        localStorage.setItem('tasktime-sync-state', JSON.stringify({ hasPendingChanges: true }));

        expect(getSyncPersistenceState()).toEqual({
            hasPendingChanges: true,
            syncInterrupted: false,
            syncStartedAt: null,
            lastSyncCompletedAt: null,
            pendingDocNames: [],
            needsRetry: false,
        });
    });

    it('copies legacy recovery evidence into the Google provider namespace', () => {
        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: true,
            pendingDocNames: ['core'],
        }));

        expect(getSyncPersistenceState({ provider: 'google-drive', generation: 0 })).toEqual({
            ...defaultState,
            hasPendingChanges: true,
            pendingDocNames: ['core'],
        });
        expect(JSON.parse(localStorage.getItem(getSyncPersistenceStorageKey({
            provider: 'google-drive',
            generation: 0,
        })))).toEqual({
            ...defaultState,
            hasPendingChanges: true,
            pendingDocNames: ['core'],
        });
        expect(localStorage.getItem('tasktime-sync-state')).not.toBeNull();
    });

    it('keeps legacy sync recovery readable when its scoped shadow cannot be written', () => {
        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: true,
            pendingDocNames: ['core'],
        }));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error('quota exceeded');
        });

        expect(getSyncPersistenceState()).toEqual({
            ...defaultState,
            hasPendingChanges: true,
            pendingDocNames: ['core'],
        });
        expect(warnSpy).toHaveBeenCalled();
    });

    it('isolates recovery evidence by provider and connection generation', () => {
        const googleScope = { provider: 'google-drive', generation: 4 };
        const dropboxScope = { provider: 'dropbox', generation: 7 };

        markPendingChanges('core', googleScope);
        markPendingChanges('entries-active', dropboxScope);
        markSyncFailed(dropboxScope);

        expect(getSyncPersistenceState(googleScope)).toEqual(expect.objectContaining({
            hasPendingChanges: true,
            pendingDocNames: ['core'],
            needsRetry: false,
        }));
        expect(getSyncPersistenceState(dropboxScope)).toEqual(expect.objectContaining({
            hasPendingChanges: true,
            pendingDocNames: ['entries-active'],
            needsRetry: true,
        }));

        clearSyncPersistence(dropboxScope);

        expect(getSyncPersistenceState(dropboxScope)).toEqual(defaultState);
        expect(getSyncPersistenceState(googleScope)).toEqual(expect.objectContaining({
            hasPendingChanges: true,
            pendingDocNames: ['core'],
        }));
    });

    it('never treats legacy Google evidence as Dropbox state', () => {
        localStorage.setItem('tasktime-sync-state', JSON.stringify({
            hasPendingChanges: true,
            pendingDocNames: ['core'],
        }));

        expect(getSyncPersistenceState({ provider: 'dropbox', generation: 0 })).toEqual(defaultState);
        expect(localStorage.getItem(getSyncPersistenceStorageKey({
            provider: 'dropbox',
            generation: 0,
        }))).toBeNull();
    });

    it('copies legacy disconnected dirty docs into generation-zero Google state', () => {
        localStorage.setItem(
            'tasktime-disconnected-dirty-docs',
            JSON.stringify(['core', 'core', 'entries-active']),
        );

        expect(getDisconnectedDirtyDocNames()).toEqual(['core', 'entries-active']);
        expect(JSON.parse(localStorage.getItem(getDisconnectedDirtyDocsStorageKey({
            provider: 'google-drive',
            generation: 0,
        })))).toEqual(['core', 'entries-active']);
        expect(localStorage.getItem('tasktime-disconnected-dirty-docs')).not.toBeNull();
    });

    it('keeps legacy disconnected dirty docs readable when its scoped shadow cannot be written', () => {
        localStorage.setItem(
            'tasktime-disconnected-dirty-docs',
            JSON.stringify(['core']),
        );
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error('quota exceeded');
        });

        expect(getDisconnectedDirtyDocNames()).toEqual(['core']);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('isolates disconnected dirty docs by provider and generation', () => {
        const googleScope = { provider: 'google-drive', generation: 4 };
        const dropboxScope = { provider: 'dropbox', generation: 7 };

        setDisconnectedDirtyDocNames(['core'], googleScope);
        setDisconnectedDirtyDocNames(['entries-active'], dropboxScope);

        expect(getDisconnectedDirtyDocNames(googleScope)).toEqual(['core']);
        expect(getDisconnectedDirtyDocNames(dropboxScope)).toEqual(['entries-active']);

        setDisconnectedDirtyDocNames([], dropboxScope);

        expect(getDisconnectedDirtyDocNames(dropboxScope)).toEqual([]);
        expect(getDisconnectedDirtyDocNames(googleScope)).toEqual(['core']);
    });

    it('never treats legacy Google disconnected dirty docs as Dropbox state', () => {
        localStorage.setItem(
            'tasktime-disconnected-dirty-docs',
            JSON.stringify(['core']),
        );

        expect(getDisconnectedDirtyDocNames({ provider: 'dropbox', generation: 0 })).toEqual([]);
    });

    it('marks and clears pending changes', () => {
        markPendingChanges('core');
        markPendingChanges('entries-active');
        markPendingChanges('core');
        expect(getSyncPersistenceState().hasPendingChanges).toBe(true);
        expect(getPersistedPendingDocNames()).toEqual(['core', 'entries-active']);

        clearPendingChanges();
        expect(getSyncPersistenceState().hasPendingChanges).toBe(false);
        expect(getPersistedPendingDocNames()).toEqual([]);
    });

    it('clears only successfully synced document identities without ending an active pass', () => {
        markPendingChanges('core');
        markPendingChanges('tasks-archived');
        markSyncStarted();

        markPendingDocsSynced(['tasks-archived']);

        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: true,
            pendingDocNames: ['core'],
            syncInterrupted: true,
        }));

        markPendingDocsSynced(['core']);

        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: false,
            pendingDocNames: [],
            syncInterrupted: true,
        }));
    });

    it('preserves boolean-only legacy recovery evidence when document identity is unknown', () => {
        markPendingChanges();

        markPendingDocsSynced(['core']);

        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: true,
            pendingDocNames: [],
        }));
    });

    it('marks sync started and completed', () => {
        markSyncStarted();
        const startedState = getSyncPersistenceState();

        expect(startedState.syncInterrupted).toBe(true);
        expect(startedState.syncStartedAt).toBe(new Date('2026-01-20T10:00:00Z').getTime());

        vi.setSystemTime(new Date('2026-01-20T10:05:00Z'));
        markSyncCompleted();
        const completedState = getSyncPersistenceState();

        expect(completedState.syncInterrupted).toBe(false);
        expect(completedState.syncStartedAt).toBeNull();
        expect(completedState.lastSyncCompletedAt).toBe(new Date('2026-01-20T10:05:00Z').getTime());
        expect(completedState.hasPendingChanges).toBe(false);
        expect(completedState.pendingDocNames).toEqual([]);
        expect(completedState.needsRetry).toBe(false);
    });

    it('keeps pending changes when sync fails', () => {
        markPendingChanges();
        markSyncStarted();
        markSyncFailed();

        const state = getSyncPersistenceState();
        expect(state.hasPendingChanges).toBe(true);
        expect(state.syncInterrupted).toBe(false);
        expect(state.syncStartedAt).toBeNull();
    });

    it('creates durable retry evidence when a pull-only sync fails', () => {
        markSyncStarted();
        markSyncFailed();

        expect(getSyncPersistenceState()).toEqual(expect.objectContaining({
            hasPendingChanges: false,
            syncInterrupted: false,
            syncStartedAt: null,
            pendingDocNames: [],
            needsRetry: true,
        }));
        expect(hasPersistedRetryNeeded()).toBe(true);
        expect(shouldSyncOnLoad()).toBe(true);
    });

    it('detects when sync should run on load', () => {
        expect(shouldSyncOnLoad()).toBe(false);

        markPendingChanges();
        expect(shouldSyncOnLoad()).toBe(true);

        clearPendingChanges();
        markSyncStarted();
        expect(shouldSyncOnLoad()).toBe(true);
    });

    it('reports pending changes and interrupted sync', () => {
        markPendingChanges();
        expect(hasPersistedPendingChanges()).toBe(true);
        expect(wasSyncInterrupted()).toBe(false);

        markSyncStarted();
        expect(wasSyncInterrupted()).toBe(true);
    });

    it('clears persisted sync state', () => {
        markPendingChanges();
        clearSyncPersistence();

        expect(getSyncPersistenceState()).toEqual(defaultState);
    });

    it('handles localStorage read errors gracefully', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
            throw new Error('storage error');
        });

        expect(getSyncPersistenceState()).toEqual(defaultState);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('handles localStorage write errors gracefully', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw new Error('storage error');
        });

        expect(() => markPendingChanges()).not.toThrow();
        expect(warnSpy).toHaveBeenCalled();
    });

    it('handles localStorage clear errors gracefully', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
            throw new Error('storage error');
        });

        expect(() => clearSyncPersistence()).not.toThrow();
        expect(warnSpy).toHaveBeenCalled();
    });
});
