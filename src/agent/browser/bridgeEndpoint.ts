const LOOPBACK_HOSTS = new Set([
    '127.0.0.1',
    'localhost',
    '[::1]',
]);

export type AgentBridgeConnectionDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface AgentBridgeConnectionDiagnostic {
    severity: AgentBridgeConnectionDiagnosticSeverity;
    title: string;
    message: string;
}

export interface AgentBridgePairingFields {
    endpoint: string;
    pairingId: string;
    pairingCode: string;
}

export interface AgentBridgeSessionFields {
    endpoint: string;
    sessionToken: string;
}

export interface AgentBridgeReconnectFields {
    endpoint: string;
    keyId: string;
}

export function buildAgentBridgePairingUrl(fields: AgentBridgePairingFields): string {
    const endpoint = fields.endpoint.trim();
    const pairingId = fields.pairingId.trim();
    const pairingCode = fields.pairingCode.trim();

    if (!endpoint) {
        throw new Error('Bridge endpoint is required.');
    }

    if (!pairingId) {
        throw new Error('Pairing ID is required.');
    }

    if (!pairingCode) {
        throw new Error('Pairing code is required.');
    }

    const url = new URL(endpoint);

    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        throw new Error('Bridge endpoint must use ws:// or wss://.');
    }

    if (!LOOPBACK_HOSTS.has(url.hostname)) {
        throw new Error('Bridge endpoint must use a loopback host.');
    }

    url.searchParams.set('pairingId', pairingId);
    url.searchParams.set('pairingCode', pairingCode);

    return url.toString();
}

export function buildAgentBridgeSessionUrl(fields: AgentBridgeSessionFields): string {
    const endpoint = fields.endpoint.trim();
    const sessionToken = fields.sessionToken.trim();

    if (!endpoint) {
        throw new Error('Bridge endpoint is required.');
    }

    if (!sessionToken) {
        throw new Error('Session token is required.');
    }

    const url = new URL(endpoint);

    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        throw new Error('Bridge endpoint must use ws:// or wss://.');
    }

    if (!LOOPBACK_HOSTS.has(url.hostname)) {
        throw new Error('Bridge endpoint must use a loopback host.');
    }

    url.searchParams.delete('pairingId');
    url.searchParams.delete('pairingCode');
    url.searchParams.set('sessionToken', sessionToken);

    return url.toString();
}

export function buildAgentBridgeReconnectUrl(fields: AgentBridgeReconnectFields): string {
    const endpoint = fields.endpoint.trim();
    const keyId = fields.keyId.trim();

    if (!endpoint) {
        throw new Error('Bridge endpoint is required.');
    }

    if (!keyId) {
        throw new Error('Reconnect key ID is required.');
    }

    const url = new URL(endpoint);

    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        throw new Error('Bridge endpoint must use ws:// or wss://.');
    }

    if (!LOOPBACK_HOSTS.has(url.hostname)) {
        throw new Error('Bridge endpoint must use a loopback host.');
    }

    url.searchParams.delete('pairingId');
    url.searchParams.delete('pairingCode');
    url.searchParams.delete('sessionToken');
    url.searchParams.set('reconnectKeyId', keyId);

    return url.toString();
}

export function getAgentBridgeConnectionDiagnostics(
    endpoint: string,
    pageProtocol: string = typeof window === 'undefined' ? '' : window.location.protocol
): AgentBridgeConnectionDiagnostic[] {
    const trimmedEndpoint = endpoint.trim();

    if (!trimmedEndpoint) {
        return [];
    }

    let url: URL;

    try {
        url = new URL(trimmedEndpoint);
    } catch {
        return [{
            severity: 'error',
            title: 'Endpoint is not a valid URL',
            message: 'Use the exact WebSocket endpoint printed by the active bridge or returned by the pairing status tool, for example ws://127.0.0.1:<dynamic-port>/tasktime-agent.',
        }];
    }

    const diagnostics: AgentBridgeConnectionDiagnostic[] = [];

    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        diagnostics.push({
            severity: 'error',
            title: 'Unsupported endpoint protocol',
            message: 'The app-session endpoint must use ws:// or wss://.',
        });
    }

    if (!LOOPBACK_HOSTS.has(url.hostname)) {
        diagnostics.push({
            severity: 'error',
            title: 'Endpoint is not local',
            message: 'For v1, TaskTime Pro only connects to loopback bridge hosts such as 127.0.0.1, localhost, or [::1].',
        });
    }

    if (!url.port) {
        diagnostics.push({
            severity: 'warning',
            title: 'Endpoint has no explicit port',
            message: 'The packaged bridge normally prints a dynamic localhost port. Make sure the endpoint exactly matches the bridge output.',
        });
    }

    if (url.pathname !== '/tasktime-agent') {
        diagnostics.push({
            severity: 'warning',
            title: 'Unexpected bridge path',
            message: 'The default bridge path is /tasktime-agent. If you changed --path, make sure the pasted endpoint uses the same path.',
        });
    }

    if (pageProtocol === 'https:' && url.protocol === 'ws:') {
        diagnostics.push({
            severity: 'info',
            title: 'Local ws:// bridge',
            message: 'If this browser blocks the local WebSocket, use a WSS bridge endpoint, local development origin, or desktop wrapper.',
        });
    }

    if (diagnostics.length === 0) {
        diagnostics.push({
            severity: 'info',
            title: 'Endpoint looks local',
            message: 'Connection still requires the bridge to be running, the pairing code to be unused and unexpired, and the browser origin to be allowed by the bridge.',
        });
    }

    return diagnostics;
}
