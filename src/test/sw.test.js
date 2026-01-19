import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers = {}

const createEvent = () => {
    const event = {
        waitUntil: vi.fn(),
        respondWith: vi.fn(),
        request: null
    }
    return event
}

describe('service worker caching', () => {

    beforeEach(async () => {

        vi.resetModules()

        handlers.install = null
        handlers.activate = null
        handlers.fetch = null

        globalThis.self = {
            addEventListener: (type, handler) => {
                handlers[type] = handler
            },
            skipWaiting: vi.fn(),
            clients: { claim: vi.fn() }
        }

        globalThis.caches = {
            open: vi.fn().mockResolvedValue({
                addAll: vi.fn().mockResolvedValue(undefined),
                put: vi.fn().mockResolvedValue(undefined)
            }),
            keys: vi.fn().mockResolvedValue([]),
            delete: vi.fn().mockResolvedValue(true),
            match: vi.fn()
        }

        globalThis.fetch = vi.fn()

        await import('../../public/sw.js')
    })

    it('falls back to cached index on navigation when offline', async () => {

        const cachedResponse = new Response('<html/>', { status: 200 })
        globalThis.caches.match.mockResolvedValueOnce(cachedResponse)
        globalThis.fetch.mockRejectedValueOnce(new Error('offline'))

        const event = createEvent()
        event.request = { mode: 'navigate', method: 'GET' }

        handlers.fetch(event)

        expect(event.respondWith).toHaveBeenCalled()

        const response = await event.respondWith.mock.calls[0][0]
        expect(response).toBe(cachedResponse)
    })

    it('serves cached assets when available', async () => {

        const cachedResponse = new Response('cached', { status: 200 })
        globalThis.caches.match.mockResolvedValueOnce(cachedResponse)
        globalThis.fetch.mockRejectedValueOnce(new Error('offline'))

        const event = createEvent()
        event.request = { mode: 'no-cors', method: 'GET' }

        handlers.fetch(event)

        const response = await event.respondWith.mock.calls[0][0]
        expect(response).toBe(cachedResponse)
    })
})
