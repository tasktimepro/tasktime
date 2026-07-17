/**
 * Google Auth hook - Worker mode only
 * 
 * Uses Cloudflare Worker for OAuth and token management:
 * - Refresh tokens stored server-side (persistent across browser restarts)
 * - No client-side token refresh scheduling needed
 * - Requires VITE_SYNC_WORKER_URL to be set
 */

import { useState, useEffect, useCallback } from 'react';
import { SYNC_WORKER_CONFIG } from '@/config/google';
import { captureDebugBundleIncident } from '@/utils/debugbundle';
import { driveAccessTokenProvider } from '@/stores/yjs/providers/DriveAccessTokenProvider';
import {
    publishDriveAuthInvalidation,
    subscribeToDriveAuthInvalidation,
} from './driveAuthInvalidation';
import { 
    clearLegacyStoredToken, getStoredSession, storeSession, clearStoredSession, type StoredSession
} from '@/utils/googleAuthStorage';

export interface GoogleUser {
    id: string;
    email: string;
    name?: string;
    picture?: string;
}

export type DriveTransport = 'proxy' | 'direct';

interface AuthState {
    isSignedIn: boolean;
    isLoading: boolean;
    user: GoogleUser | null;
    accessToken: string | null;
    sessionId: string | null;
    driveTransport: DriveTransport;
    error: string | null;
    hadPreviousSession: boolean;
}

type ValidateWorkerSession = (session: StoredSession, options?: { force?: boolean }) => Promise<boolean>;
type SignOutFromWorker = (options?: { revoke?: boolean }) => Promise<void>;
const SIGN_IN_CAPACITY_EXCEEDED_ERROR = 'Google Drive sign-in is temporarily unavailable because the sync service reached its daily sign-in limit. Please try again tomorrow.';
const AUTH_POPUP_CLOSED_ERROR = 'Authentication popup was closed before sign-in completed.';
const AUTH_STATE_MISMATCH_ERROR = 'Google sign-in could not be completed because the session no longer matched. Please try connecting again.';
const AUTH_TIMED_OUT_ERROR = 'Authentication timed out. Please try again.';
const AUTH_INCIDENT_THROTTLE_MS = 15 * 60 * 1000;
const AUTH_CONFIG_INCIDENT_THROTTLE_MS = 60 * 60 * 1000;
const AUTH_INIT_RETRY_DELAYS_MS = [500, 1500];
const AUTH_POPUP_CLOSE_CHECK_DELAY_MS = 250;

const HAD_PREVIOUS_SESSION_KEY = 'google-auth-had-previous-session';

function readHadPreviousSessionFlag(): boolean {

    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return window.sessionStorage.getItem(HAD_PREVIOUS_SESSION_KEY) === 'true';
    } catch {
        return false;
    }
}

function writeHadPreviousSessionFlag(value: boolean): void {

    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (value) {
            window.sessionStorage.setItem(HAD_PREVIOUS_SESSION_KEY, 'true');
        } else {
            window.sessionStorage.removeItem(HAD_PREVIOUS_SESSION_KEY);
        }
    } catch {
        // Ignore sessionStorage failures and keep the in-memory state usable.
    }
}

// Verify Worker mode is enabled
if (!SYNC_WORKER_CONFIG.isEnabled) {
    console.error('[useGoogleAuth] VITE_SYNC_WORKER_URL not configured - Google Drive sync will not work');
}

// Simple pub/sub so multiple hook instances stay in sync without reloads
const authSubscribers = new Set<() => void>();
let forceReconnectState = false;

// Module-level throttle for session validation. Repeated mounts within the
// TTL window (e.g. More sheet open/close, tab switches) reuse the cached
// result instead of hitting /auth/status every time. The Worker manages
// token refresh server-side, so the client only needs a rare liveness check.
const SESSION_VALIDATION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
let lastValidationTime = 0;
let lastValidationResult = false;
let lastValidationSessionId: string | null = null;
let lastValidationDriveTransport: DriveTransport = 'proxy';
let validationInFlight: {
    sessionId: string;
    force: boolean;
    promise: Promise<boolean>;
} | null = null;
let legacyTokenCleanupPromise: Promise<void> | null = null;

function ensureLegacyTokenCleanup(): Promise<void> {
    legacyTokenCleanupPromise ??= clearLegacyStoredToken();
    return legacyTokenCleanupPromise;
}

function parseDriveTransportPolicy(value: unknown): DriveTransport {

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return 'proxy';
    }

    const policy = value as { driveTransport?: unknown; transportPolicyVersion?: unknown };

    return policy.driveTransport === 'direct' && policy.transportPolicyVersion === 1
        ? 'direct'
        : 'proxy';
}

function getLastValidatedDriveTransport(sessionId: string): DriveTransport {

    return lastValidationSessionId === sessionId
        ? lastValidationDriveTransport
        : 'proxy';
}

const notifyAuthSubscribers = () => {
    authSubscribers.forEach(subscriber => {
        try {
            subscriber();
        } catch (error) {
            console.error('Auth subscriber error:', error);
            captureGoogleAuthIncident(
                'auth.subscriber_callback_failed',
                'TaskTime Pro Google auth subscriber callback failed',
                error,
                {},
                30 * 60 * 1000,
            );
        }
    });
};

function getEndpointOrigin(endpoint: string | undefined): string | null {

    if (!endpoint) {
        return null;
    }

    try {
        return new URL(endpoint).origin;
    } catch {
        return endpoint;
    }
}

function toAuthError(error: unknown, endpoint?: string): Error {

    if (error instanceof TypeError) {
        const origin = getEndpointOrigin(endpoint);

        if (origin) {
            return new Error(`Unable to reach the Google Drive sync service at ${origin}. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.`);
        }

        return new Error('Unable to reach the Google Drive sync service. Check your connection and try again.');
    }

    if (error instanceof Error) {
        return new Error(normalizeAuthErrorMessage(error.message));
    }

    return new Error('Sign in failed');
}

function closeAuthPopup(popup: Window | null): void {

    if (!popup) {
        return;
    }

    try {
        popup.close();
    } catch {
        // Ignore cross-origin or already-closed popup failures.
    }
}

function normalizeAuthErrorMessage(message: string): string {

    if (/kv put\(\) limit exceeded for the day/i.test(message)) {
        return SIGN_IN_CAPACITY_EXCEEDED_ERROR;
    }

    return message;
}

function shouldCaptureSignInIncident(error: Error): boolean {

    const message = error.message || '';

    return !(
        message === 'Failed to open auth popup. Check popup blocker settings.' ||
        message === 'Authentication popup was closed before Google sign-in could start.' ||
        message === AUTH_POPUP_CLOSED_ERROR ||
        message === AUTH_STATE_MISMATCH_ERROR ||
        message === AUTH_TIMED_OUT_ERROR
    );
}

function shouldSilentlyRestoreExistingSessionAfterAuthError(error: Error): boolean {

    return error.message === AUTH_STATE_MISMATCH_ERROR ||
        error.message === AUTH_POPUP_CLOSED_ERROR ||
        error.message === AUTH_TIMED_OUT_ERROR;
}

function isRetryableAuthInitError(error: unknown): boolean {

    return error instanceof TypeError;
}

function isRetryableAuthInitResponse(response: Response): boolean {

    return response.status === 0 || response.status === 408 || response.status >= 500;
}

function waitForAuthInitRetry(delayMs: number): Promise<void> {

    return new Promise(resolve => {
        window.setTimeout(resolve, delayMs);
    });
}

async function requestAuthInitWithRetry(
    redirectUri: string,
    onRetry?: (attempt: number, delayMs: number) => void,
): Promise<Response> {

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= AUTH_INIT_RETRY_DELAYS_MS.length; attempt++) {
        try {
            const response = await fetch(SYNC_WORKER_CONFIG.endpoints.authInit, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ redirectUri }),
            });

            if (response.ok || !isRetryableAuthInitResponse(response) || attempt === AUTH_INIT_RETRY_DELAYS_MS.length) {
                return response;
            }

            lastError = new Error(`Failed to initialize auth flow (${response.status})`);
        } catch (error) {
            lastError = error;

            if (!isRetryableAuthInitError(error) || attempt === AUTH_INIT_RETRY_DELAYS_MS.length) {
                throw error;
            }
        }

        const retryDelayMs = AUTH_INIT_RETRY_DELAYS_MS[attempt];
        onRetry?.(attempt + 1, retryDelayMs);
        await waitForAuthInitRetry(retryDelayMs);
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to initialize auth flow');
}

function captureGoogleAuthIncident(
    incidentKey: string,
    message: string,
    error: unknown,
    context: Record<string, unknown>,
    throttleMs: number = AUTH_INCIDENT_THROTTLE_MS,
): void {

    captureDebugBundleIncident({
        incidentKey,
        name: 'TaskTimeGoogleAuthError',
        message,
        error,
        context,
        throttleMs,
    });
}

async function readResponseError(response: Response, fallbackMessage: string): Promise<string> {

    try {
        const contentType = response.headers?.get?.('Content-Type') || '';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            const errorMessage = typeof data?.error === 'string' ? data.error.trim() : '';
            const detailMessage = typeof data?.details === 'string' ? data.details.trim() : '';

            if (detailMessage && (!errorMessage || errorMessage === 'Authentication failed')) {
                return normalizeAuthErrorMessage(detailMessage);
            }

            if (errorMessage && detailMessage && errorMessage !== detailMessage) {
                return normalizeAuthErrorMessage(`${errorMessage}: ${detailMessage}`);
            }

            if (errorMessage) {
                return normalizeAuthErrorMessage(errorMessage);
            }

            if (detailMessage) {
                return normalizeAuthErrorMessage(detailMessage);
            }
        }

        const text = await response.text();

        if (text.trim()) {
            return normalizeAuthErrorMessage(text.trim());
        }
    } catch {
        // Fall back to the generic message when the error body cannot be read.
    }

    return fallbackMessage;
}

/**
 * Google Auth hook - automatically uses Worker or SPA mode based on config
 */
export const useGoogleAuth = () => {

    const [state, setState] = useState<AuthState>({
        isSignedIn: false,
        isLoading: true,
        user: null,
    accessToken: null,
    sessionId: null,
    driveTransport: 'proxy',
        error: null,
        hadPreviousSession: readHadPreviousSessionFlag(),
    });

    // ============================================
    // WORKER MODE - Cloudflare Worker handles tokens
    // ============================================

    const isOnline = useCallback(() => {
        if (typeof navigator === 'undefined') {
            return true;
        }

        return navigator.onLine;
    }, []);

    const validateWorkerSession: ValidateWorkerSession = useCallback(async (...args: unknown[]) => {
        const [session, options] = args as Parameters<ValidateWorkerSession>;

        if (!isOnline()) {
            // Offline: assume stored session is still valid; don't clear it.
            return true;
        }

        // Reuse the cached result when the same session was validated recently.
        const now = Date.now();
        if (
            lastValidationSessionId === session.sessionId &&
            options?.force !== true
            && now - lastValidationTime < SESSION_VALIDATION_TTL_MS
        ) {
            return lastValidationResult;
        }

        const force = options?.force === true;
        if (
            validationInFlight?.sessionId === session.sessionId
            && (!force || validationInFlight.force)
        ) {
            return validationInFlight.promise;
        }

        const promise = (async (): Promise<boolean> => {
            try {
                const response = await fetch(SYNC_WORKER_CONFIG.endpoints.authStatus, {
                    method: 'GET',
                    headers: { 'X-Session-Id': session.sessionId },
                    cache: 'no-store',
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer',
                });

                if (!response.ok) {
                    // 5xx or unexpected status: treat as transient server error.
                    // Only 2xx with authenticated:false means explicitly invalid.
                    if (response.status === 429 || response.status >= 500) {
                        lastValidationTime = now;
                        lastValidationResult = true;
                        lastValidationSessionId = session.sessionId;
                        lastValidationDriveTransport = 'proxy';
                        return true;
                    }
                    lastValidationTime = now;
                    lastValidationResult = false;
                    lastValidationSessionId = session.sessionId;
                    lastValidationDriveTransport = 'proxy';
                    return false;
                }

                const data = await response.json();
                const isValid = data.authenticated === true;
                lastValidationTime = now;
                lastValidationResult = isValid;
                lastValidationSessionId = session.sessionId;
                lastValidationDriveTransport = isValid ? parseDriveTransportPolicy(data) : 'proxy';
                return isValid;
            } catch {
                // Network error (offline, DNS failure, Worker unreachable).
                // Optimistically keep the session; don't wipe credentials for
                // transient connectivity issues.
                lastValidationTime = now;
                lastValidationResult = true;
                lastValidationSessionId = session.sessionId;
                lastValidationDriveTransport = 'proxy';
                return true;
            }
        })();
        const request = { sessionId: session.sessionId, force, promise };
        validationInFlight = request;

        try {
            return await promise;
        } finally {
            if (validationInFlight === request) validationInFlight = null;
        }
    }, [isOnline]);

    const refreshDriveTransport = useCallback(async (): Promise<DriveTransport> => {
        const session = await getStoredSession();
        if (!session || session.sessionId !== state.sessionId || !isOnline()) {
            driveAccessTokenProvider.clearToken();
            setState(previous => ({ ...previous, driveTransport: 'proxy' }));
            return 'proxy';
        }

        await validateWorkerSession(session, { force: true });
        const driveTransport = getLastValidatedDriveTransport(session.sessionId);
        if (driveTransport === 'proxy') driveAccessTokenProvider.clearToken();
        setState(previous => previous.sessionId === session.sessionId
            ? { ...previous, driveTransport }
            : previous);
        return driveTransport;
    }, [isOnline, state.sessionId, validateWorkerSession]);


    const signInWithWorker = useCallback(async (): Promise<void> => {

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        let popup: Window | null = null;
        let failedStep = 'open-popup';
        let authInitRetryCount = 0;

        try {
            popup = openPendingAuthPopup();
            failedStep = 'auth-init';

            // 1. Get auth URL from Worker. The popup is already open to preserve
            // the user gesture on mobile, so brief network failures can be retried
            // without requiring the user to tap Connect again.
            const redirectUri = `${window.location.origin}/auth/callback`;
            const initResponse = await requestAuthInitWithRetry(redirectUri, (attempt) => {
                authInitRetryCount = attempt;
                updatePendingAuthPopupMessage(
                    popup,
                    attempt === 1
                        ? 'Still connecting Google Drive...'
                        : 'Retrying Google Drive connection...',
                );
            });

            if (!initResponse.ok) {
                const errorMessage = await readResponseError(initResponse, 'Failed to initialize auth flow');
                throw new Error(errorMessage);
            }

            const { authUrl, state: authState } = await initResponse.json();
            sessionStorage.setItem('google_auth_state', authState);
            failedStep = 'popup-navigation';

            // 2. Navigate the already-open popup to preserve the user gesture on mobile browsers
            navigateAuthPopup(popup, authUrl);
            failedStep = 'oauth-callback';

            // 3. Wait for callback
            const code = await waitForAuthCallback(popup, authState);
            failedStep = 'auth-exchange';

            // 4. Exchange code for session via Worker
            const callbackResponse = await fetch(SYNC_WORKER_CONFIG.endpoints.authCallback, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    redirectUri,
                }),
            });

            if (!callbackResponse.ok) {
                const errorMessage = await readResponseError(callbackResponse, 'Authentication failed');
                throw new Error(errorMessage);
            }

            const { sessionId, user } = await callbackResponse.json();
            failedStep = 'session-validation';

            const isValid = await validateWorkerSession({
                sessionId,
                userId: user.id,
                email: user.email,
                createdAt: new Date().toISOString(),
            });

            if (!isValid) {
                throw new Error('Google Drive access is not authorized for this session. Please reconnect and allow Drive access.');
            }

            const driveTransport = getLastValidatedDriveTransport(sessionId);

            // 5. Store session
            failedStep = 'session-store';
            await storeSession({
                sessionId,
                userId: user.id,
                email: user.email,
                createdAt: new Date().toISOString(),
            });
            driveAccessTokenProvider.setSession(sessionId);
            publishDriveAuthInvalidation('session-replaced');

            setState({
                isSignedIn: true,
                isLoading: false,
                user,
                accessToken: null, // Worker mode doesn't expose access token
                sessionId,
                driveTransport,
                error: null,
                hadPreviousSession: true,
            });

            forceReconnectState = false;
            writeHadPreviousSessionFlag(true);
            clearPendingAuthState();

            notifyAuthSubscribers();

        } catch (error) {
            closeAuthPopup(popup);
            clearPendingAuthState();

            const authError = toAuthError(error, SYNC_WORKER_CONFIG.endpoints.authInit);

            if (shouldSilentlyRestoreExistingSessionAfterAuthError(authError)) {
                const existingSession = await getStoredSession();

                if (existingSession) {
                    const isValidExistingSession = await validateWorkerSession(existingSession);

                    if (isValidExistingSession) {
                        setState({
                            isSignedIn: true,
                            isLoading: false,
                            user: { id: existingSession.userId, email: existingSession.email },
                            accessToken: null,
                            sessionId: existingSession.sessionId,
                            driveTransport: getLastValidatedDriveTransport(existingSession.sessionId),
                            error: null,
                            hadPreviousSession: true,
                        });
                        driveAccessTokenProvider.setSession(existingSession.sessionId);

                        forceReconnectState = false;
                        writeHadPreviousSessionFlag(true);

                        notifyAuthSubscribers();
                        return;
                    }
                }
            }

            setState(prev => ({
                ...prev,
                isLoading: false,
                error: authError.message,
            }));

            if (shouldCaptureSignInIncident(authError)) {
                captureGoogleAuthIncident(
                    'auth.sign_in_failed',
                    'TaskTime Pro Google Drive sign-in failed',
                    authError,
                    {
                        step: failedStep,
                        workerOrigin: getEndpointOrigin(SYNC_WORKER_CONFIG.endpoints.authInit),
                        authInitRetryCount,
                    },
                );
            }

            throw authError;
        }
    }, [validateWorkerSession]);

    const signOutFromWorker: SignOutFromWorker = useCallback(async (...args: unknown[]) => {
        const [options] = args as Parameters<SignOutFromWorker>;

        const revoke = options?.revoke ?? false;

        if (revoke && state.sessionId) {
            let response: Response;

            try {
                response = await fetch(SYNC_WORKER_CONFIG.endpoints.authRevoke, {
                    method: 'POST',
                    headers: { 'X-Session-Id': state.sessionId },
                    cache: 'no-store',
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer',
                });
            } catch (error) {
                const revokeError = toAuthError(error, SYNC_WORKER_CONFIG.endpoints.authRevoke);

                setState(prev => ({
                    ...prev,
                    error: revokeError.message,
                }));

                throw revokeError;
            }

            if (!response.ok) {
                const message = await readResponseError(
                    response,
                    'Google Drive access could not be revoked. Please try again.',
                );
                const revokeError = new Error(normalizeAuthErrorMessage(message));

                setState(prev => ({
                    ...prev,
                    error: revokeError.message,
                }));

                throw revokeError;
            }
        }

        if (state.sessionId) {
            await clearStoredSession(state.sessionId);
        }
        driveAccessTokenProvider.setSession(null);
        publishDriveAuthInvalidation(revoke ? 'revoked' : 'signed-out');
        forceReconnectState = false;
        writeHadPreviousSessionFlag(false);

        setState({
            isSignedIn: false,
            isLoading: false,
            user: null,
            accessToken: null,
            sessionId: null,
            driveTransport: 'proxy',
            error: null,
            hadPreviousSession: false,
        });

        notifyAuthSubscribers();
    }, [state.sessionId]);

    const invalidateStoredSession = useCallback(async (): Promise<void> => {

        forceReconnectState = true;

        try {
            if (state.sessionId) {
                await clearStoredSession(state.sessionId);
            }
        } catch {
            // Ignore storage cleanup failures and still move UI into reconnect state.
        }
        driveAccessTokenProvider.setSession(null);
        publishDriveAuthInvalidation('authorization-failed');

        writeHadPreviousSessionFlag(true);

        setState({
            isSignedIn: false,
            isLoading: false,
            user: null,
            accessToken: null,
            sessionId: null,
            driveTransport: 'proxy',
            error: null,
            hadPreviousSession: true,
        });

        notifyAuthSubscribers();
    }, [state.sessionId]);

    // ============================================
    // RESTORE SESSION FROM STORAGE
    // ============================================

    const syncFromStorage = useCallback(async () => {

        void ensureLegacyTokenCleanup();

        if (!SYNC_WORKER_CONFIG.isEnabled) {
            console.error('[useGoogleAuth] Worker URL not configured');
            captureGoogleAuthIncident(
                'auth.worker_config_missing',
                'TaskTime Pro Google Drive sync worker URL is missing',
                new Error('Sync Worker not configured'),
                {},
                AUTH_CONFIG_INCIDENT_THROTTLE_MS,
            );
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Sync Worker not configured',
                hadPreviousSession: readHadPreviousSessionFlag(),
            }));
            return;
        }

        if (forceReconnectState) {
            driveAccessTokenProvider.setSession(null);
            setState({
                isSignedIn: false,
                isLoading: false,
                user: null,
                accessToken: null,
                sessionId: null,
                driveTransport: 'proxy',
                error: null,
                hadPreviousSession: true,
            });
            return;
        }

        const session = await getStoredSession();
        if (session) {
            writeHadPreviousSessionFlag(true);

            if (!isOnline()) {
                driveAccessTokenProvider.setSession(session.sessionId);
                setState({
                    isSignedIn: true,
                    isLoading: false,
                    user: { id: session.userId, email: session.email },
                    accessToken: null,
                    sessionId: session.sessionId,
                    driveTransport: 'proxy',
                    error: null,
                    hadPreviousSession: true,
                });
                return;
            }

            const isValid = await validateWorkerSession(session);

            if (forceReconnectState) {
                driveAccessTokenProvider.setSession(null);
                setState({
                    isSignedIn: false,
                    isLoading: false,
                    user: null,
                    accessToken: null,
                    sessionId: null,
                    driveTransport: 'proxy',
                    error: null,
                    hadPreviousSession: true,
                });
                return;
            }

            if (isValid) {
                forceReconnectState = false;
                driveAccessTokenProvider.setSession(session.sessionId);
                setState({
                    isSignedIn: true,
                    isLoading: false,
                    user: { id: session.userId, email: session.email },
                    accessToken: null,
                    sessionId: session.sessionId,
                    driveTransport: getLastValidatedDriveTransport(session.sessionId),
                    error: null,
                    hadPreviousSession: true,
                });
                return;
            }
            await clearStoredSession(session.sessionId);
            driveAccessTokenProvider.setSession(null);
            publishDriveAuthInvalidation('authorization-failed');
            setState(prev => ({
                ...prev,
                isSignedIn: false,
                isLoading: false,
                user: null,
                accessToken: null,
                sessionId: null,
                driveTransport: 'proxy',
                error: null,
                hadPreviousSession: true,
            }));
            return;
        }
        driveAccessTokenProvider.setSession(null);
        setState(prev => ({
            ...prev,
            isLoading: false,
            hadPreviousSession: readHadPreviousSessionFlag(),
        }));
    }, [validateWorkerSession, isOnline]);

    // ============================================
    // INITIALIZATION
    // ============================================

    useEffect(() => {

        syncFromStorage();

        const handleExternalAuthChange = () => {
            syncFromStorage();
        };

        authSubscribers.add(handleExternalAuthChange);

        return () => {
            authSubscribers.delete(handleExternalAuthChange);
        };

    }, [syncFromStorage]);

    useEffect(() => {
        const handleOnline = () => {
            syncFromStorage();
        };

        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, [syncFromStorage]);

    useEffect(() => subscribeToDriveAuthInvalidation(() => {
        driveAccessTokenProvider.clearToken();
        void syncFromStorage();
    }), [syncFromStorage]);

    return {
        ...state,
        signIn: signInWithWorker,
        signOut: () => signOutFromWorker({ revoke: false }),
        revokeAccess: () => signOutFromWorker({ revoke: true }),
        invalidateSession: invalidateStoredSession,
        refreshDriveTransport,
    };
};

/** Reset module-level caches. Test-only. */
export function _resetValidationCache(): void {
    lastValidationTime = 0;
    lastValidationResult = false;
    lastValidationSessionId = null;
    lastValidationDriveTransport = 'proxy';
    validationInFlight = null;
    forceReconnectState = false;
    legacyTokenCleanupPromise = null;
    driveAccessTokenProvider.setSession(null);
}

// ============================================
// HELPER FUNCTIONS (for Worker OAuth popup flow)
// ============================================

function getAuthPopupFeatures(): string {

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    return `width=${width},height=${height},left=${left},top=${top},popup=1`;
}

function openPendingAuthPopup(): Window {

    const popup = window.open('', 'google-auth', getAuthPopupFeatures());

    if (!popup) {
        throw new Error('Failed to open auth popup. Check popup blocker settings.');
    }

    renderPendingAuthPopup(popup);

    return popup;
}

function renderPendingAuthPopup(popup: Window): void {

    try {
        const popupTheme = resolvePendingAuthPopupTheme();
        const popupDocument = popup.document;
        const viewport = popupDocument.createElement('meta');
        const title = popupDocument.createElement('title');
        const style = popupDocument.createElement('style');
        const container = popupDocument.createElement('main');
        const spinner = popupDocument.createElement('div');
        const message = popupDocument.createElement('p');

        popupDocument.documentElement.lang = 'en';

        viewport.setAttribute('name', 'viewport');
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');

        title.textContent = 'Connecting Google Drive...';

        style.textContent = `
            :root {
                color-scheme: ${popupTheme.colorScheme};
            }

            body {
                margin: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: system-ui, sans-serif;
                background: ${popupTheme.background};
                color: ${popupTheme.foreground};
            }

            main {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 24px;
                text-align: center;
            }

            .spinner {
                width: 32px;
                height: 32px;
                margin-bottom: 16px;
                border: 3px solid ${popupTheme.spinnerTrack};
                border-top-color: currentColor;
                border-radius: 9999px;
                animation: spin 0.8s linear infinite;
            }

            p {
                margin: 0;
                font-size: 14px;
                color: ${popupTheme.mutedForeground};
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `;

        spinner.className = 'spinner';
        message.dataset.authMessage = 'true';
        message.textContent = 'Connecting to Google...';
        container.replaceChildren(spinner, message);

        popupDocument.head.replaceChildren(viewport, title, style);
        popupDocument.body.replaceChildren(container);
    } catch {
        // Ignore cross-browser document access failures for blank popups.
    }
}

function updatePendingAuthPopupMessage(popup: Window | null, text: string): void {

    if (!popup) {
        return;
    }

    try {
        const message = popup.document.body.querySelector('[data-auth-message="true"]');
        if (message) {
            message.textContent = text;
        }
    } catch {
        // Ignore cross-browser document access failures for blank popups.
    }
}

function clearPendingAuthState(): void {

    try {
        sessionStorage.removeItem('google_auth_state');
    } catch {
        // Ignore storage failures.
    }
}

function resolvePendingAuthPopupTheme(): { background: string; foreground: string; mutedForeground: string; spinnerTrack: string; colorScheme: 'light' | 'dark' } {

    const darkModeActive = document.documentElement.classList.contains('dark');
    const sourceElement = document.body ?? document.documentElement;
    const sourceStyles = window.getComputedStyle(sourceElement);
    const background = sourceStyles.backgroundColor;
    const foreground = sourceStyles.color;
    const mutedForeground = darkModeActive ? 'rgb(163, 163, 163)' : 'rgb(82, 82, 82)';
    const spinnerTrack = darkModeActive ? 'rgba(250, 250, 250, 0.24)' : 'rgba(10, 10, 10, 0.18)';

    if (background && foreground) {
        return {
            background,
            foreground,
            mutedForeground,
            spinnerTrack,
            colorScheme: darkModeActive ? 'dark' : 'light',
        };
    }

    if (darkModeActive) {
        return {
            background: 'rgb(10, 10, 10)',
            foreground: 'rgb(250, 250, 250)',
            mutedForeground,
            spinnerTrack,
            colorScheme: 'dark',
        };
    }

    return {
        background: 'rgb(254, 254, 254)',
        foreground: 'rgb(10, 10, 10)',
        mutedForeground,
        spinnerTrack,
        colorScheme: 'light',
    };
}

function navigateAuthPopup(popup: Window, url: string): void {

    if (popup.closed) {
        throw new Error('Authentication popup was closed before Google sign-in could start.');
    }

    popup.location.href = url;
    popup.focus();
}

function waitForAuthCallback(popup: Window, expectedState: string): Promise<string> {

    return new Promise((resolve, reject) => {

        let settled = false;
        let broadcastChannel: BroadcastChannel | null = null;
        let closeCheckTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('focus', schedulePopupClosedCheck);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearTimeout(timeoutId);
            if (closeCheckTimeoutId) {
                clearTimeout(closeCheckTimeoutId);
                closeCheckTimeoutId = null;
            }
            if (broadcastChannel) {
                try { broadcastChannel.close(); } catch { /* ignore */ }
                broadcastChannel = null;
            }
        };

        const timeoutId = setTimeout(() => {
            cleanup();
            if (!settled) {
                settled = true;
                reject(new Error(AUTH_TIMED_OUT_ERROR));
            }
        }, 120000);

        const processPayload = (data: Record<string, unknown>) => {

            const { type, code, state, error } = data;
            if (type !== 'google-auth-callback') return;

            cleanup();

            if (error) {
                settled = true;
                reject(new Error(error as string));
                return;
            }

            if (state !== expectedState) {
                settled = true;
                reject(new Error(AUTH_STATE_MISMATCH_ERROR));
                return;
            }

            settled = true;
            resolve(code as string);
        };

        const checkPopupClosed = () => {
            closeCheckTimeoutId = null;

            if (settled) {
                return;
            }

            try {
                if (!popup.closed) {
                    return;
                }
            } catch {
                // COOP can make popup.closed unreliable after Google navigation.
                // If the browser blocks the check, keep waiting for the callback.
                return;
            }

            cleanup();
            settled = true;
            reject(new Error(AUTH_POPUP_CLOSED_ERROR));
        };

        function schedulePopupClosedCheck() {
            if (settled || closeCheckTimeoutId) {
                return;
            }

            closeCheckTimeoutId = setTimeout(checkPopupClosed, AUTH_POPUP_CLOSE_CHECK_DELAY_MS);
        }

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                schedulePopupClosedCheck();
            }
        }

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (settled) return;
            processPayload(event.data || {});
        };

        window.addEventListener('message', handleMessage);
        window.addEventListener('focus', schedulePopupClosedCheck);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // BroadcastChannel fallback: on mobile browsers, window.opener can be
        // lost after cross-origin Google OAuth redirects, so postMessage never
        // arrives. The AuthCallback page also posts to this channel.
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                broadcastChannel = new BroadcastChannel('google-auth-callback');
                broadcastChannel.onmessage = (event: MessageEvent) => {
                    if (settled) return;
                    processPayload(event.data || {});
                };
            } catch {
                // BroadcastChannel not available; rely on postMessage only
            }
        }
    });
}
