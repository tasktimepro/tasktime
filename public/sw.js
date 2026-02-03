const CACHE_NAME = 'tasktime-cache-v1';
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.svg',
    '/favicon-96x96.png',
    '/favicon.ico',
    '/icons/apple-touch-icon.png',
    '/icons/web-app-manifest-192x192.png',
    '/icons/web-app-manifest-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event?.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    // Navigation requests: network-first, fallback to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Static assets: cache-first with background refresh
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                event.waitUntil(
                    fetch(request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
                            }
                        })
                        .catch(() => undefined)
                );
                return cachedResponse;
            }

            return fetch(request).then((response) => {
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                }
                return response;
            });
        })
    );
});

const notifyClients = async () => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    for (const client of clients) {
        client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' });
    }
};

self.addEventListener('sync', (event) => {
    if (event.tag === 'tasktime-sync') {
        event.waitUntil(notifyClients());
    }
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'tasktime-periodic-sync') {
        event.waitUntil(notifyClients());
    }
});
