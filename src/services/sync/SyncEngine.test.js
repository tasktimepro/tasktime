import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from './SyncEngine';

vi.mock('@/utils/syncUtils', () => ({
    generateChecksum: vi.fn(async (data) => JSON.stringify(data)),
    getDeviceId: vi.fn(async () => 'device-1')
}));

const createProvider = () => {
    return {
        initialize: vi.fn(async () => undefined),
        getMeta: vi.fn(async () => null),
        hasRemoteChanges: vi.fn(async () => false),
        pull: vi.fn(async () => null),
        push: vi.fn(async () => undefined)
    };
};

const baseData = () => ({
    version: 1,
    projects: [],
    tasks: [],
    timeEntries: [],
    invoices: [],
    clients: [],
    businessInfos: [],
    invoiceTemplates: [],
    paymentMethods: [],
    preferences: {},
    timer: null,
    _sync: { lastSyncedAt: 0, deviceId: 'device-1' }
});

describe('SyncEngine', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pushes local changes when checksum differs from last synced', async () => {
        const provider = createProvider();
        // Simulate local data changing AFTER initialize
        let callCount = 0;
        const getLocalData = vi.fn(async () => {
            callCount++;
            // First call (during init) returns base, subsequent calls return modified data
            if (callCount === 1) {
                return baseData();
            }
            return { ...baseData(), projects: [{ id: 'p1', updatedAt: 1 }] };
        });
        const setLocalData = vi.fn(async () => undefined);

        const engine = new SyncEngine({
            provider,
            getLocalData,
            setLocalData
        });

        await engine.initialize();

        expect(provider.push).toHaveBeenCalledTimes(1);
    });

    it('pulls remote data when remote is newer and local unchanged', async () => {
        const provider = createProvider();
        provider.hasRemoteChanges.mockResolvedValue(true);
        
        const remoteData = {
            ...baseData(),
            projects: [{ id: 'p1', updatedAt: 1 }]
        };
        provider.pull.mockResolvedValue(remoteData);

        // Local data doesn't change (same on every call)
        const getLocalData = vi.fn(async () => baseData());
        const setLocalData = vi.fn(async () => undefined);

        const engine = new SyncEngine({
            provider,
            getLocalData,
            setLocalData
        });

        await engine.initialize();

        expect(provider.pull).toHaveBeenCalledTimes(1);
        // setLocalData called for remote data, and again during push (with sync metadata)
        // because after pulling, local checksum still differs from remote checksum
        expect(setLocalData).toHaveBeenCalled();
        // First call should be with the remote data
        expect(setLocalData.mock.calls[0][0]).toMatchObject({
            projects: [{ id: 'p1', updatedAt: 1 }]
        });
    });

    it('calls onConflict when both local and remote changed with different data', async () => {
        const provider = createProvider();
        provider.hasRemoteChanges.mockResolvedValue(true);
        provider.pull.mockResolvedValue({
            ...baseData(),
            projects: [{ id: 'p2', updatedAt: 5 }]
        });

        // Simulate local data changing between init and sync
        let callCount = 0;
        const getLocalData = vi.fn(async () => {
            callCount++;
            if (callCount === 1) {
                // During initialize: baseline data
                return baseData();
            }
            // During sync: local has new project (changed since init)
            return {
                ...baseData(),
                projects: [{ id: 'p1', updatedAt: 10 }]
            };
        });
        const setLocalData = vi.fn(async () => undefined);
        const onConflict = vi.fn(async (local, remote) => ({
            ...local,
            projects: [...(local.projects || []), ...(remote.projects || [])]
        }));

        const engine = new SyncEngine({
            provider,
            getLocalData,
            setLocalData,
            onConflict
        });

        await engine.initialize();

        expect(onConflict).toHaveBeenCalledTimes(1);
    });

    it('takes remote data without conflict on new device', async () => {
        const provider = createProvider();
        provider.hasRemoteChanges.mockResolvedValue(true);
        
        const remoteData = {
            ...baseData(),
            projects: [{ id: 'p1', updatedAt: 1 }],
            clients: [{ id: 'c1', name: 'Client A', updatedAt: 1 }]
        };
        // Remove _sync to simulate new device (never synced)
        delete remoteData._sync;
        provider.pull.mockResolvedValue({ ...remoteData, _sync: { lastSyncedAt: 1000, deviceId: 'device-2' } });

        // New device: no _sync metadata
        const newDeviceData = () => ({
            version: 1,
            projects: [],
            tasks: [],
            timeEntries: [],
            invoices: [],
            clients: [],
            businessInfos: [],
            invoiceTemplates: [],
            paymentMethods: [],
            preferences: {},
            timer: null
            // No _sync - this is a brand new device
        });

        const getLocalData = vi.fn(async () => newDeviceData());
        const setLocalData = vi.fn(async () => undefined);
        const onConflict = vi.fn();

        const engine = new SyncEngine({
            provider,
            getLocalData,
            setLocalData,
            onConflict
        });

        await engine.initialize();

        // Should NOT trigger conflict on new device
        expect(onConflict).not.toHaveBeenCalled();
        // Should have pulled and set remote data
        expect(setLocalData).toHaveBeenCalled();
        expect(setLocalData.mock.calls[0][0]).toMatchObject({
            clients: [{ id: 'c1', name: 'Client A' }]
        });
    });
});
