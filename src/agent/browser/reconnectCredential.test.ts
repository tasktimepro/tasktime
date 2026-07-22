import { describe, expect, it } from 'vitest';
import {
    createAgentBridgeReconnectCredential,
    deleteAgentBridgeReconnectCredential,
    generateAgentBridgeReconnectKeyPair,
    loadAgentBridgeReconnectCredential,
    saveAgentBridgeReconnectCredential,
    signAgentBridgeReconnectChallenge,
    validateAgentBridgeReconnectCredential,
    type AgentBridgeReconnectCredential,
    type AgentBridgeReconnectCredentialStore,
} from './reconnectCredential';
import { createAgentBridgeReconnectSignatureInput } from '@/agent/transport/protocol';

class MemoryReconnectStore implements AgentBridgeReconnectCredentialStore {
    readonly records = new Map<string, unknown>();

    async list(): Promise<unknown[]> {
        return Array.from(this.records.values());
    }

    async put(credential: AgentBridgeReconnectCredential): Promise<void> {
        this.records.set(credential.bridgeInstanceId, credential);
    }

    async delete(bridgeInstanceId: string): Promise<void> {
        this.records.delete(bridgeInstanceId);
    }
}

describe('agent bridge browser reconnect credential', () => {
    it('persists a non-exportable sign-only key and signs an exact bridge challenge', async () => {
        const store = new MemoryReconnectStore();
        const now = Date.now();
        const { privateKey, publicKeyJwk } = await generateAgentBridgeReconnectKeyPair();
        const credential = createAgentBridgeReconnectCredential(privateKey, {
            endpoint: 'ws://127.0.0.1:39123/tasktime-agent',
            registration: {
                type: 'agent_bridge_reconnect_registered',
                protocolVersion: 1,
                bridgeInstanceId: 'bridge-1',
                keyId: 'key-1',
                expiresAt: now + 5000,
            },
            agentId: 'tasktime.agent.openclaw',
            now: () => now,
        });

        expect(privateKey.extractable).toBe(false);
        expect(privateKey.usages).toEqual(['sign']);
        await saveAgentBridgeReconnectCredential(credential, store);
        await expect(loadAgentBridgeReconnectCredential(store, now + 1000)).resolves.toEqual(credential);

        const challenge = {
            type: 'agent_bridge_reconnect_challenge' as const,
            protocolVersion: 1 as const,
            bridgeInstanceId: 'bridge-1',
            keyId: 'key-1',
            challengeId: 'challenge-1',
            nonce: 'nonce-1',
            origin: 'https://tasktime.pro',
            expiresAt: now + 2500,
        };
        const signature = await signAgentBridgeReconnectChallenge(
            credential,
            challenge,
            'https://tasktime.pro',
            now + 1000
        );
        const publicKey = await globalThis.crypto.subtle.importKey(
            'jwk',
            publicKeyJwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify']
        );
        const rawSignature = Uint8Array.from(
            globalThis.atob(signature.replace(/-/g, '+').replace(/_/g, '/').padEnd(88, '=')),
            (value) => value.charCodeAt(0)
        );

        await expect(globalThis.crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            publicKey,
            rawSignature,
            new TextEncoder().encode(createAgentBridgeReconnectSignatureInput(challenge))
        )).resolves.toBe(true);
    });

    it('rejects exportable, wrong-usage, expired, non-loopback, and mismatched challenges', async () => {
        const exportablePair = await globalThis.crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );

        expect(validateAgentBridgeReconnectCredential({
            schemaVersion: 1,
            endpoint: 'ws://127.0.0.1:39123/tasktime-agent',
            bridgeInstanceId: 'bridge-1',
            keyId: 'key-1',
            privateKey: exportablePair.privateKey,
            createdAt: 1000,
            expiresAt: 5000,
        }, 2000)).toBeNull();

        const { privateKey } = await generateAgentBridgeReconnectKeyPair();
        const credential = createAgentBridgeReconnectCredential(privateKey, {
            endpoint: 'ws://127.0.0.1:39123/tasktime-agent',
            registration: {
                type: 'agent_bridge_reconnect_registered',
                protocolVersion: 1,
                bridgeInstanceId: 'bridge-1',
                keyId: 'key-1',
                expiresAt: 5000,
            },
            now: () => 1000,
        });

        await expect(signAgentBridgeReconnectChallenge(credential, {
            type: 'agent_bridge_reconnect_challenge',
            protocolVersion: 1,
            bridgeInstanceId: 'bridge-other',
            keyId: 'key-1',
            challengeId: 'challenge-1',
            nonce: 'nonce-1',
            origin: 'https://tasktime.pro',
            expiresAt: 2500,
        }, 'https://tasktime.pro', 2000)).rejects.toThrow('invalid or expired');

        expect(validateAgentBridgeReconnectCredential({
            ...credential,
            endpoint: 'ws://192.168.1.2:39123/tasktime-agent',
        }, 2000)).toBeNull();
        expect(validateAgentBridgeReconnectCredential(credential, 5000)).toBeNull();
    });

    it('prunes invalid records and deletes a remembered bridge explicitly', async () => {
        const store = new MemoryReconnectStore();
        store.records.set('bad-bridge', {
            bridgeInstanceId: 'bad-bridge',
            schemaVersion: 99,
        });

        await expect(loadAgentBridgeReconnectCredential(store, 2000)).resolves.toBeNull();
        expect(store.records.has('bad-bridge')).toBe(false);

        store.records.set('bridge-1', { bridgeInstanceId: 'bridge-1' });
        await deleteAgentBridgeReconnectCredential('bridge-1', store);
        expect(store.records.has('bridge-1')).toBe(false);
    });
});
