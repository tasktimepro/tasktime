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
import { 
    getStoredSession, storeSession, clearStoredSession, type StoredSession
} from '@/utils/googleAuthStorage';

export interface GoogleUser {
    id: string;
    email: string;
    name?: string;
    picture?: string;
}

interface AuthState {
    isSignedIn: boolean;
    isLoading: boolean;
    user: GoogleUser | null;
    accessToken: string | null;
    sessionId: string | null;
    error: string | null;
    hadPreviousSession: boolean;
}

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

const notifyAuthSubscribers = () => {
    authSubscribers.forEach(subscriber => {
        try {
            subscriber();
        } catch (error) {
            console.error('Auth subscriber error:', error);
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
        return error;
    }

    return new Error('Sign in failed');
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

    const validateWorkerSession = useCallback(async (session: StoredSession): Promise<boolean> => {

        if (!isOnline()) {
            return false;
        }

        try {
            const response = await fetch(SYNC_WORKER_CONFIG.endpoints.authStatus, {
                method: 'GET',
                headers: { 'X-Session-Id': session.sessionId },
            });
            if (!response.ok) return false;
            const data = await response.json();

            return data.authenticated === true;
        } catch {
            return false;
        }
    }, [isOnline]);


    const signInWithWorker = useCallback(async (): Promise<void> => {

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        let popup: Window | null = null;

        try {
            popup = openPendingAuthPopup();

            // 1. Get auth URL from Worker
            const initResponse = await fetch(SYNC_WORKER_CONFIG.endpoints.authInit, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    redirectUri: `${window.location.origin}/auth/callback`,
                }),
            });

            if (!initResponse.ok) throw new Error('Failed to initialize auth flow');

            const { authUrl, state: authState } = await initResponse.json();
            sessionStorage.setItem('google_auth_state', authState);

            // 2. Navigate the already-open popup to preserve the user gesture on mobile browsers
            navigateAuthPopup(popup, authUrl);

            // 3. Wait for callback
            const code = await waitForAuthCallback(popup, authState);

            // 4. Exchange code for session via Worker
            const callbackResponse = await fetch(SYNC_WORKER_CONFIG.endpoints.authCallback, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    redirectUri: `${window.location.origin}/auth/callback`,
                }),
            });

            if (!callbackResponse.ok) {
                const error = await callbackResponse.json();
                throw new Error(error.error || 'Authentication failed');
            }

            const { sessionId, user } = await callbackResponse.json();

            const isValid = await validateWorkerSession({
                sessionId,
                userId: user.id,
                email: user.email,
                createdAt: new Date().toISOString(),
            });

            if (!isValid) {
                throw new Error('Google Drive access is not authorized for this session. Please reconnect and allow Drive access.');
            }

            // 5. Store session
            await storeSession({
                sessionId,
                userId: user.id,
                email: user.email,
                createdAt: new Date().toISOString(),
            });

            setState({
                isSignedIn: true,
                isLoading: false,
                user,
                accessToken: null, // Worker mode doesn't expose access token
                sessionId,
                error: null,
                hadPreviousSession: true,
            });

            forceReconnectState = false;
            writeHadPreviousSessionFlag(true);

            notifyAuthSubscribers();

        } catch (error) {
            if (popup && !popup.closed) {
                try {
                    popup.close();
                } catch {
                    // Ignore popup close failures
                }
            }

            const authError = toAuthError(error, SYNC_WORKER_CONFIG.endpoints.authInit);

            setState(prev => ({
                ...prev,
                isLoading: false,
                error: authError.message,
            }));

            throw authError;
        }
    }, [validateWorkerSession]);

    const signOutFromWorker = useCallback(async (options?: { revoke?: boolean }): Promise<void> => {

        const revoke = options?.revoke ?? false;

        if (revoke && state.sessionId) {
            try {
                await fetch(SYNC_WORKER_CONFIG.endpoints.authRevoke, {
                    method: 'POST',
                    headers: { 'X-Session-Id': state.sessionId },
                });
            } catch {
                // Ignore revoke errors
            }
        }

        await clearStoredSession();
        forceReconnectState = false;
        writeHadPreviousSessionFlag(false);

        setState({
            isSignedIn: false,
            isLoading: false,
            user: null,
            accessToken: null,
            sessionId: null,
            error: null,
            hadPreviousSession: false,
        });

        notifyAuthSubscribers();
    }, [state.sessionId]);

    const invalidateStoredSession = useCallback(async (): Promise<void> => {

        forceReconnectState = true;

        try {
            await clearStoredSession();
        } catch {
            // Ignore storage cleanup failures and still move UI into reconnect state.
        }

        writeHadPreviousSessionFlag(true);

        setState({
            isSignedIn: false,
            isLoading: false,
            user: null,
            accessToken: null,
            sessionId: null,
            error: null,
            hadPreviousSession: true,
        });

        notifyAuthSubscribers();
    }, []);

    // ============================================
    // RESTORE SESSION FROM STORAGE
    // ============================================

    const syncFromStorage = useCallback(async () => {

        if (!SYNC_WORKER_CONFIG.isEnabled) {
            console.error('[useGoogleAuth] Worker URL not configured');
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Sync Worker not configured',
                hadPreviousSession: readHadPreviousSessionFlag(),
            }));
            return;
        }

        if (forceReconnectState) {
            setState({
                isSignedIn: false,
                isLoading: false,
                user: null,
                accessToken: null,
                sessionId: null,
                error: null,
                hadPreviousSession: true,
            });
            return;
        }

        const session = await getStoredSession();
        if (session) {
            writeHadPreviousSessionFlag(true);

            if (!isOnline()) {
                setState({
                    isSignedIn: true,
                    isLoading: false,
                    user: { id: session.userId, email: session.email },
                    accessToken: null,
                    sessionId: session.sessionId,
                    error: null,
                    hadPreviousSession: true,
                });
                return;
            }

            const isValid = await validateWorkerSession(session);
            if (isValid) {
                forceReconnectState = false;
                setState({
                    isSignedIn: true,
                    isLoading: false,
                    user: { id: session.userId, email: session.email },
                    accessToken: null,
                    sessionId: session.sessionId,
                    error: null,
                    hadPreviousSession: true,
                });
                return;
            }
            await clearStoredSession();
            setState(prev => ({
                ...prev,
                isSignedIn: false,
                isLoading: false,
                user: null,
                accessToken: null,
                sessionId: null,
                error: null,
                hadPreviousSession: true,
            }));
            return;
        }
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

    return {
        ...state,
        signIn: signInWithWorker,
        signOut: () => signOutFromWorker({ revoke: false }),
        revokeAccess: () => signOutFromWorker({ revoke: true }),
        invalidateSession: invalidateStoredSession,
    };
};

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
        const message = popupDocument.createElement('p');

        popupDocument.documentElement.lang = 'en';

        viewport.setAttribute('name', 'viewport');
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');

        title.textContent = 'Connecting Google Drive...';

        style.textContent = `
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

            p {
                margin: 0;
                padding: 24px;
                text-align: center;
            }
        `;

        message.textContent = 'Opening Google sign-in...';

        popupDocument.head.replaceChildren(viewport, title, style);
        popupDocument.body.replaceChildren(message);
    } catch {
        // Ignore cross-browser document access failures for blank popups.
    }
}

function resolvePendingAuthPopupTheme(): { background: string; foreground: string } {

    const darkModeActive = document.documentElement.classList.contains('dark');
    const sourceElement = document.body ?? document.documentElement;
    const sourceStyles = window.getComputedStyle(sourceElement);
    const background = sourceStyles.backgroundColor;
    const foreground = sourceStyles.color;

    if (background && foreground) {
        return { background, foreground };
    }

    if (darkModeActive) {
        return {
            background: 'rgb(10, 10, 10)',
            foreground: 'rgb(250, 250, 250)',
        };
    }

    return {
        background: 'rgb(254, 254, 254)',
        foreground: 'rgb(10, 10, 10)',
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
        const closedCheckId = window.setInterval(() => {
            if (popup.closed && !settled) {
                cleanup();
                settled = true;
                reject(new Error('Authentication popup was closed before sign-in completed.'));
            }
        }, 500);

        const cleanup = () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(timeoutId);
            window.clearInterval(closedCheckId);
        };

        const timeoutId = setTimeout(() => {
            cleanup();
            if (!settled) {
                settled = true;
                reject(new Error('Authentication timed out. Please try again.'));
            }
        }, 120000);

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;

            const { type, code, state, error } = event.data || {};
            if (type !== 'google-auth-callback') return;

            cleanup();

            if (error) {
                settled = true;
                reject(new Error(error));
                return;
            }

            if (state !== expectedState) {
                settled = true;
                reject(new Error('Invalid auth state - possible CSRF attack'));
                return;
            }

            settled = true;
            resolve(code);
        };

        window.addEventListener('message', handleMessage);
    });
}
