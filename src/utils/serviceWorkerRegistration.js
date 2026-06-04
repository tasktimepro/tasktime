function requestWaitingWorkerActivation(worker) {
    if (!worker) {
        return;
    }

    worker.postMessage({ type: 'SKIP_WAITING' });
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
                registration.update();

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
            });
        });

        return;
    }

    // Ensure dev is not controlled by an old service worker.
    serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
    });
}
