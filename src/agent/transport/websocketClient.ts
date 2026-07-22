import type { AgentCommandContext, AgentCommandErrorCode } from '@/agent/types';
import type { AgentBridgeSession } from '@/agent/session';
import { isAgentBridgeSessionExpired } from '@/agent/session';
import { buildAgentBridgeSessionUrl } from '@/agent/browser/bridgeEndpoint';
import { buildAgentBridgeReconnectUrl } from '@/agent/browser/bridgeEndpoint';
import {
    signAgentBridgeReconnectChallenge,
    type AgentBridgeReconnectCredential,
} from '@/agent/browser/reconnectCredential';
import {
    AGENT_APP_SESSION_PROTOCOL_VERSION,
    createAgentBridgeSessionFromPairingMessage,
    getAgentAppSessionRequestMetadata,
    handleAgentAppSessionRequest,
    isAgentBridgeReconnectChallengeMessage,
    isAgentBridgeReconnectRegisteredMessage,
    isAgentAppSessionPairingMessage,
    type AgentAppSessionApprovalGrantPayload,
    type AgentAppSessionApprovalRequest,
    type AgentAppSessionApprovalVerificationRequest,
    type AgentAppSessionResponse,
    type AgentBridgeReconnectRegisteredMessage,
} from './protocol';

export type AgentWebSocketStatus =
    | 'idle'
    | 'connecting'
    | 'open'
    | 'closed'
    | 'error';

export interface AgentAppSessionCommandActivity {
    requestId: string | null;
    command: string;
    ok: boolean;
    errorCode?: AgentCommandErrorCode;
}

export interface AgentAppSessionCommandStart {
    requestId: string;
    command: string;
}

export interface AgentWebSocketLike {
    readyState: number;
    send: (data: string) => void;
    close: () => void;
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
}

export type AgentWebSocketConstructor = new (url: string) => AgentWebSocketLike;

export interface AgentAppSessionWebSocketClientOptions {
    url: string;
    context: AgentCommandContext;
    getContext?: () => AgentCommandContext;
    session?: AgentBridgeSession;
    reconnectCredential?: AgentBridgeReconnectCredential;
    WebSocketCtor?: AgentWebSocketConstructor;
    requestTimeoutMs?: number;
    autoReconnect?: boolean;
    reconnectDelayMs?: number;
    maxReconnectAttempts?: number;
    onStatusChange?: (status: AgentWebSocketStatus) => void;
    onSessionChange?: (session: AgentBridgeSession) => void;
    onReconnectRegistered?: (registration: AgentBridgeReconnectRegisteredMessage) => void;
    onReconnectFailure?: () => void;
    onCommandApprovalRequest?: (request: AgentAppSessionApprovalRequest) => Promise<boolean>;
    verifyApprovalToken?: (request: AgentAppSessionApprovalVerificationRequest) => Promise<boolean>;
    onCommandStart?: (activity: AgentAppSessionCommandStart) => void;
    onCommandActivity?: (activity: AgentAppSessionCommandActivity) => void;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_RECONNECT_DELAY_MS = 1000;

function getWebSocketCtor(override?: AgentWebSocketConstructor): AgentWebSocketConstructor {
    if (override) {
        return override;
    }

    if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket is not available in this environment.');
    }

    return WebSocket as unknown as AgentWebSocketConstructor;
}

function makeFailureResponse(
    requestId: string | null,
    command: string,
    code: AgentCommandErrorCode,
    message: string
): AgentAppSessionResponse {
    return {
        protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
        requestId,
        response: {
            ok: false,
            command,
            error: {
                code,
                message,
            },
        },
    };
}

function timeoutAfter(ms: number): Promise<AgentAppSessionResponse> {
    return new Promise((resolve) => {
        window.setTimeout(() => {
            resolve(makeFailureResponse(null, 'unknown', 'UNAVAILABLE', 'Agent command request timed out.'));
        }, ms);
    });
}

export class AgentAppSessionWebSocketClient {

    private readonly options: AgentAppSessionWebSocketClientOptions;
    private socket: AgentWebSocketLike | null = null;
    private session: AgentBridgeSession | null = null;
    private status: AgentWebSocketStatus = 'idle';
    private reconnectTimer: number | null = null;
    private reconnectAttempts = 0;
    private reconnectFailureReported = false;
    private manualClose = false;
    private commandQueue: Promise<void> = Promise.resolve();

    constructor(options: AgentAppSessionWebSocketClientOptions) {
        this.options = options;
        this.session = options.session ?? null;
    }

    getStatus(): AgentWebSocketStatus {
        return this.status;
    }

    connect(): void {
        if (this.socket && (this.status === 'connecting' || this.status === 'open')) {
            return;
        }

        if (this.session && isAgentBridgeSessionExpired(this.session)) {
            throw new Error('Agent bridge session expired.');
        }

        this.manualClose = false;
        this.clearReconnectTimer();
        const WebSocketCtor = getWebSocketCtor(this.options.WebSocketCtor);
        this.setStatus('connecting');
        this.socket = new WebSocketCtor(this.createConnectionUrl());
        this.socket.onopen = () => {
            if (!this.options.reconnectCredential || this.session) {
                this.reconnectAttempts = 0;
            }
            this.setStatus('open');
        };
        this.socket.onmessage = (event) => {
            void this.handleMessage(event.data);
        };
        this.socket.onerror = () => {
            this.setStatus('error');
        };
        this.socket.onclose = () => {
            this.setStatus('closed');
            this.socket = null;
            this.scheduleReconnect();
        };
    }

    close(): void {
        this.manualClose = true;
        this.clearReconnectTimer();
        const socket = this.socket;
        this.socket = null;

        if (socket) {
            socket.onclose = null;
            socket.close();
        }

        this.setStatus('closed');
    }

    revoke(): void {
        const socket = this.socket;

        if (socket && socket.readyState === 1 && this.session && !isAgentBridgeSessionExpired(this.session)) {
            socket.send(JSON.stringify({
                type: 'agent_bridge_control',
                protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
                sessionToken: this.session.sessionToken,
                action: 'revoke',
            }));
        }

        this.close();
    }

    sendApprovalGrant(grant: AgentAppSessionApprovalGrantPayload): boolean {
        const socket = this.socket;

        if (!socket || socket.readyState !== 1 || !this.session || isAgentBridgeSessionExpired(this.session)) {
            return false;
        }

        socket.send(JSON.stringify({
            type: 'agent_bridge_approval_grant',
            protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
            sessionToken: this.session.sessionToken,
            grant,
        }));

        return true;
    }

    sendApprovalGrantRevocation(grantId: string, revokedAt: number): boolean {
        const socket = this.socket;

        if (!socket || socket.readyState !== 1 || !this.session || isAgentBridgeSessionExpired(this.session)) {
            return false;
        }

        socket.send(JSON.stringify({
            type: 'agent_bridge_approval_grant_revoke',
            protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
            sessionToken: this.session.sessionToken,
            grantId,
            revokedAt,
        }));

        return true;
    }

    registerReconnectPublicKey(publicKeyJwk: JsonWebKey): boolean {
        const socket = this.socket;

        if (!socket || socket.readyState !== 1 || !this.session || isAgentBridgeSessionExpired(this.session)) {
            return false;
        }

        socket.send(JSON.stringify({
            type: 'agent_bridge_reconnect_register',
            protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
            sessionToken: this.session.sessionToken,
            publicKeyJwk,
        }));

        return true;
    }

    forgetReconnectKey(keyId: string): boolean {
        const socket = this.socket;

        if (!socket || socket.readyState !== 1 || !this.session || isAgentBridgeSessionExpired(this.session) || !keyId.trim()) {
            return false;
        }

        socket.send(JSON.stringify({
            type: 'agent_bridge_reconnect_forget',
            protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
            sessionToken: this.session.sessionToken,
            keyId: keyId.trim(),
        }));

        return true;
    }

    private setStatus(status: AgentWebSocketStatus): void {
        this.status = status;
        this.options.onStatusChange?.(status);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer === null) {
            return;
        }

        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }

    private scheduleReconnect(): void {
        if (!this.options.autoReconnect || this.manualClose || (this.session && isAgentBridgeSessionExpired(this.session))) {
            return;
        }

        const maxAttempts = this.options.maxReconnectAttempts ?? Number.POSITIVE_INFINITY;

        if (this.reconnectAttempts >= maxAttempts) {
            if (this.options.reconnectCredential && !this.session && !this.reconnectFailureReported) {
                this.reconnectFailureReported = true;
                this.options.onReconnectFailure?.();
            }
            return;
        }

        this.reconnectAttempts += 1;
        this.clearReconnectTimer();
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;

            if (this.manualClose || (this.session && isAgentBridgeSessionExpired(this.session))) {
                return;
            }

            this.connect();
        }, this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS);
    }

    private createConnectionUrl(): string {
        if (!this.session || isAgentBridgeSessionExpired(this.session)) {
            if (this.options.reconnectCredential) {
                return buildAgentBridgeReconnectUrl({
                    endpoint: this.options.url,
                    keyId: this.options.reconnectCredential.keyId,
                });
            }

            return this.options.url;
        }

        return buildAgentBridgeSessionUrl({
            endpoint: this.options.url,
            sessionToken: this.session.sessionToken,
        });
    }

    private async handleMessage(data: unknown): Promise<void> {
        const socket = this.socket;

        if (!socket || socket.readyState !== 1) {
            return;
        }

        let parsed: unknown;

        try {
            parsed = typeof data === 'string' ? JSON.parse(data) : data;
        } catch {
            socket.send(JSON.stringify(makeFailureResponse(null, 'unknown', 'INVALID_INPUT', 'Invalid JSON app-session message.')));
            return;
        }

        if (isAgentAppSessionPairingMessage(parsed)) {
            this.session = createAgentBridgeSessionFromPairingMessage(parsed);
            this.reconnectAttempts = 0;
            this.reconnectFailureReported = false;
            this.options.onSessionChange?.(this.session);
            return;
        }

        if (isAgentBridgeReconnectRegisteredMessage(parsed)) {
            this.options.onReconnectRegistered?.(parsed);
            return;
        }

        if (isAgentBridgeReconnectChallengeMessage(parsed)) {
            const credential = this.options.reconnectCredential;

            if (!credential) {
                this.options.onReconnectFailure?.();
                socket.close();
                return;
            }

            try {
                const signature = await signAgentBridgeReconnectChallenge(
                    credential,
                    parsed,
                    globalThis.location?.origin ?? parsed.origin
                );

                socket.send(JSON.stringify({
                    type: 'agent_bridge_reconnect_proof',
                    protocolVersion: AGENT_APP_SESSION_PROTOCOL_VERSION,
                    keyId: parsed.keyId,
                    challengeId: parsed.challengeId,
                    signature,
                }));
            } catch {
                this.options.onReconnectFailure?.();
                socket.close();
            }

            return;
        }

        if (!this.session) {
            socket.send(JSON.stringify(makeFailureResponse(null, 'unknown', 'PERMISSION_DENIED', 'Agent bridge session is not paired.')));
            return;
        }

        if (isAgentBridgeSessionExpired(this.session)) {
            socket.send(JSON.stringify(makeFailureResponse(null, 'unknown', 'PERMISSION_DENIED', 'Agent bridge session expired.')));
            return;
        }

        const requestMetadata = getAgentAppSessionRequestMetadata(parsed);
        if (!requestMetadata) {
            const response = await Promise.race([
                handleAgentAppSessionRequest(this.options.getContext?.() ?? this.options.context, this.session, parsed, {
                    requestApproval: this.options.onCommandApprovalRequest,
                    verifyApprovalToken: this.options.verifyApprovalToken,
                }),
                timeoutAfter(this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
            ]);
            const errorCode = 'error' in response.response ? response.response.error.code : undefined;

            this.options.onCommandActivity?.({
                requestId: response.requestId,
                command: response.response.command,
                ok: response.response.ok,
                errorCode,
            });

            socket.send(JSON.stringify(response));
            return;
        }

        this.enqueueCommand(socket, parsed, requestMetadata);
    }

    private enqueueCommand(socket: AgentWebSocketLike, parsed: unknown, requestMetadata: AgentAppSessionCommandStart): void {
        this.commandQueue = this.commandQueue
            .catch(() => undefined)
            .then(async () => {
                if (socket !== this.socket || socket.readyState !== 1 || !this.session) {
                    return;
                }

                this.options.onCommandStart?.(requestMetadata);

                const response = await Promise.race([
                    handleAgentAppSessionRequest(this.options.getContext?.() ?? this.options.context, this.session, parsed, {
                        requestApproval: this.options.onCommandApprovalRequest,
                        verifyApprovalToken: this.options.verifyApprovalToken,
                    }),
                    timeoutAfter(this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS),
                ]);
                const errorCode = 'error' in response.response ? response.response.error.code : undefined;

                this.options.onCommandActivity?.({
                    requestId: response.requestId,
                    command: response.response.command,
                    ok: response.response.ok,
                    errorCode,
                });

                if (socket === this.socket && socket.readyState === 1) {
                    socket.send(JSON.stringify(response));
                }
            });
    }
}
