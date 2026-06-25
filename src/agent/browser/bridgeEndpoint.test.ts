import { describe, expect, it } from 'vitest';
import { buildAgentBridgePairingUrl, getAgentBridgeConnectionDiagnostics } from './bridgeEndpoint';

describe('buildAgentBridgePairingUrl', () => {
    it('adds pairing credentials to an explicit loopback websocket endpoint', () => {
        expect(buildAgentBridgePairingUrl({
            endpoint: 'ws://127.0.0.1:39123/tasktime-agent',
            pairingId: 'pairing-1',
            pairingCode: '123456',
        })).toBe('ws://127.0.0.1:39123/tasktime-agent?pairingId=pairing-1&pairingCode=123456');
    });

    it('accepts IPv6 loopback endpoints', () => {
        expect(buildAgentBridgePairingUrl({
            endpoint: 'ws://[::1]:39123/tasktime-agent',
            pairingId: 'pairing-1',
            pairingCode: '123456',
        })).toBe('ws://[::1]:39123/tasktime-agent?pairingId=pairing-1&pairingCode=123456');
    });

    it('overwrites stale pairing query params without changing the endpoint path', () => {
        expect(buildAgentBridgePairingUrl({
            endpoint: 'ws://localhost:39123/tasktime-agent?pairingId=old&debug=1',
            pairingId: 'new-pairing',
            pairingCode: '654321',
        })).toBe('ws://localhost:39123/tasktime-agent?pairingId=new-pairing&debug=1&pairingCode=654321');
    });

    it('rejects non-websocket endpoints', () => {
        expect(() => buildAgentBridgePairingUrl({
            endpoint: 'http://127.0.0.1:39123/tasktime-agent',
            pairingId: 'pairing-1',
            pairingCode: '123456',
        })).toThrow('Bridge endpoint must use ws:// or wss://.');
    });

    it('rejects non-loopback hosts', () => {
        expect(() => buildAgentBridgePairingUrl({
            endpoint: 'ws://192.168.1.10:39123/tasktime-agent',
            pairingId: 'pairing-1',
            pairingCode: '123456',
        })).toThrow('Bridge endpoint must use a loopback host.');
    });

    it('requires pairing credentials', () => {
        expect(() => buildAgentBridgePairingUrl({
            endpoint: 'ws://127.0.0.1:39123/tasktime-agent',
            pairingId: '',
            pairingCode: '123456',
        })).toThrow('Pairing ID is required.');
    });

    it('returns no diagnostics for an empty endpoint', () => {
        expect(getAgentBridgeConnectionDiagnostics('')).toEqual([]);
    });

    it('diagnoses invalid and non-local endpoints', () => {
        expect(getAgentBridgeConnectionDiagnostics('not a url')).toEqual([expect.objectContaining({
            severity: 'error',
            title: 'Endpoint is not a valid URL',
        })]);
        expect(getAgentBridgeConnectionDiagnostics('http://127.0.0.1:39123/tasktime-agent')).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'error',
                title: 'Unsupported endpoint protocol',
            }),
        ]));
        expect(getAgentBridgeConnectionDiagnostics('ws://192.168.1.10:39123/tasktime-agent')).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'error',
                title: 'Endpoint is not local',
            }),
        ]));
    });

    it('warns about likely browser and endpoint mismatch issues', () => {
        expect(getAgentBridgeConnectionDiagnostics('ws://127.0.0.1/tasktime-agent', 'https:')).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'warning',
                title: 'Endpoint has no explicit port',
            }),
            expect.objectContaining({
                severity: 'warning',
                title: 'Browser may block ws:// from this page',
            }),
        ]));
        expect(getAgentBridgeConnectionDiagnostics('ws://127.0.0.1:39123/custom-path')).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'warning',
                title: 'Unexpected bridge path',
            }),
        ]));
    });

    it('returns a positive local diagnostic when the endpoint shape looks correct', () => {
        expect(getAgentBridgeConnectionDiagnostics('ws://127.0.0.1:39123/tasktime-agent', 'http:')).toEqual([{
            severity: 'info',
            title: 'Endpoint looks local',
            message: 'Connection still requires the bridge to be running, the pairing code to be unused and unexpired, and the browser origin to be allowed by the bridge.',
        }]);
    });
});
