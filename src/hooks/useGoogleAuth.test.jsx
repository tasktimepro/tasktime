import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGoogleAuth, _resetValidationCache } from './useGoogleAuth'
import { getStoredSession, clearStoredSession } from '@/utils/googleAuthStorage'

const { captureDebugBundleIncidentSpy } = vi.hoisted(() => ({
    captureDebugBundleIncidentSpy: vi.fn(),
}))

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

vi.mock('@/utils/debugbundle', () => ({
    captureDebugBundleIncident: captureDebugBundleIncidentSpy,
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
        _resetValidationCache()
        window.sessionStorage.clear()
        vi.stubGlobal('fetch', vi.fn())
        vi.spyOn(window, 'open').mockImplementation(() => createPopupStub())
    })

    afterEach(() => {
        vi.useRealTimers()
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

    it('retries a transient auth init network failure without requiring another user tap', async () => {
        getStoredSession.mockResolvedValue(null)

        const popup = createPopupStub()
        window.open.mockImplementation(() => popup)

        fetch
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                    state: 'oauth-state',
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    sessionId: 'session-retried',
                    user: {
                        id: 'user-retried',
                        email: 'retry@example.com',
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ authenticated: true }),
            })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        vi.useFakeTimers()

        let signInPromise

        act(() => {
            signInPromise = result.current.signIn()
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(popup.document.body.textContent).toContain('Still connecting Google Drive')

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/v2/auth')

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
        expect(result.current.user?.email).toBe('retry@example.com')
        expect(fetch).toHaveBeenCalledWith('https://worker.example/auth/init', expect.any(Object))
        expect(captureDebugBundleIncidentSpy).not.toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'auth.sign_in_failed',
        }))
    })

    it('returns an actionable error when the sync worker is unreachable after auth init retries', async () => {
        getStoredSession.mockResolvedValue(null)
        fetch.mockRejectedValue(new TypeError('Failed to fetch'))

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        let thrownError
        let signInPromise

        vi.useFakeTimers()

        act(() => {
            signInPromise = result.current.signIn().catch(error => {
                thrownError = error
            })
        })

        await act(async () => {
            await Promise.resolve()
        })

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500)
        })

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500)
        })

        await act(async () => {
            await signInPromise
        })

        expect(thrownError).toBeInstanceOf(Error)
        expect(thrownError.message).toBe('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.')
        expect(result.current.error).toBe('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.')
        expect(fetch).toHaveBeenCalledTimes(3)
        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'auth.sign_in_failed',
            context: expect.objectContaining({
                step: 'auth-init',
                workerOrigin: 'https://worker.example',
            }),
        }))
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

    it('does not read popup.closed after navigating to Google OAuth', async () => {
        getStoredSession.mockResolvedValue(null)

        let closedReadCount = 0
        const popupDocument = document.implementation.createHTMLDocument('Connecting Google Drive...')
        const popup = {
            close: vi.fn(),
            focus: vi.fn(),
            location: { href: '' },
            document: popupDocument,
        }

        Object.defineProperty(popup, 'closed', {
            configurable: true,
            get() {
                closedReadCount += 1

                if (closedReadCount > 1) {
                    throw new Error('popup.closed should not be read after navigation')
                }

                return false
            },
        })

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
                    ok: true,
                    json: async () => ({
                        sessionId: 'session-coop-safe',
                        user: {
                            id: 'user-coop-safe',
                            email: 'coop-safe@example.com',
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

        await waitFor(() => {
            expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/v2/auth')
        })

        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                data: {
                    type: 'google-auth-callback',
                    code: 'coop-safe-code',
                    state: 'oauth-state',
                },
            }))
        })

        await act(async () => {
            await signInPromise
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(closedReadCount).toBe(1)
    })

    it('does not capture a DebugBundle incident when the auth popup is blocked', async () => {
        getStoredSession.mockResolvedValue(null)
        window.open.mockImplementation(() => null)

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
        expect(thrownError.message).toBe('Failed to open auth popup. Check popup blocker settings.')
        expect(captureDebugBundleIncidentSpy).not.toHaveBeenCalled()
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

    it('does not restore a stale signed-in state after invalidateSession runs during session validation', async () => {
        let resolveStatusRequest

        getStoredSession.mockResolvedValue({
            sessionId: 'session-race',
            userId: 'user-race',
            email: 'race@example.com',
            createdAt: new Date().toISOString(),
        })

        fetch.mockImplementationOnce(() => new Promise((resolve) => {
            resolveStatusRequest = resolve
        }))

        const { result } = renderHook(() => useGoogleAuth())

        await act(async () => {
            await result.current.invalidateSession()
        })

        await act(async () => {
            resolveStatusRequest({
                ok: true,
                json: async () => ({ authenticated: true }),
            })
        })

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(false)
        expect(result.current.user).toBeNull()
        expect(result.current.sessionId).toBeNull()
        expect(result.current.hadPreviousSession).toBe(true)
    })

    it('does not re-fetch auth status when remounting within the throttle window', async () => {
        const storedSession = {
            sessionId: 'session-throttle',
            userId: 'user-throttle',
            email: 'throttle@example.com',
            createdAt: new Date().toISOString(),
        }

        getStoredSession.mockResolvedValue(storedSession)

        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ authenticated: true }),
        })

        const { result, unmount } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(fetch).toHaveBeenCalledTimes(1)

        unmount()

        const { result: result2 } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result2.current.isLoading).toBe(false)
        })

        expect(result2.current.isSignedIn).toBe(true)
        expect(fetch).toHaveBeenCalledTimes(1)
    })
})
