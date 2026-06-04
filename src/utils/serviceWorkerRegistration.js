import { queuePostReloadToast } from './postReloadToast.ts';

function queueAppUpdatedToast() {
    queuePostReloadToast({
        level: 'success',
        message: 'TaskTime was updated',
    });
}

function requestWaitingWorkerActivation(worker) {
    if (!worker) {
        return;
    }

    worker.postMessage({ type: 'SKIP_WAITING' });
}

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

            let refreshing = false;
            serviceWorker.addEventListener('controllerchange', () => {
                if (!hadControllerOnLoad || refreshing) return;

                refreshing = true;
                queueAppUpdatedToast();
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
