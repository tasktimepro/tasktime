function requestWaitingWorkerActivation(worker) {
    if (!worker) {
        return;
    }

    worker.postMessage({ type: 'SKIP_WAITING' });
}

function ignoreServiceWorkerFailure(promise) {
    if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
    }
}

/**
 * Register the production service worker and let updates take effect on the next app load.
 */
export function registerAppServiceWorker({
    isProd,
    navigatorObject = typeof navigator !== 'undefined' ? navigator : undefined,
    windowObject = typeof window !== 'undefined' ? window : undefined,
} = {}) {
    const serviceWorker = navigatorObject?.serviceWorker;

    if (!serviceWorker || !windowObject) {
        return;
    }

    if (isProd) {
        windowObject.addEventListener('load', () => {
            serviceWorker.register('/sw.js').then((registration) => {
                ignoreServiceWorkerFailure(registration.update());

                if (registration.waiting) {
                    requestWaitingWorkerActivation(registration.waiting);
                }

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && serviceWorker.controller) {
                            requestWaitingWorkerActivation(newWorker);
                        }
                    });
                });
            }).catch(() => {});
        });

        return;
    }

    // Ensure dev is not controlled by an old service worker.
    serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
    }).catch(() => {});
}
