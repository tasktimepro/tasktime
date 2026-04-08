import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorizationError, ManifestManager } from './ManifestManager.ts'

function jsonResponse(body, init = {}) {
    return new Response(JSON.stringify(body), {
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
        ...init,
    })
}

describe('ManifestManager', () => {
    beforeEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('retries rate-limited Drive requests using Retry-After before succeeding', async () => {
        vi.useFakeTimers()

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('rate limited', {
                status: 429,
                headers: { 'Retry-After': '2' },
            }))
            .mockResolvedValueOnce(jsonResponse({ files: [] }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')
        const promise = manager.listAppDataFiles()

        await vi.advanceTimersByTimeAsync(2_000)

        await expect(promise).resolves.toEqual([])
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries transient network failures with exponential backoff', async () => {
        vi.useFakeTimers()

        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('network down'))
            .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'file-1', name: 'manifest', modifiedTime: '2026-04-07T00:00:00.000Z' }] }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')
        const promise = manager.listAppDataFiles()

        await vi.advanceTimersByTimeAsync(1_000)

        await expect(promise).resolves.toEqual([
            { id: 'file-1', name: 'manifest', modifiedTime: '2026-04-07T00:00:00.000Z' },
        ])
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('maps Drive authorization failures to AuthorizationError messages', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ error: 'insufficient permissions' }, { status: 403 }))
            .mockResolvedValueOnce(jsonResponse({ code: 'SESSION_NOT_FOUND' }, { status: 401 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')

        await expect(manager.listAppDataFiles()).rejects.toEqual(
            expect.objectContaining({
                name: AuthorizationError.name,
                message: 'Google Drive permission is missing for this session. Reconnect and allow Drive access.',
            })
        )

        await expect(manager.listAppDataFiles()).rejects.toEqual(
            expect.objectContaining({
                name: AuthorizationError.name,
                message: 'Google session expired. Reconnect Google Drive.',
            })
        )
    })

    it('retries timed-out uploads and succeeds on a later attempt', async () => {
        vi.useFakeTimers()

        const fetchMock = vi.fn()
            .mockImplementationOnce((_, options) => {
                return new Promise((resolve, reject) => {
                    options.signal.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted.', 'AbortError'))
                    })
                })
            })
            .mockResolvedValueOnce(jsonResponse({ id: 'created-file-id' }, { status: 200 }))

        vi.stubGlobal('fetch', fetchMock)

        const manager = new ManifestManager('token-123')
        const promise = manager.createFile('tasktime-yjs-core.bin', new Blob(['payload'], { type: 'application/octet-stream' }))

        await vi.advanceTimersByTimeAsync(61_000)

        await expect(promise).resolves.toBe('created-file-id')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})