/// <reference path="../types/google-identity.d.ts" />

/**
 * Unified Google Auth hook
 * 
 * When VITE_SYNC_WORKER_URL is set:
 *   - Uses Cloudflare Worker for OAuth and token management
 *   - Refresh tokens stored server-side (persistent across browser restarts)
 *   - No client-side token refresh scheduling needed
 * 
 * When VITE_SYNC_WORKER_URL is NOT set:
 *   - Falls back to direct SPA auth via Google Identity Services
 *   - Tokens stored in IndexedDB (lost on token expiry if user is away)
 */

import { useState, useEffect, useCallback } from 'react';
import { GOOGLE_CONFIG, SYNC_WORKER_CONFIG } from '@/config/google';
import { 
    getStoredToken, storeToken, clearStoredToken, isTokenExpired,
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

// Check if Worker mode is enabled
const USE_WORKER = Boolean(SYNC_WORKER_CONFIG.workerUrl);

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

    const signOutFromWorker = useCallback(async (): Promise<void> => {

        if (state.sessionId) {
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
    // SPA MODE - Direct Google Identity Services (fallback)
    // ============================================

    const validateSpaToken = useCallback(async (accessToken: string): Promise<GoogleUser | null> => {

        try {
            const response = await fetch(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!response.ok) return null;
            const data = await response.json();
            return { id: data.sub, email: data.email, name: data.name, picture: data.picture };
        } catch {
            return null;
        }
    }, []);

    const syncFromStorage = useCallback(async () => {

        if (USE_WORKER) {
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

        } else {
            const storedToken = await getStoredToken();
            if (storedToken && !isTokenExpired(storedToken)) {
                const user = await validateSpaToken(storedToken.accessToken);
                if (user) {
                    setState({
                        isSignedIn: true,
                        isLoading: false,
                        user,
                        accessToken: storedToken.accessToken,
                        sessionId: null,
                        error: null,
                    });
                    return;
                }
                await clearStoredToken();
            }
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [validateWorkerSession, validateSpaToken]);

    const signInWithSpa = useCallback(async (): Promise<void> => {

        return new Promise((resolve, reject) => {

            if (!GOOGLE_CONFIG.clientId) {
                setState(prev => ({ ...prev, error: 'Missing Google client ID' }));
                reject(new Error('Missing Google client ID'));
                return;
            }

            if (!window.google?.accounts?.oauth2) {
                setState(prev => ({ ...prev, error: 'Google Identity Services not loaded' }));
                reject(new Error('Google Identity Services not loaded'));
                return;
            }

            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CONFIG.clientId,
                scope: GOOGLE_CONFIG.scopes,
                callback: async (response) => {

                    if (response.error) {
                        setState(prev => ({ ...prev, error: response.error_description || response.error }));
                        reject(new Error(response.error));
                        return;
                    }

                    const expiresAt = Date.now() + (response.expires_in * 1000);
                    await storeToken({ accessToken: response.access_token, expiresAt, scope: response.scope });

                    const user = await validateSpaToken(response.access_token);
                    if (!user) {
                        setState(prev => ({ ...prev, error: 'Failed to get user info' }));
                        reject(new Error('Failed to get user info'));
                        return;
                    }

                    setState({
                        isSignedIn: true,
                        isLoading: false,
                        user,
                        accessToken: response.access_token,
                        sessionId: null,
                        error: null,
                    });
                    notifyAuthSubscribers();
                    resolve();
                },
            });

            client.requestAccessToken();
        });
    }, [validateSpaToken]);

    const signOutFromSpa = useCallback(async (): Promise<void> => {

        if (state.accessToken && window.google?.accounts?.oauth2) {
            window.google.accounts.oauth2.revoke(state.accessToken, () => undefined);
        }

        await clearStoredToken();

        setState({
            isSignedIn: false,
            isLoading: false,
            user: null,
            accessToken: null,
            sessionId: null,
            error: null,
        });

        notifyAuthSubscribers();
    }, [state.accessToken]);

    // ============================================
    // INITIALIZATION
    // ============================================

    useEffect(() => {

        // For SPA mode, wait for Google Identity Services to load
        if (!USE_WORKER && !window.google?.accounts?.oauth2) {
            const checkGoogle = setInterval(() => {
                if (window.google?.accounts?.oauth2) {
                    clearInterval(checkGoogle);
                    syncFromStorage();
                }
            }, 100);

            const timeout = setTimeout(() => {
                clearInterval(checkGoogle);
                setState(prev => ({ ...prev, isLoading: false }));
            }, 2000);

            return () => {
                clearInterval(checkGoogle);
                clearTimeout(timeout);
            };
        }

        syncFromStorage();

        const handleExternalAuthChange = () => {
            syncFromStorage();
        };

        authSubscribers.add(handleExternalAuthChange);

        return () => {
            authSubscribers.delete(handleExternalAuthChange);
        };

    }, [syncFromStorage]);

    // ============================================
    // UNIFIED API
    // ============================================

    const signIn = USE_WORKER ? signInWithWorker : signInWithSpa;
    const signOut = USE_WORKER ? signOutFromWorker : signOutFromSpa;

    return {
        ...state,
        signIn,
        signOut,
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
