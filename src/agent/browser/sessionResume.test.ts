import { describe, expect, it, vi } from 'vitest';
import type { AgentBridgeSessionStorageLike } from './sessionResume';
import {
    AGENT_BRIDGE_SESSION_RESUME_STORAGE_KEY,
    clearAgentBridgeSessionResumeRecord,
    createAgentBridgeSessionFromResumeRecord,
    loadAgentBridgeSessionResumeRecord,
    saveAgentBridgeSessionResumeRecord,
    validateAgentBridgeSessionResumeRecord,
} from './sessionResume';

class MemorySessionStorage implements AgentBridgeSessionStorageLike {
    readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }
}

const validRecord = {
    schemaVersion: 1 as const,
    endpoint: 'ws://127.0.0.1:39123/tasktime-agent',
    sessionToken: 'session-token',
    scopes: ['read', 'navigation'] as const,
    createdAt: 1000,
    expiresAt: 5000,
    agentId: 'tasktime.agent.openclaw',
    agentLabel: 'OpenClaw on this device',
};

describe('agent bridge current-tab session resume storage', () => {
    it('round-trips a valid bounded session without changing its scopes', () => {
        const storage = new MemorySessionStorage();
        const saved = saveAgentBridgeSessionResumeRecord(validRecord.endpoint, {
            sessionToken: validRecord.sessionToken,
            scopes: new Set(validRecord.scopes),
            createdAt: validRecord.createdAt,
            expiresAt: validRecord.expiresAt,
            agentId: validRecord.agentId,
            agentLabel: validRecord.agentLabel,
        }, storage);

        expect(saved).toBe(true);
        const loaded = loadAgentBridgeSessionResumeRecord(storage, 2000);
        expect(loaded).toEqual(validRecord);
        expect(createAgentBridgeSessionFromResumeRecord(loaded!)).toEqual({
            sessionToken: validRecord.sessionToken,
            scopes: new Set(validRecord.scopes),
            createdAt: validRecord.createdAt,
            expiresAt: validRecord.expiresAt,
            agentId: validRecord.agentId,
            agentLabel: validRecord.agentLabel,
        });
    });

    it.each([
        null,
        {},
        { ...validRecord, schemaVersion: 2 },
        { ...validRecord, endpoint: 'ws://192.168.1.20:39123/tasktime-agent' },
        { ...validRecord, endpoint: 'https://127.0.0.1:39123/tasktime-agent' },
        { ...validRecord, sessionToken: '' },
        { ...validRecord, scopes: [] },
        { ...validRecord, scopes: ['read', 'unknown'] },
        { ...validRecord, createdAt: Number.NaN },
        { ...validRecord, expiresAt: 1000 },
        { ...validRecord, expiresAt: 2000 + (24 * 60 * 60 * 1000) + 1 },
    ])('rejects malformed, unsupported, non-loopback, or expired records', (record) => {
        expect(validateAgentBridgeSessionResumeRecord(record, 2000)).toBeNull();
    });

    it('clears malformed persisted JSON without exposing its contents', () => {
        const storage = new MemorySessionStorage();
        storage.setItem(AGENT_BRIDGE_SESSION_RESUME_STORAGE_KEY, '{not-json');

        expect(loadAgentBridgeSessionResumeRecord(storage, 2000)).toBeNull();
        expect(storage.getItem(AGENT_BRIDGE_SESSION_RESUME_STORAGE_KEY)).toBeNull();
    });

    it('fails safely when browser storage throws', () => {
        const storage: AgentBridgeSessionStorageLike = {
            getItem: vi.fn(() => {
                throw new Error('blocked');
            }),
            setItem: vi.fn(() => {
                throw new Error('blocked');
            }),
            removeItem: vi.fn(() => {
                throw new Error('blocked');
            }),
        };

        expect(loadAgentBridgeSessionResumeRecord(storage, 2000)).toBeNull();
        expect(saveAgentBridgeSessionResumeRecord(validRecord.endpoint, {
            sessionToken: validRecord.sessionToken,
            scopes: new Set(validRecord.scopes),
            createdAt: validRecord.createdAt,
            expiresAt: validRecord.expiresAt,
        }, storage)).toBe(false);
        expect(() => clearAgentBridgeSessionResumeRecord(storage)).not.toThrow();
    });
});
