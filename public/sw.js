const CACHE_NAME = 'tasktime-cache-v2';
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
const STATIC_PUBLIC_PATHS = [
    '/blog',
    '/contact',
    '/privacy',
    '/terms',
];

function getRequestUrl(request) {
    if (typeof request?.url !== 'string' || request.url.length === 0) {
        return null;
    }

    return new URL(request.url, self.location?.origin ?? 'http://localhost');
}

function cacheResponse(cacheKey, response) {
    if (!response || response.status !== 200) {
        return Promise.resolve();
    }

    return caches.open(CACHE_NAME)
        .then((cache) => cache.put(cacheKey, response.clone()))
        .catch(() => undefined);
}

function createOfflineNavigationResponse() {
    return new Response('Offline', {
        status: 503,
        statusText: 'Offline',
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
}

function getNavigationFallbackResponse() {
    return caches.match('/index.html')
        .then((cachedResponse) => cachedResponse || createOfflineNavigationResponse())
        .catch(() => createOfflineNavigationResponse());
}

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

function getNotificationUrl(data) {
    if (data && typeof data.url === 'string' && data.url.startsWith('/')) {
        return data.url;
    }

    return '/?notification=reminder';
}

function getPushNotificationData(event) {
    if (!event.data) {
        return {};
    }

    try {
        return event.data.json();
    } catch {
        return {};
    }
}

self.addEventListener('push', (event) => {
    const data = getPushNotificationData(event);
    const title = typeof data.title === 'string' ? data.title : 'TaskTime';
    const body = typeof data.body === 'string' ? data.body : 'TaskTime has a reminder for you.';

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            tag: 'tasktime-reminder',
            renotify: false,
            data: {
                url: getNotificationUrl(data),
            },
            icon: '/icons/web-app-manifest-192x192.png',
            badge: '/favicon-96x96.png',
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = new URL(
        getNotificationUrl(event.notification?.data),
        self.location.origin
    ).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clients) => {
                const appClient = clients.find((client) => {
                    try {
                        return new URL(client.url).origin === self.location.origin;
                    } catch {
                        return false;
                    }
                });

                if (appClient) {
                    if ('navigate' in appClient) {
                        return appClient.navigate(targetUrl).then(() => appClient.focus());
                    }

                    return appClient.focus();
                }

                return self.clients.openWindow(targetUrl);
            })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const requestUrl = getRequestUrl(request);
    const appOrigin = typeof self.location?.origin === 'string' ? self.location.origin : requestUrl?.origin;

    if (request.method !== 'GET') {
        return;
    }

    // Keep blog pages outside the app shell cache/fallback behavior.
    if (
        requestUrl
        && appOrigin
        && requestUrl.origin === appOrigin
        && STATIC_PUBLIC_PATHS.some((pathname) => requestUrl.pathname === pathname || requestUrl.pathname.startsWith(`${pathname}/`))
    ) {
        return;
    }

    // Navigation requests: network-first, fallback to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    event.waitUntil(cacheResponse('/index.html', response));
                    return response;
                })
                .catch(() => getNavigationFallbackResponse())
        );
        return;
    }

    // Static assets: cache-first with background refresh
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                event.waitUntil(
                    fetch(request)
                        .then((response) => cacheResponse(request, response))
                        .catch(() => undefined)
                );
                return cachedResponse;
            }

            return fetch(request)
                .then((response) => {
                    event.waitUntil(cacheResponse(request, response));
                    return response;
                })
                .catch(() => createOfflineNavigationResponse());
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
