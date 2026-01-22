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
}

// Verify Worker mode is enabled
if (!SYNC_WORKER_CONFIG.isEnabled) {
    console.error('[useGoogleAuth] VITE_SYNC_WORKER_URL not configured - Google Drive sync will not work');
}

// Simple pub/sub so multiple hook instances stay in sync without reloads
const authSubscribers = new Set<() => void>();
const notifyAuthSubscribers = () => {
    authSubscribers.forEach(subscriber => {
        try {
            subscriber();
        } catch (error) {
            console.error('Auth subscriber error:', error);
        }
    });
};

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
    });

    // ============================================
    // WORKER MODE - Cloudflare Worker handles tokens
    // ============================================

    const validateWorkerSession = useCallback(async (session: StoredSession): Promise<boolean> => {

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
    }, []);


    const signInWithWorker = useCallback(async (): Promise<void> => {

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
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

            // 2. Open popup for OAuth
            const popup = openAuthPopup(authUrl);

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
            });

            notifyAuthSubscribers();

        } catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Sign in failed',
            }));
        }
    }, []);

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

        setState({
            isSignedIn: false,
            isLoading: false,
            user: null,
            accessToken: null,
            sessionId: null,
            error: null,
        });

        notifyAuthSubscribers();
    }, [state.sessionId]);

    // ============================================
    // RESTORE SESSION FROM STORAGE
    // ============================================

    const syncFromStorage = useCallback(async () => {

        if (!SYNC_WORKER_CONFIG.isEnabled) {
            console.error('[useGoogleAuth] Worker URL not configured');
            setState(prev => ({ ...prev, isLoading: false, error: 'Sync Worker not configured' }));
            return;
        }

        const session = await getStoredSession();
        if (session) {
            const isValid = await validateWorkerSession(session);
            if (isValid) {
                setState({
                    isSignedIn: true,
                    isLoading: false,
                    user: { id: session.userId, email: session.email },
                    accessToken: null,
                    sessionId: session.sessionId,
                    error: null,
                });
                return;
            }
            await clearStoredSession();
        }
        setState(prev => ({ ...prev, isLoading: false }));
    }, [validateWorkerSession]);

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

    return {
        ...state,
        signIn: signInWithWorker,
        signOut: () => signOutFromWorker({ revoke: false }),
        revokeAccess: () => signOutFromWorker({ revoke: true }),
    };
};

// ============================================
// HELPER FUNCTIONS (for Worker OAuth popup flow)
// ============================================

function openAuthPopup(url: string): Window {

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(url, 'google-auth', `width=${width},height=${height},left=${left},top=${top},popup=1`);

    if (!popup) {
        throw new Error('Failed to open auth popup. Check popup blocker settings.');
    }

    return popup;
}

function waitForAuthCallback(popup: Window, expectedState: string): Promise<string> {

    return new Promise((resolve, reject) => {

        let settled = false;

        const cleanup = () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(timeoutId);
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
