import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getSyncPersistenceState,
    markPendingChanges,
    clearPendingChanges,
    markSyncStarted,
    markSyncCompleted,
    markSyncFailed,
    shouldSyncOnLoad,
    hasPersistedPendingChanges,
    wasSyncInterrupted,
    clearSyncPersistence,
} from './syncPersistence';

describe('syncPersistence', () => {

    const defaultState = {
        hasPendingChanges: false,
        syncInterrupted: false,
        syncStartedAt: null,
        lastSyncCompletedAt: null,
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
        });
    });

    it('marks and clears pending changes', () => {
        markPendingChanges();
        expect(getSyncPersistenceState().hasPendingChanges).toBe(true);

        clearPendingChanges();
        expect(getSyncPersistenceState().hasPendingChanges).toBe(false);
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
            hasPendingChanges: true,
            syncInterrupted: false,
            syncStartedAt: null,
        }));
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
