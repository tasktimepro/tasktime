import { useCallback, useEffect, useRef, useState } from 'react';

import { SYNC_WORKER_CONFIG } from '@/config/google';
import { dropboxAccessTokenProvider } from '@/stores/yjs/providers/DropboxAccessTokenProvider';
import {
    claimActiveCloudStorageSession,
    clearCloudStorageSession,
    getCloudStorageLifecycle,
    getCloudStorageSessionRole,
    stageCloudStorageSession,
    type CloudStorageSessionRole,
} from '@/stores/yjs/cloudStorageLifecycle';
import {
    clearStoredDropboxSession,
    getStoredDropboxSession,
    storeDropboxSession,
} from '@/utils/dropboxAuthStorage';

const CALLBACK_TYPE = 'dropbox-auth-callback';
const CALLBACK_CHANNEL = 'dropbox-auth-callback';
const INVALIDATION_CHANNEL = 'tasktime-dropbox-auth-invalidation';
const AUTH_CHANGE_EVENT = 'tasktime:dropbox-auth-changed';
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
const POPUP_CLOSE_POLL_MS = 250;
const STATUS_VALIDATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface DropboxStatusResult {
    ok: boolean;
    status: number;
    body: Record<string, unknown>;
}

let lastAuthenticatedSessionId: string | null = null;
let lastAuthenticatedAt = 0;
let statusValidationInFlight: {
    sessionId: string;
    force: boolean;
    promise: Promise<DropboxStatusResult>;
} | null = null;

interface DropboxAuthState {
    isSignedIn: boolean;
    isLoading: boolean;
    sessionId: string | null;
    storageGeneration: number | null;
    storageRole: CloudStorageSessionRole;
    error: string | null;
}

interface DropboxSignInOptions {
    transferOwnerId?: string;
}

export interface DropboxStorageAuthResult {
    sessionId: string;
    storageGeneration: number;
    storageRole: Exclude<CloudStorageSessionRole, 'inactive'>;
}

interface CallbackPayload {
    type: typeof CALLBACK_TYPE;
    code: string | null;
    state: string | null;
    error: string | null;
}

interface DropboxInitResponse {
    authUrl: string;
    state: string;
    provider: 'dropbox';
}

interface DropboxCallbackResponse {
    sessionId: string;
    provider: 'dropbox';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    try {
        const value: unknown = await response.json();
        return isRecord(value) ? value : {};
    } catch {
        return {};
    }
}

function clearStatusValidation(sessionId?: string): void {
    if (sessionId && lastAuthenticatedSessionId !== sessionId) return;
    lastAuthenticatedSessionId = null;
    lastAuthenticatedAt = 0;
}

function rememberAuthenticatedSession(sessionId: string): void {
    lastAuthenticatedSessionId = sessionId;
    lastAuthenticatedAt = Date.now();
}

async function requestDropboxStatus(
    sessionId: string,
    { force = false }: { force?: boolean } = {},
): Promise<DropboxStatusResult> {
    const now = Date.now();
    if (!force
        && lastAuthenticatedSessionId === sessionId
        && now - lastAuthenticatedAt < STATUS_VALIDATION_TTL_MS) {
        return {
            ok: true,
            status: 200,
            body: { authenticated: true, provider: 'dropbox' },
        };
    }

    if (statusValidationInFlight?.sessionId === sessionId
        && (!force || statusValidationInFlight.force)) {
        return statusValidationInFlight.promise;
    }

    const promise = (async (): Promise<DropboxStatusResult> => {
        const response = await fetch(SYNC_WORKER_CONFIG.endpoints.dropboxAuthStatus, {
            method: 'GET',
            headers: { 'X-Session-Id': sessionId },
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
        const body = await readJson(response);
        if (response.ok && body.authenticated === true && body.provider === 'dropbox') {
            rememberAuthenticatedSession(sessionId);
        } else if (response.status === 401 || body.authenticated === false) {
            clearStatusValidation(sessionId);
        }
        return { ok: response.ok, status: response.status, body };
    })();
    const request = { sessionId, force, promise };
    statusValidationInFlight = request;

    try {
        return await promise;
    } finally {
        if (statusValidationInFlight === request) statusValidationInFlight = null;
    }
}

function workerErrorMessage(response: Pick<Response, 'status'>, body: Record<string, unknown>): string {
    if (body.code === 'PROVIDER_DISABLED') return 'Dropbox connections are not available yet.';
    if (body.code === 'NEW_CONNECTIONS_DISABLED') return 'New Dropbox connections are temporarily paused.';
    if (body.code === 'TRANSFERS_DISABLED') return 'Dropbox transfers are temporarily paused.';
    if (body.code === 'RATE_LIMITED') return 'Dropbox sign-in is temporarily rate limited.';
    if (response.status >= 500) return 'The Dropbox connection service is temporarily unavailable.';
    return 'Dropbox could not complete this request.';
}

function parseInitResponse(value: Record<string, unknown>): DropboxInitResponse {
    if (value.provider !== 'dropbox'
        || typeof value.authUrl !== 'string'
        || !value.authUrl.startsWith('https://www.dropbox.com/oauth2/authorize?')
        || typeof value.state !== 'string'
        || !value.state) {
        throw new Error('The Dropbox connection service returned an invalid response.');
    }
    return value as unknown as DropboxInitResponse;
}

function parseCallbackResponse(value: Record<string, unknown>): DropboxCallbackResponse {
    if (value.provider !== 'dropbox'
        || typeof value.sessionId !== 'string'
        || !value.sessionId) {
        throw new Error('The Dropbox connection service returned an invalid session.');
    }
    return value as unknown as DropboxCallbackResponse;
}

function isCallbackPayload(value: unknown): value is CallbackPayload {
    return isRecord(value)
        && value.type === CALLBACK_TYPE
        && (value.code === null || typeof value.code === 'string')
        && (value.state === null || typeof value.state === 'string')
        && (value.error === null || typeof value.error === 'string');
}

function waitForDropboxCallback(popup: Window, expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let settled = false;
        let callbackChannel: BroadcastChannel | null = null;

        const finish = (error?: Error, code?: string) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('message', handleMessage);
            window.clearInterval(closePoll);
            window.clearTimeout(timeout);
            callbackChannel?.close();
            try {
                popup.close();
            } catch {
                // The popup may already be closed or cross-origin.
            }
            if (error) reject(error);
            else resolve(code!);
        };

        const handlePayload = (value: unknown) => {
            if (!isCallbackPayload(value)) return;
            if (value.state !== expectedState) {
                finish(new Error('Dropbox sign-in could not be completed because the session no longer matched. Please try again.'));
                return;
            }
            if (value.error) {
                finish(new Error('Dropbox authorization was not completed.'));
                return;
            }
            if (!value.code) {
                finish(new Error('Dropbox did not return an authorization code.'));
                return;
            }
            finish(undefined, value.code);
        };

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== popup) return;
            handlePayload(event.data);
        };
        window.addEventListener('message', handleMessage);

        if (typeof BroadcastChannel !== 'undefined') {
            try {
                callbackChannel = new BroadcastChannel(CALLBACK_CHANNEL);
                callbackChannel.onmessage = event => handlePayload(event.data);
            } catch {
                callbackChannel = null;
            }
        }

        const closePoll = window.setInterval(() => {
            if (popup.closed) finish(new Error('The Dropbox authentication popup was closed.'));
        }, POPUP_CLOSE_POLL_MS);
        const timeout = window.setTimeout(() => {
            finish(new Error('Dropbox authentication timed out. Please try again.'));
        }, CALLBACK_TIMEOUT_MS);
    });
}

type DropboxAuthChangeAction = 'connected' | 'disconnected';

function publishAuthChange(
    action: DropboxAuthChangeAction,
    sessionId: string,
    senderId: string,
): void {
    const detail = { provider: 'dropbox', action, sessionId, senderId };
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail }));
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel(INVALIDATION_CHANNEL);
            channel.postMessage(detail);
            channel.close();
        } catch {
            // Cross-tab invalidation is best-effort; IndexedDB remains authoritative.
        }
    }
}

export function useDropboxAuth() {
    const instanceId = useRef(crypto.randomUUID());
    const mounted = useRef(true);
    const [state, setState] = useState<DropboxAuthState>({
        isSignedIn: false,
        isLoading: true,
        sessionId: null,
        storageGeneration: null,
        storageRole: 'inactive',
        error: null,
    });

    const syncFromStorage = useCallback(async (
        { force = false }: { force?: boolean } = {},
    ): Promise<void> => {
        if (force && mounted.current) {
            setState(current => ({ ...current, isLoading: true, error: null }));
        }
        const stored = await getStoredDropboxSession();
        if (!mounted.current) return;
        if (!stored) {
            setState({
                isSignedIn: false,
                isLoading: false,
                sessionId: null,
                storageGeneration: null,
                storageRole: 'inactive',
                error: null,
            });
            return;
        }
        let lifecycle;
        try {
            lifecycle = await getCloudStorageLifecycle();
        } catch {
            if (mounted.current) {
                setState({
                    isSignedIn: false,
                    isLoading: false,
                    sessionId: null,
                    storageGeneration: null,
                    storageRole: 'inactive',
                    error: 'Cloud storage state is temporarily unavailable.',
                });
            }
            return;
        }
        if (!mounted.current) return;
        const storageRole = getCloudStorageSessionRole(
            lifecycle,
            'dropbox',
            stored.sessionId,
        );
        const storageSession = storageRole === 'active'
            ? lifecycle.active
            : (storageRole === 'staged' ? lifecycle.stagedTarget : null);
        if (!storageSession) {
            clearStatusValidation(stored.sessionId);
            await clearStoredDropboxSession(stored.sessionId);
            if (mounted.current) {
                setState({
                    isSignedIn: false,
                    isLoading: false,
                    sessionId: null,
                    storageGeneration: null,
                    storageRole: 'inactive',
                    error: null,
                });
            }
            return;
        }
        let statusResult: DropboxStatusResult;
        try {
            statusResult = await requestDropboxStatus(stored.sessionId, { force });
        } catch {
            if (mounted.current) {
                setState({
                    isSignedIn: false,
                    isLoading: false,
                    sessionId: stored.sessionId,
                    storageGeneration: storageSession.generation,
                    storageRole,
                    error: 'The Dropbox connection service is temporarily unavailable.',
                });
            }
            return;
        }
        const { body } = statusResult;
        if (!mounted.current) return;
        if (statusResult.ok && body.authenticated === true && body.provider === 'dropbox') {
            dropboxAccessTokenProvider.setSession(stored.sessionId);
            setState({
                isSignedIn: true,
                isLoading: false,
                sessionId: stored.sessionId,
                storageGeneration: storageSession.generation,
                storageRole,
                error: null,
            });
            return;
        }
        const isDefinitivelyInvalid = statusResult.status === 401 || body.authenticated === false;
        if (isDefinitivelyInvalid) {
            await clearStoredDropboxSession(stored.sessionId);
            await clearCloudStorageSession(storageSession, { force: true }).catch(() => undefined);
        }
        if (!mounted.current) return;
        setState({
            isSignedIn: false,
            isLoading: false,
            sessionId: isDefinitivelyInvalid ? null : stored.sessionId,
            storageGeneration: isDefinitivelyInvalid ? null : storageSession.generation,
            storageRole: isDefinitivelyInvalid ? 'inactive' : storageRole,
            error: statusResult.ok
                ? 'The Dropbox connection service returned an invalid response.'
                : workerErrorMessage(statusResult, body),
        });
    }, []);

    const refresh = useCallback(() => syncFromStorage({ force: true }), [syncFromStorage]);

    useEffect(() => {
        mounted.current = true;
        void syncFromStorage();
        return () => {
            mounted.current = false;
        };
    }, [syncFromStorage]);

    useEffect(() => {
        const handleChange = (value: unknown) => {
            if (!isRecord(value)
                || value.provider !== 'dropbox'
                || typeof value.sessionId !== 'string'
                || value.senderId === instanceId.current) return;
            if (value.action === 'connected') {
                void syncFromStorage();
                return;
            }
            setState(current => {
                if (current.sessionId !== value.sessionId) return current;
                clearStatusValidation(value.sessionId);
                dropboxAccessTokenProvider.setSession(null);
                dropboxAccessTokenProvider.clearToken();
                return {
                    isSignedIn: false,
                    isLoading: false,
                    sessionId: null,
                    storageGeneration: null,
                    storageRole: 'inactive',
                    error: null,
                };
            });
        };
        const handleWindowChange = (event: Event) => {
            handleChange((event as CustomEvent<unknown>).detail);
        };
        window.addEventListener(AUTH_CHANGE_EVENT, handleWindowChange);
        let channel: BroadcastChannel | null = null;
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                channel = new BroadcastChannel(INVALIDATION_CHANNEL);
                channel.onmessage = event => handleChange(event.data);
            } catch {
                channel = null;
            }
        }
        return () => {
            window.removeEventListener(AUTH_CHANGE_EVENT, handleWindowChange);
            channel?.close();
        };
    }, [syncFromStorage]);

    const signIn = useCallback(async (
        { transferOwnerId }: DropboxSignInOptions = {},
    ): Promise<DropboxStorageAuthResult> => {
        if (!SYNC_WORKER_CONFIG.isEnabled) {
            throw new Error('The Dropbox connection service is not configured.');
        }
        const lifecycle = await getCloudStorageLifecycle();
        if (!transferOwnerId
            && lifecycle.active
            && lifecycle.active.provider !== 'dropbox') {
            throw new Error('Transfer from Google Drive before activating Dropbox.');
        }
        const popup = window.open('about:blank', 'tasktime-dropbox-auth', 'popup,width=540,height=720');
        if (!popup) throw new Error('Open popups to connect Dropbox.');
        setState(current => ({ ...current, isLoading: true, error: null }));
        try {
            const redirectUri = `${window.location.origin}/auth/dropbox/callback`;
            const initResponse = await fetch(SYNC_WORKER_CONFIG.endpoints.dropboxAuthInit, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    redirectUri,
                    purpose: transferOwnerId ? 'transfer' : 'connection',
                }),
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
            const initBody = await readJson(initResponse);
            if (!initResponse.ok) throw new Error(workerErrorMessage(initResponse, initBody));
            const init = parseInitResponse(initBody);
            popup.location.href = init.authUrl;
            const code = await waitForDropboxCallback(popup, init.state);
            const callbackResponse = await fetch(SYNC_WORKER_CONFIG.endpoints.dropboxAuthCallback, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, redirectUri, state: init.state }),
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
            const callbackBody = await readJson(callbackResponse);
            if (!callbackResponse.ok) {
                throw new Error(workerErrorMessage(callbackResponse, callbackBody));
            }
            const connected = parseCallbackResponse(callbackBody);
            await storeDropboxSession({
                provider: 'dropbox',
                sessionId: connected.sessionId,
                createdAt: new Date().toISOString(),
            });
            let boundLifecycle;
            try {
                boundLifecycle = transferOwnerId
                    ? await stageCloudStorageSession(
                        'dropbox',
                        connected.sessionId,
                        transferOwnerId,
                    )
                    : await claimActiveCloudStorageSession('dropbox', connected.sessionId);
            } catch (error) {
                await clearStoredDropboxSession(connected.sessionId);
                throw error;
            }
            const storageRole: CloudStorageSessionRole = transferOwnerId ? 'staged' : 'active';
            const storageSession = storageRole === 'active'
                ? boundLifecycle.active
                : boundLifecycle.stagedTarget;
            if (!storageSession) {
                await clearStoredDropboxSession(connected.sessionId);
                throw new Error('Dropbox storage ownership could not be established.');
            }
            dropboxAccessTokenProvider.setSession(connected.sessionId);
            rememberAuthenticatedSession(connected.sessionId);
            setState({
                isSignedIn: true,
                isLoading: false,
                sessionId: connected.sessionId,
                storageGeneration: storageSession.generation,
                storageRole,
                error: null,
            });
            publishAuthChange('connected', connected.sessionId, instanceId.current);
            return {
                sessionId: connected.sessionId,
                storageGeneration: storageSession.generation,
                storageRole,
            };
        } catch (error) {
            try {
                popup.close();
            } catch {
                // Ignore an already closed popup.
            }
            const message = error instanceof Error ? error.message : 'Dropbox sign-in failed.';
            setState(current => ({ ...current, isLoading: false, error: message }));
            throw new Error(message);
        }
    }, []);

    const assertTransferEnabled = useCallback(async (sessionOverride?: string): Promise<void> => {
        const sessionId = sessionOverride ?? state.sessionId;
        if (!sessionId) throw new Error('Reconnect Dropbox before transferring.');

        let response: Response;
        try {
            response = await fetch(SYNC_WORKER_CONFIG.endpoints.dropboxAuthStatus, {
                method: 'GET',
                headers: { 'X-Session-Id': sessionId },
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
        } catch {
            throw new Error('The Dropbox connection service is temporarily unavailable.');
        }
        const body = await readJson(response);
        if (!response.ok) throw new Error(workerErrorMessage(response, body));
        if (body.authenticated !== true || body.provider !== 'dropbox') {
            throw new Error('Reconnect Dropbox before transferring.');
        }
        if (body.transfersEnabled !== true) {
            throw new Error('Dropbox transfers are temporarily paused.');
        }
    }, [state.sessionId]);

    const disconnect = useCallback(async ({ revoke = false }: { revoke?: boolean } = {}): Promise<void> => {
        const sessionId = state.sessionId;
        if (!sessionId) return;
        if (revoke) {
            let response: Response;
            try {
                response = await fetch(SYNC_WORKER_CONFIG.endpoints.dropboxAuthRevoke, {
                    method: 'POST',
                    headers: { 'X-Session-Id': sessionId },
                    cache: 'no-store',
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer',
                });
            } catch {
                throw new Error('The Dropbox connection service is temporarily unavailable.');
            }
            if (!response.ok) {
                throw new Error(workerErrorMessage(response, await readJson(response)));
            }
        }
        if (state.storageGeneration !== null) {
            await clearCloudStorageSession({
                provider: 'dropbox',
                sessionId,
                generation: state.storageGeneration,
            });
        }
        const cleared = await clearStoredDropboxSession(sessionId);
        if (!cleared) throw new Error('Dropbox was disconnected elsewhere. Refresh and try again.');
        clearStatusValidation(sessionId);
        dropboxAccessTokenProvider.setSession(null);
        dropboxAccessTokenProvider.clearToken();
        publishAuthChange('disconnected', sessionId, instanceId.current);
        setState({
            isSignedIn: false,
            isLoading: false,
            sessionId: null,
            storageGeneration: null,
            storageRole: 'inactive',
            error: null,
        });
    }, [state.sessionId, state.storageGeneration]);

    return { ...state, signIn, disconnect, assertTransferEnabled, refresh };
}

/** Reset module-level status validation state. Test-only. */
export function _resetDropboxAuthStatusCache(): void {
    lastAuthenticatedSessionId = null;
    lastAuthenticatedAt = 0;
    statusValidationInFlight = null;
}
