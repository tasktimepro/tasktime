/**
 * Register the production service worker and force-refresh only for actual updates.
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
            const hadControllerOnLoad = Boolean(serviceWorker.controller);

            serviceWorker.register('/sw.js').then((registration) => {
                registration.update();

                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && serviceWorker.controller) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
            });

            let refreshing = false;
            serviceWorker.addEventListener('controllerchange', () => {
                if (!hadControllerOnLoad || refreshing) return;

                refreshing = true;
                windowObject.location.reload();
            });
        });

        return;
    }

    // Ensure dev is not controlled by an old service worker.
    serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
    });
}
