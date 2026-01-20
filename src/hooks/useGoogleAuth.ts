/// <reference path="../types/google-identity.d.ts" />

import { useState, useEffect, useCallback, useRef } from 'react';
import { GOOGLE_CONFIG } from '@/config/google';
import { getStoredToken, storeToken, clearStoredToken, isTokenExpired, getTokenTimeRemaining } from '@/utils/googleAuthStorage';

export interface GoogleUser {
    id: string;
    email: string;
    name: string;
    picture: string;
}

interface AuthState {
    isSignedIn: boolean;
    isLoading: boolean;
    user: GoogleUser | null;
    accessToken: string | null;
    error: string | null;
}

// Refresh token 5 minutes before expiry
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

export const useGoogleAuth = () => {

    const [state, setState] = useState<AuthState>({
        isSignedIn: false,
        isLoading: true,
        user: null,
        accessToken: null,
        error: null,
    });

    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearRefreshTimer = useCallback(() => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
    }, []);

    // Silent token refresh - uses prompt: '' to avoid user interaction
    const refreshTokenSilently = useCallback((): Promise<void> => {

        return new Promise((resolve, reject) => {

            if (!window.google?.accounts?.oauth2 || !GOOGLE_CONFIG.clientId) {
                reject(new Error('Google Identity Services not available'));
                return;
            }

            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CONFIG.clientId,
                scope: GOOGLE_CONFIG.scopes,
                prompt: '', // Empty string = silent refresh without user interaction
                callback: async (response) => {

                    if (response.error) {
                        console.warn('Silent token refresh failed:', response.error);
                        // Don't sign out - token might still be valid, just couldn't refresh
                        reject(new Error(response.error));
                        return;
                    }

                    const newExpiresAt = Date.now() + (response.expires_in * 1000);

                    await storeToken({
                        accessToken: response.access_token,
                        expiresAt: newExpiresAt,
                        scope: response.scope,
                    });

                    setState(prev => ({
                        ...prev,
                        accessToken: response.access_token,
                    }));

                    console.log('Google token silently refreshed, expires in', Math.round(response.expires_in / 60), 'minutes');
                    resolve();
                },
            });

            client.requestAccessToken();
        });
    }, []);

    // Schedule a token refresh before it expires
    const scheduleTokenRefresh = useCallback(async () => {

        clearRefreshTimer();

        const storedToken = await getStoredToken();
        if (!storedToken) return;

        const timeRemaining = getTokenTimeRemaining(storedToken);
        const refreshIn = Math.max(0, timeRemaining - REFRESH_BEFORE_EXPIRY_MS);

        // Don't schedule if token is already expired or about to expire
        if (timeRemaining <= REFRESH_BEFORE_EXPIRY_MS) {
            // Token is about to expire, try refreshing now
            try {
                await refreshTokenSilently();
                // Schedule next refresh after successful refresh
                scheduleTokenRefresh();
            } catch {
                console.warn('Token refresh failed, user may need to re-authenticate');
            }
            return;
        }

        console.log('Token refresh scheduled in', Math.round(refreshIn / 60000), 'minutes');

        refreshTimerRef.current = setTimeout(async () => {

            try {
                await refreshTokenSilently();
                // Schedule next refresh after successful refresh
                scheduleTokenRefresh();
            } catch {
                console.warn('Scheduled token refresh failed');
            }
        }, refreshIn);
    }, [clearRefreshTimer, refreshTokenSilently]);

    const validateAndSetToken = useCallback(async (accessToken: string) => {

        try {

            const userInfo = await fetchUserInfo(accessToken);

            setState({
                isSignedIn: true,
                isLoading: false,
                user: userInfo,
                accessToken,
                error: null,
            });

        } catch (error) {

            console.error('Failed to validate Google access token:', error);

            const errorMessage = error instanceof Error ? error.message : 'Token validation failed.';
            const isNetworkError = errorMessage.includes('Network error');

            // Only clear token if it's actually expired/revoked, not for network errors
            if (!isNetworkError) {
                await clearStoredToken();
            }

            setState({
                isSignedIn: false,
                isLoading: false,
                user: null,
                accessToken: null,
                error: isNetworkError
                    ? 'Unable to verify Google account. Check your connection.'
                    : 'Google authorization expired. Reconnect Google Drive.',
            });
        }
    }, []);

    useEffect(() => {

        const initGoogleAuth = async () => {

            const storedToken = await getStoredToken();

            if (storedToken && !isTokenExpired(storedToken)) {

                await validateAndSetToken(storedToken.accessToken);
                // Schedule automatic token refresh
                scheduleTokenRefresh();
                return;
            }

            setState(prevState => ({
                ...prevState,
                isLoading: false,
            }));
        };

        if (window.google?.accounts?.oauth2) {

            initGoogleAuth();
            return;
        }

        const checkGoogle = setInterval(() => {

            if (window.google?.accounts?.oauth2) {

                clearInterval(checkGoogle);
                initGoogleAuth();
            }
        }, 100);

        const loadingTimeout = setTimeout(() => {
            setState(prevState => ({
                ...prevState,
                isLoading: false,
                error: prevState.error || 'Google Identity Services not loaded.'
            }));
        }, 2000);

        return () => {
            clearInterval(checkGoogle);
            clearTimeout(loadingTimeout);
        };
    }, [validateAndSetToken, scheduleTokenRefresh]);

    const signIn = useCallback(async () => {

        return new Promise((resolve, reject) => {

            if (!GOOGLE_CONFIG.clientId) {

                const message = 'Missing Google client ID. Set VITE_GOOGLE_CLIENT_ID.';
                setState(prevState => ({
                    ...prevState,
                    isLoading: false,
                    error: message
                }));
                reject(new Error(message));
                return;
            }

            if (!window.google?.accounts?.oauth2) {

                setState(prevState => ({
                    ...prevState,
                    isLoading: false,
                    error: 'Google Identity Services not loaded.'
                }));
                reject(new Error('Google Identity Services not loaded.'));
                return;
            }

            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CONFIG.clientId,
                scope: GOOGLE_CONFIG.scopes,
                callback: async (response) => {
                    if (response.error) {
                        setState(prevState => ({
                            ...prevState,
                            error: response.error_description || response.error,
                        }));
                        reject(response.error);
                        return;
                    }

                    await storeToken({
                        accessToken: response.access_token,
                        expiresAt: Date.now() + (response.expires_in * 1000),
                        scope: response.scope,
                    });

                    await validateAndSetToken(response.access_token);
                    // Schedule automatic token refresh
                    scheduleTokenRefresh();
                    resolve(response);
                },
            });

            client.requestAccessToken();
        });
    }, [validateAndSetToken, scheduleTokenRefresh]);

    const signOut = useCallback(async () => {

        clearRefreshTimer();

        if (state.accessToken && window.google?.accounts?.oauth2) {

            window.google.accounts.oauth2.revoke(state.accessToken, () => undefined);
        }

        await clearStoredToken();
        setState({
            isSignedIn: false,
            isLoading: false,
            user: null,
            accessToken: null,
            error: null,
        });
    }, [state.accessToken, clearRefreshTimer]);

    // Cleanup refresh timer on unmount
    useEffect(() => {
        return () => clearRefreshTimer();
    }, [clearRefreshTimer]);

    return {
        ...state,
        signIn,
        signOut,
    };
};

const fetchUserInfo = async (accessToken: string): Promise<GoogleUser> => {

    let response: Response;

    try {
        response = await fetch(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
    } catch (networkError) {
        // Network error - don't clear token, just throw
        throw new Error('Network error while validating Google token.');
    }

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Google token expired or revoked.');
        }
        throw new Error(`Failed to fetch Google user info: ${response.status}`);
    }

    const data = await response.json();

    return {
        id: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
    };
};
