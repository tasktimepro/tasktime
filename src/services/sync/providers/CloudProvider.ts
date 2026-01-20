export interface SyncMeta {
    version: number;
    syncVersion: number; // Monotonically increasing counter for ordering writes
    lastModified: number;
    checksum: string;
    deviceId: string;
    entryCount: {
        projects: number;
        tasks: number;
        timeEntries: number;
        invoices: number;
    };
}

export interface SyncData {
    version: number;
    exportedAt?: number;
    projects?: unknown[];
    tasks?: unknown[];
    timeEntries?: unknown[];
    invoices?: unknown[];
    clients?: unknown[];
    businessInfos?: unknown[];
    invoiceTemplates?: unknown[];
    paymentMethods?: unknown[];
    preferences?: unknown;
    timer?: SyncTimerState;
    _sync?: {
        lastSyncedAt: number;
        deviceId: string;
        syncVersion?: number; // Track the syncVersion this local data was synced at
    };
}

export interface SyncTimerState {
    startTime: number | null;
    taskId?: string | null;
    paused?: boolean;
    elapsedTime?: number;
    note?: string;
    lastActive?: number | null;
}

export interface CloudProvider {
    initialize: () => Promise<void>;
    getMeta: () => Promise<SyncMeta | null>;
    hasRemoteChanges: (lastSyncedAt: number) => Promise<boolean>;
    pull: () => Promise<SyncData | null>;
    push: (data: SyncData, meta: SyncMeta) => Promise<void>;
    debugSnapshot?: () => Promise<void>;
}
