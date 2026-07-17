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
        handlers.push = null
        handlers.notificationclick = null

        globalThis.self = {
            __WB_MANIFEST: [],
            addEventListener: (type, handler) => {
                handlers[type] = handler
            },
            skipWaiting: vi.fn(),
            registration: {
                showNotification: vi.fn().mockResolvedValue(undefined)
            },
            clients: {
                claim: vi.fn(),
                matchAll: vi.fn().mockResolvedValue([]),
                openWindow: vi.fn().mockResolvedValue(undefined)
            },
            location: { origin: 'https://tasktime.pro' }
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

    it('returns a 503 response for navigation when offline and the app shell cache is unavailable', async () => {

        globalThis.caches.match.mockResolvedValueOnce(undefined)
        globalThis.fetch.mockRejectedValueOnce(new Error('offline'))

        const event = createEvent()
        event.request = { mode: 'navigate', method: 'GET' }

        handlers.fetch(event)

        const response = await event.respondWith.mock.calls[0][0]

        expect(response).toBeInstanceOf(Response)
        expect(response.status).toBe(503)
        expect(await response.text()).toBe('Offline')
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

    it('returns a 503 response for uncached assets when offline', async () => {

        globalThis.caches.match.mockResolvedValueOnce(undefined)
        globalThis.fetch.mockRejectedValueOnce(new Error('offline'))

        const event = createEvent()
        event.request = { mode: 'no-cors', method: 'GET' }

        handlers.fetch(event)

        const response = await event.respondWith.mock.calls[0][0]

        expect(response).toBeInstanceOf(Response)
        expect(response.status).toBe(503)
        expect(await response.text()).toBe('Offline')
    })

    it.each([
        'https://sync.tasktime.pro/auth/status',
        'https://www.googleapis.com/drive/v3/files',
        'https://www.googleapis.com/upload/drive/v3/files',
    ])('leaves authenticated cross-origin API traffic network-only for %s', (url) => {
        const event = createEvent()
        event.request = { url, mode: 'cors', method: 'GET' }

        handlers.fetch(event)

        expect(event.respondWith).not.toHaveBeenCalled()
        expect(globalThis.caches.match).not.toHaveBeenCalled()
        expect(globalThis.caches.open).not.toHaveBeenCalled()
    })

    it('removes the previous app-shell cache during the privacy cache upgrade', async () => {
        globalThis.caches.keys.mockResolvedValueOnce(['tasktime-cache-v4', 'tasktime-cache-v5'])
        const event = { waitUntil: vi.fn() }

        handlers.activate(event)
        await event.waitUntil.mock.calls[0][0]

        expect(globalThis.caches.delete).toHaveBeenCalledWith('tasktime-cache-v4')
        expect(globalThis.caches.delete).not.toHaveBeenCalledWith('tasktime-cache-v5')
    })

    it('shows a generic notification for empty push events', async () => {

        const event = {
            data: null,
            waitUntil: vi.fn()
        }

        handlers.push(event)

        expect(event.waitUntil).toHaveBeenCalled()
        await event.waitUntil.mock.calls[0][0]

        expect(globalThis.self.registration.showNotification).toHaveBeenCalledWith('TaskTime Pro', {
            body: 'TaskTime Pro has a reminder for you.',
            tag: 'tasktime-reminder',
            renotify: false,
            data: {
                url: '/?notification=reminder'
            },
            icon: '/icons/web-app-manifest-192x192.png',
            badge: '/favicon-96x96.png'
        })
    })

    it('opens TaskTime Pro when a notification is clicked and no client is open', async () => {

        const event = {
            notification: {
                close: vi.fn(),
                data: { url: '/?notification=reminder' }
            },
            waitUntil: vi.fn()
        }

        handlers.notificationclick(event)

        expect(event.notification.close).toHaveBeenCalled()
        await event.waitUntil.mock.calls[0][0]

        expect(globalThis.self.clients.openWindow).toHaveBeenCalledWith('https://tasktime.pro/?notification=reminder')
    })
})
