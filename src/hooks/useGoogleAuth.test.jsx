import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
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

describe('useGoogleAuth', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('fetch', vi.fn())
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
})
