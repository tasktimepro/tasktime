import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGoogleAuth } from './useGoogleAuth'
import { getStoredSession, clearStoredSession } from '@/utils/googleAuthStorage'

vi.mock('@/config/google', () => ({
    SYNC_WORKER_CONFIG: {
        isEnabled: true,
        endpoints: {
            authInit: 'https://worker.example/auth/init',
            authCallback: 'https://worker.example/auth/callback',
            authRevoke: 'https://worker.example/auth/revoke',
            authStatus: 'https://worker.example/auth/status',
            drive: 'https://worker.example/drive',
        },
    },
}))

vi.mock('@/utils/googleAuthStorage', () => ({
    getStoredSession: vi.fn(),
    storeSession: vi.fn(),
    clearStoredSession: vi.fn(),
}))

function createPopupStub() {
    const popupDocument = document.implementation.createHTMLDocument('Connecting Google Drive...')

    return {
        closed: false,
        close: vi.fn(),
        focus: vi.fn(),
        location: { href: '' },
        document: popupDocument,
    }
}

describe('useGoogleAuth', () => {

    beforeEach(() => {
        vi.restoreAllMocks()
        vi.clearAllMocks()
        window.sessionStorage.clear()
        vi.stubGlobal('fetch', vi.fn())
        vi.spyOn(window, 'open').mockImplementation(() => createPopupStub())
    })

    it('clears stored session when auth status passes but Drive access is denied', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-123',
            userId: 'user-1',
            email: 'user@example.com',
            createdAt: new Date().toISOString(),
        })

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ authenticated: false, error: 'DRIVE_ACCESS_DENIED' }),
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(false)
        expect(result.current.hadPreviousSession).toBe(true)
        expect(clearStoredSession).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('keeps hadPreviousSession true after an invalid stored session is cleared and auth re-checks run again', async () => {
        getStoredSession
            .mockResolvedValueOnce({
                sessionId: 'session-123',
                userId: 'user-1',
                email: 'user@example.com',
                createdAt: new Date().toISOString(),
            })
            .mockResolvedValue(null)

        fetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ authenticated: false }),
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.hadPreviousSession).toBe(true)

        act(() => {
            window.dispatchEvent(new Event('online'))
        })

        await waitFor(() => {
            expect(getStoredSession).toHaveBeenCalledTimes(2)
        })

        expect(result.current.hadPreviousSession).toBe(true)
    })

    it('restores signed-in state when session and Drive access are valid', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-456',
            userId: 'user-2',
            email: 'valid@example.com',
            createdAt: new Date().toISOString(),
        })

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ authenticated: true }),
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(result.current.sessionId).toBe('session-456')
        expect(result.current.user?.email).toBe('valid@example.com')
        expect(clearStoredSession).not.toHaveBeenCalled()
    })

    it('returns an actionable error when the sync worker is unreachable during sign-in', async () => {
        getStoredSession.mockResolvedValue(null)
        fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        let thrownError

        await act(async () => {
            try {
                await result.current.signIn()
            } catch (error) {
                thrownError = error
            }
        })

        expect(thrownError).toBeInstanceOf(Error)
        expect(thrownError.message).toBe('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.')
        expect(result.current.error).toBe('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.')
    })

    it('surfaces worker callback details when the auth exchange fails', async () => {
        getStoredSession.mockResolvedValue(null)

        const popup = createPopupStub()

        window.open.mockImplementation(() => popup)

        fetch.mockImplementation(async (input) => {
            if (input === 'https://worker.example/auth/init') {
                return {
                    ok: true,
                    json: async () => ({
                        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                        state: 'oauth-state',
                    }),
                }
            }

            if (input === 'https://worker.example/auth/callback') {
                return {
                    ok: false,
                    headers: {
                        get: (name) => name === 'Content-Type' ? 'application/json' : null,
                    },
                    json: async () => ({
                        error: 'Authentication failed',
                        details: 'Token exchange failed: {"error":"invalid_grant"}',
                    }),
                    text: async () => '',
                }
            }

            throw new Error(`Unexpected fetch: ${String(input)}`)
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        let thrownError

        act(() => {
            void result.current.signIn().catch(error => {
                thrownError = error
            })
        })

        await waitFor(() => {
            expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/v2/auth')
        })

        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                data: {
                    type: 'google-auth-callback',
                    code: 'bad-auth-code',
                    state: 'oauth-state',
                },
            }))
        })

        await waitFor(() => {
            expect(thrownError).toBeInstanceOf(Error)
        })

        expect(thrownError.message).toBe('Token exchange failed: {"error":"invalid_grant"}')
        expect(result.current.error).toBe('Token exchange failed: {"error":"invalid_grant"}')
    })

    it('shows a friendly message when the sync service hits the daily sign-in limit', async () => {
        getStoredSession.mockResolvedValue(null)

        const popup = createPopupStub()

        window.open.mockImplementation(() => popup)

        fetch.mockImplementation(async (input) => {
            if (input === 'https://worker.example/auth/init') {
                return {
                    ok: true,
                    json: async () => ({
                        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                        state: 'oauth-state',
                    }),
                }
            }

            if (input === 'https://worker.example/auth/callback') {
                return {
                    ok: false,
                    headers: {
                        get: (name) => name === 'Content-Type' ? 'application/json' : null,
                    },
                    json: async () => ({
                        error: 'Authentication failed',
                        details: 'Error: KV put() limit exceeded for the day',
                    }),
                    text: async () => '',
                }
            }

            throw new Error(`Unexpected fetch: ${String(input)}`)
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        let thrownError

        act(() => {
            void result.current.signIn().catch(error => {
                thrownError = error
            })
        })

        await waitFor(() => {
            expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/v2/auth')
        })

        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                data: {
                    type: 'google-auth-callback',
                    code: 'quota-hit-code',
                    state: 'oauth-state',
                },
            }))
        })

        await waitFor(() => {
            expect(thrownError).toBeInstanceOf(Error)
        })

        expect(thrownError.message).toBe('Google Drive sign-in is temporarily unavailable because the sync service reached its daily sign-in limit. Please try again tomorrow.')
        expect(result.current.error).toBe('Google Drive sign-in is temporarily unavailable because the sync service reached its daily sign-in limit. Please try again tomorrow.')
    })

    it('opens the auth popup before initializing the auth request so mobile browsers keep the user gesture', async () => {
        getStoredSession.mockResolvedValue(null)

        const callOrder = []
        const popup = createPopupStub()

        window.open.mockImplementation(() => {
            callOrder.push('open')
            return popup
        })

        fetch.mockImplementation(async (input) => {
            if (input === 'https://worker.example/auth/init') {
                callOrder.push('authInit')
                return {
                    ok: true,
                    json: async () => ({
                        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                        state: 'oauth-state',
                    }),
                }
            }

            if (input === 'https://worker.example/auth/callback') {
                return {
                    ok: true,
                    json: async () => ({
                        sessionId: 'session-789',
                        user: {
                            id: 'user-789',
                            email: 'mobile@example.com',
                        },
                    }),
                }
            }

            if (input === 'https://worker.example/auth/status') {
                return {
                    ok: true,
                    json: async () => ({ authenticated: true }),
                }
            }

            throw new Error(`Unexpected fetch: ${String(input)}`)
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        let signInPromise

        act(() => {
            signInPromise = result.current.signIn()
        })

        expect(callOrder).toEqual(['open', 'authInit'])

        await waitFor(() => {
            expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/v2/auth')
        })

        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                data: {
                    type: 'google-auth-callback',
                    code: 'auth-code',
                    state: 'oauth-state',
                },
            }))
        })

        await act(async () => {
            await signInPromise
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(popup.focus).toHaveBeenCalledTimes(1)
    })

    it('invalidates the local session into reconnect state without revoking access', async () => {
        getStoredSession
            .mockResolvedValueOnce({
                sessionId: 'session-999',
                userId: 'user-999',
                email: 'recover@example.com',
                createdAt: new Date().toISOString(),
            })
            .mockResolvedValue(null)

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ authenticated: true }),
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        await act(async () => {
            await result.current.invalidateSession()
        })

        expect(result.current.isSignedIn).toBe(false)
        expect(result.current.sessionId).toBeNull()
        expect(result.current.hadPreviousSession).toBe(true)
        expect(clearStoredSession).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledTimes(1)
    })
})
