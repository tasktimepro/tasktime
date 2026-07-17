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
    clearLegacyStoredToken: vi.fn(async () => undefined),
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
        vi.unstubAllGlobals()
        document.documentElement.classList.remove('dark')
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

    it('keeps a stored session when auth status is temporarily rate limited', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-rate-limited',
            userId: 'user-rate-limited',
            email: 'rate-limited@example.com',
            createdAt: new Date().toISOString(),
        })
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 429,
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(result.current.sessionId).toBe('session-rate-limited')
        expect(clearStoredSession).not.toHaveBeenCalled()
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

    it('retains a supported direct transport policy as metadata without exposing an access token', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-direct-policy',
            userId: 'user-direct-policy',
            email: 'direct-policy@example.com',
            createdAt: new Date().toISOString(),
        })
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                authenticated: true,
                driveTransport: 'direct',
                transportPolicyVersion: 1,
            }),
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(result.current.driveTransport).toBe('direct')
        expect(result.current.accessToken).toBeNull()
    })

    it('force-refreshes a direct policy and switches the next connection to proxy without clearing the session', async () => {
        const storedSession = {
            sessionId: 'session-policy-rollback',
            userId: 'user-policy-rollback',
            email: 'policy-rollback@example.com',
            createdAt: new Date().toISOString(),
        }
        getStoredSession.mockResolvedValue(storedSession)
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    authenticated: true,
                    driveTransport: 'direct',
                    transportPolicyVersion: 1,
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    authenticated: true,
                    driveTransport: 'proxy',
                    transportPolicyVersion: 1,
                }),
            })

        const { result } = renderHook(() => useGoogleAuth())
        await waitFor(() => expect(result.current.driveTransport).toBe('direct'))

        await act(async () => {
            await expect(result.current.refreshDriveTransport()).resolves.toBe('proxy')
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(result.current.sessionId).toBe(storedSession.sessionId)
        expect(result.current.driveTransport).toBe('proxy')
        expect(clearStoredSession).not.toHaveBeenCalled()
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it.each([
        { driveTransport: 'proxy', transportPolicyVersion: 1 },
        { driveTransport: 'direct', transportPolicyVersion: 2 },
        { driveTransport: 'direct' },
        { driveTransport: 'unsupported', transportPolicyVersion: 1 },
        {},
    ])('fails closed to proxy for unsupported status policy %#', async (status) => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-policy-fallback',
            userId: 'user-policy-fallback',
            email: 'policy-fallback@example.com',
            createdAt: new Date().toISOString(),
        })
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ authenticated: true, ...status }),
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(result.current.driveTransport).toBe('proxy')
        expect(result.current.accessToken).toBeNull()
    })

    it('restores a stored session offline without calling the Worker', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-offline',
            userId: 'user-offline',
            email: 'offline@example.com',
            createdAt: new Date().toISOString(),
        })
        vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(true)
        expect(result.current.sessionId).toBe('session-offline')
        expect(fetch).not.toHaveBeenCalled()
    })

    it('preserves the local session and reports a retryable revoke failure truthfully', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-revoke-retry',
            userId: 'user-revoke-retry',
            email: 'revoke-retry@example.com',
            createdAt: new Date().toISOString(),
        })
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ authenticated: true }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 503,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({
                    error: 'Token service unavailable',
                    code: 'TOKEN_SERVICE_UNAVAILABLE',
                }),
                text: async () => '',
            })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isSignedIn).toBe(true)
        })

        let revokeError
        await act(async () => {
            try {
                await result.current.revokeAccess()
            } catch (error) {
                revokeError = error
            }
        })

        expect(revokeError).toBeInstanceOf(Error)
        expect(revokeError.message).toBe('Token service unavailable')
        expect(result.current.isSignedIn).toBe(true)
        expect(result.current.sessionId).toBe('session-revoke-retry')
        expect(clearStoredSession).not.toHaveBeenCalled()
    })

    it('clears the local session after Worker-confirmed Google revocation', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-revoke-success',
            userId: 'user-revoke-success',
            email: 'revoke-success@example.com',
            createdAt: new Date().toISOString(),
        })
        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ authenticated: true }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => ({ success: true }),
            })
        clearStoredSession.mockImplementationOnce(async () => {
            getStoredSession.mockResolvedValue(null)
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isSignedIn).toBe(true)
        })

        await act(async () => {
            await result.current.revokeAccess()
        })

        expect(result.current.isSignedIn).toBe(false)
        expect(result.current.sessionId).toBeNull()
        expect(clearStoredSession).toHaveBeenCalledTimes(1)
    })

    it('keeps local disconnect separate from Google-grant revocation', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-local-disconnect',
            userId: 'user-local-disconnect',
            email: 'local-disconnect@example.com',
            createdAt: new Date().toISOString(),
        })
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ authenticated: true }),
        })
        clearStoredSession.mockImplementationOnce(async () => {
            getStoredSession.mockResolvedValue(null)
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isSignedIn).toBe(true)
        })

        await act(async () => {
            await result.current.signOut()
        })

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(clearStoredSession).toHaveBeenCalledTimes(1)
        expect(result.current.isSignedIn).toBe(false)
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

    it('retries transient auth init HTTP responses through the final configured delay', async () => {
        getStoredSession.mockResolvedValue(null)

        const popup = createPopupStub()
        window.open.mockImplementation(() => popup)
        fetch
            .mockResolvedValueOnce({ ok: false, status: 503 })
            .mockResolvedValueOnce({ ok: false, status: 408 })
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
                    sessionId: 'session-http-retry',
                    user: {
                        id: 'user-http-retry',
                        email: 'http-retry@example.com',
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
            await vi.advanceTimersByTimeAsync(500)
        })

        expect(popup.document.body.textContent).toContain('Retrying Google Drive connection')

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500)
            await Promise.resolve()
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
        expect(fetch).toHaveBeenCalledTimes(5)
    })

    it('surfaces a non-JSON auth init error body without retrying it', async () => {
        getStoredSession.mockResolvedValue(null)
        fetch.mockResolvedValueOnce(new Response('Worker maintenance', {
            status: 400,
            headers: { 'Content-Type': 'text/plain' },
        }))

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        let signInError
        await act(async () => {
            try {
                await result.current.signIn()
            } catch (error) {
                signInError = error
            }
        })

        expect(signInError).toBeInstanceOf(Error)
        expect(signInError.message).toBe('Worker maintenance')
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('uses the dark fallback palette when popup computed colors are unavailable', async () => {
        getStoredSession.mockResolvedValue(null)
        const popup = createPopupStub()
        window.open.mockImplementation(() => popup)
        document.documentElement.classList.add('dark')
        vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            backgroundColor: '',
            color: '',
        })
        fetch.mockResolvedValueOnce(new Response('', { status: 400 }))

        const { result } = renderHook(() => useGoogleAuth())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        await act(async () => {
            await result.current.signIn().catch(() => undefined)
        })

        expect(popup.document.head.textContent).toContain('color-scheme: dark')
        expect(popup.document.head.textContent).toContain('rgb(10, 10, 10)')
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

    it('does not hide auth init network failures just because a stored session appears later', async () => {
        getStoredSession
            .mockResolvedValueOnce(null)
            .mockResolvedValue({
                sessionId: 'session-existing',
                userId: 'user-existing',
                email: 'existing@example.com',
                createdAt: new Date().toISOString(),
            })
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
        expect(result.current.isSignedIn).toBe(false)
        expect(result.current.error).toBe('Unable to reach the Google Drive sync service at https://worker.example. Check VITE_SYNC_WORKER_URL and any local DNS or hosts overrides, then try again.')
        expect(getStoredSession).toHaveBeenCalledTimes(1)
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

    it('rejects an OAuth callback error while ignoring unrelated messages and an unavailable broadcast channel', async () => {
        getStoredSession.mockResolvedValue(null)
        const popup = createPopupStub()
        window.open.mockImplementation(() => popup)
        vi.stubGlobal('BroadcastChannel', class {
            constructor() {
                throw new Error('BroadcastChannel unavailable')
            }
        })
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                state: 'oauth-state',
            }),
        })

        const { result } = renderHook(() => useGoogleAuth())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        let signInError
        act(() => {
            void result.current.signIn().catch(error => {
                signInError = error
            })
        })

        await waitFor(() => {
            expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/v2/auth')
        })

        act(() => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: 'https://untrusted.example',
                data: { type: 'google-auth-callback', error: 'ignored' },
            }))
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                data: { type: 'unrelated-message' },
            }))
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                data: { type: 'google-auth-callback', error: 'Google access denied' },
            }))
        })

        await waitFor(() => {
            expect(signInError).toBeInstanceOf(Error)
        })

        expect(signInError.message).toBe('Google access denied')
        expect(result.current.isSignedIn).toBe(false)
    })

    it('rejects sign-in when the Worker callback session lacks Drive authorization', async () => {
        getStoredSession.mockResolvedValue(null)
        const popup = createPopupStub()
        window.open.mockImplementation(() => popup)
        fetch
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
                    sessionId: 'session-no-drive',
                    user: {
                        id: 'user-no-drive',
                        email: 'no-drive@example.com',
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ authenticated: false }),
            })

        const { result } = renderHook(() => useGoogleAuth())
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        let signInError
        act(() => {
            void result.current.signIn().catch(error => {
                signInError = error
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
                    code: 'auth-code',
                    state: 'oauth-state',
                },
            }))
        })

        await waitFor(() => {
            expect(signInError).toBeInstanceOf(Error)
        })

        expect(signInError.message).toContain('Drive access is not authorized')
        expect(result.current.isSignedIn).toBe(false)
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

    it('releases the connect loading state when the auth popup is closed after Google navigation', async () => {
        getStoredSession.mockResolvedValue(null)

        const popup = createPopupStub()
        window.open.mockImplementation(() => popup)

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                state: 'oauth-state',
            }),
        })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        vi.useFakeTimers()

        let thrownError
        let signInPromise

        act(() => {
            signInPromise = result.current.signIn().catch(error => {
                thrownError = error
            })
        })

        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })

        expect(popup.location.href).toBe('https://accounts.google.com/o/oauth2/v2/auth')

        popup.closed = true

        act(() => {
            window.dispatchEvent(new Event('focus'))
        })

        await act(async () => {
            await vi.advanceTimersByTimeAsync(250)
            await signInPromise
        })

        expect(thrownError).toBeInstanceOf(Error)
        expect(thrownError.message).toBe('Authentication popup was closed before sign-in completed.')
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBe('Authentication popup was closed before sign-in completed.')
        expect(captureDebugBundleIncidentSpy).not.toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'auth.sign_in_failed',
        }))
    })

    it('shows a friendly retry message when the auth callback state does not match', async () => {
        getStoredSession.mockResolvedValue(null)

        const popup = createPopupStub()
        window.open.mockImplementation(() => popup)

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                state: 'oauth-state',
            }),
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
                    code: 'auth-code',
                    state: 'old-oauth-state',
                },
            }))
        })

        await waitFor(() => {
            expect(thrownError).toBeInstanceOf(Error)
        })

        expect(thrownError.message).toBe('Google sign-in could not be completed because the session no longer matched. Please try connecting again.')
        expect(result.current.error).toBe('Google sign-in could not be completed because the session no longer matched. Please try connecting again.')
        expect(captureDebugBundleIncidentSpy).not.toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'auth.sign_in_failed',
        }))
    })

    it('does not surface a stale callback state error when another auth flow already stored a valid session', async () => {
        getStoredSession
            .mockResolvedValueOnce(null)
            .mockResolvedValue({
                sessionId: 'session-existing',
                userId: 'user-existing',
                email: 'existing@example.com',
                createdAt: new Date().toISOString(),
            })

        const popup = createPopupStub()
        window.open.mockImplementation(() => popup)

        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                    state: 'oauth-state',
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

        let thrownError
        let signInPromise

        act(() => {
            signInPromise = result.current.signIn().catch(error => {
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
                    code: 'auth-code',
                    state: 'old-oauth-state',
                },
            }))
        })

        await act(async () => {
            await signInPromise
        })

        expect(thrownError).toBeUndefined()
        expect(result.current.isSignedIn).toBe(true)
        expect(result.current.sessionId).toBe('session-existing')
        expect(result.current.user?.email).toBe('existing@example.com')
        expect(result.current.error).toBeNull()
        expect(captureDebugBundleIncidentSpy).not.toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'auth.sign_in_failed',
        }))
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

    it('shares one auth-status validation across simultaneous hook consumers', async () => {
        const storedSession = {
            sessionId: 'session-concurrent-validation',
            userId: 'user-concurrent-validation',
            email: 'concurrent-validation@example.com',
            createdAt: new Date().toISOString(),
        }
        let resolveStatus

        getStoredSession.mockResolvedValue(storedSession)
        fetch.mockImplementation(() => new Promise((resolve) => {
            resolveStatus = resolve
        }))

        const { result } = renderHook(() => [useGoogleAuth(), useGoogleAuth()])

        await waitFor(() => {
            expect(getStoredSession).toHaveBeenCalledTimes(2)
            expect(fetch).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            resolveStatus({
                ok: true,
                json: async () => ({
                    authenticated: true,
                    driveTransport: 'direct',
                    transportPolicyVersion: 1,
                }),
            })
        })

        await waitFor(() => {
            expect(result.current[0].isLoading).toBe(false)
            expect(result.current[1].isLoading).toBe(false)
        })
        expect(result.current[0].driveTransport).toBe('direct')
        expect(result.current[1].driveTransport).toBe('direct')
        expect(fetch).toHaveBeenCalledTimes(1)
    })
})
