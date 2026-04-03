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

        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ authenticated: true }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ error: 'DRIVE_ACCESS_DENIED' }),
            })

        const { result } = renderHook(() => useGoogleAuth())

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.isSignedIn).toBe(false)
        expect(result.current.hadPreviousSession).toBe(true)
        expect(clearStoredSession).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('restores signed-in state when session and Drive access are valid', async () => {
        getStoredSession.mockResolvedValue({
            sessionId: 'session-456',
            userId: 'user-2',
            email: 'valid@example.com',
            createdAt: new Date().toISOString(),
        })

        fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ authenticated: true }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ files: [] }),
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

            if (typeof input === 'string' && input.startsWith('https://worker.example/drive/files')) {
                return {
                    ok: true,
                    json: async () => ({ files: [] }),
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
})
