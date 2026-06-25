import { describe, it, expect } from 'vitest';
import {
    assertAgentBridgeSessionActive,
    createAgentBridgeSession,
    createAgentSessionToken,
    isAgentBridgeSessionExpired,
} from './session';

describe('agent bridge session helpers', () => {
    it('creates hex session tokens with secure random bytes', () => {
        const token = createAgentSessionToken(16);

        expect(token).toMatch(/^[a-f0-9]{32}$/);
    });

    it('creates memory-only scoped sessions with expiration metadata', () => {
        const session = createAgentBridgeSession({
            scopes: ['read', 'write'],
            now: () => 1000,
            ttlMs: 5000,
            tokenBytes: 8,
        });

        expect(session.sessionToken).toMatch(/^[a-f0-9]{16}$/);
        expect(session.scopes.has('read')).toBe(true);
        expect(session.scopes.has('write')).toBe(true);
        expect(session.createdAt).toBe(1000);
        expect(session.expiresAt).toBe(6000);
        expect(isAgentBridgeSessionExpired(session, 5999)).toBe(false);
        expect(isAgentBridgeSessionExpired(session, 6000)).toBe(true);
        expect(() => assertAgentBridgeSessionActive(session, 6000)).toThrow('Agent bridge session expired.');
    });
});
