import { describe, expect, it, vi } from 'vitest';

const postReloadToastMocks = vi.hoisted(() => ({
    queuePostReloadToast: vi.fn(),
}));

vi.mock('./postReloadToast.ts', () => ({
    queuePostReloadToast: postReloadToastMocks.queuePostReloadToast,
}));

import { registerAppServiceWorker } from './serviceWorkerRegistration';

function createEventTarget() {
    const listeners = new Map();

    return {
        addEventListener: vi.fn((eventName, listener) => {
            if (!listeners.has(eventName)) {
                listeners.set(eventName, []);
            }

            listeners.get(eventName).push(listener);
        }),
        dispatch(eventName) {
            for (const listener of listeners.get(eventName) || []) {
                listener();
            }
        },
    };
}

function createWorker(state = 'installing') {
    return {
        ...createEventTarget(),
        state,
        postMessage: vi.fn(),
    };
}

function createRegistration() {
    return {
        ...createEventTarget(),
        waiting: null,
        installing: null,
        update: vi.fn(),
    };
}

function flushPromises() {
    return Promise.resolve();
}

describe('registerAppServiceWorker', () => {
    it('returns early when service workers are unavailable', () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const windowObject = {
            ...createEventTarget(),
            location: { reload: vi.fn() },
        };

        expect(() => {
            registerAppServiceWorker({
                isProd: true,
                navigatorObject: {},
                windowObject,
            });
        }).not.toThrow();

        expect(windowObject.addEventListener).not.toHaveBeenCalled();
    });

    it('does not reload on first production install when no controller existed yet', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const windowObject = {
            ...createEventTarget(),
            location: { reload: vi.fn() },
        };
        const registration = createRegistration();
        const serviceWorker = {
            ...createEventTarget(),
            controller: null,
            register: vi.fn().mockResolvedValue(registration),
        };

        registerAppServiceWorker({
            isProd: true,
            navigatorObject: { serviceWorker },
            windowObject,
        });

        windowObject.dispatch('load');
        await flushPromises();
        serviceWorker.dispatch('controllerchange');

        expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js');
        expect(registration.update).toHaveBeenCalled();
        expect(windowObject.location.reload).not.toHaveBeenCalled();
        expect(postReloadToastMocks.queuePostReloadToast).not.toHaveBeenCalled();
    });

    it('asks an already waiting production worker to skip waiting immediately', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const waitingWorker = createWorker('installed');
        const windowObject = {
            ...createEventTarget(),
            location: { reload: vi.fn() },
        };
        const registration = createRegistration();
        registration.waiting = waitingWorker;
        const serviceWorker = {
            ...createEventTarget(),
            controller: { state: 'activated' },
            register: vi.fn().mockResolvedValue(registration),
        };

        registerAppServiceWorker({
            isProd: true,
            navigatorObject: { serviceWorker },
            windowObject,
        });

        windowObject.dispatch('load');
        await flushPromises();

        expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
        expect(postReloadToastMocks.queuePostReloadToast).not.toHaveBeenCalled();
    });

    it('handles production service worker registration failures as non-fatal', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const windowObject = {
            ...createEventTarget(),
            location: { reload: vi.fn() },
        };
        const serviceWorker = {
            ...createEventTarget(),
            controller: { state: 'activated' },
            register: vi.fn().mockRejectedValue(new Error('service worker unavailable')),
        };

        registerAppServiceWorker({
            isProd: true,
            navigatorObject: { serviceWorker },
            windowObject,
        });

        windowObject.dispatch('load');
        await flushPromises();

        expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js');
        expect(windowObject.location.reload).not.toHaveBeenCalled();
        expect(postReloadToastMocks.queuePostReloadToast).not.toHaveBeenCalled();
    });

    it('handles production service worker update failures as non-fatal', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const updateCatch = vi.fn();
        const windowObject = {
            ...createEventTarget(),
            location: { reload: vi.fn() },
        };
        const registration = createRegistration();
        registration.update = vi.fn(() => ({ catch: updateCatch }));
        const serviceWorker = {
            ...createEventTarget(),
            controller: { state: 'activated' },
            register: vi.fn().mockResolvedValue(registration),
        };

        registerAppServiceWorker({
            isProd: true,
            navigatorObject: { serviceWorker },
            windowObject,
        });

        windowObject.dispatch('load');
        await flushPromises();

        expect(registration.update).toHaveBeenCalled();
        expect(updateCatch).toHaveBeenCalledWith(expect.any(Function));
        expect(windowObject.location.reload).not.toHaveBeenCalled();
        expect(postReloadToastMocks.queuePostReloadToast).not.toHaveBeenCalled();
    });

    it('does not force reload when an existing production service worker is replaced', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const windowObject = {
            ...createEventTarget(),
            location: { reload: vi.fn() },
        };
        const registration = createRegistration();
        const serviceWorker = {
            ...createEventTarget(),
            controller: { state: 'activated' },
            register: vi.fn().mockResolvedValue(registration),
        };

        registerAppServiceWorker({
            isProd: true,
            navigatorObject: { serviceWorker },
            windowObject,
        });

        windowObject.dispatch('load');
        await flushPromises();
        serviceWorker.dispatch('controllerchange');
        serviceWorker.dispatch('controllerchange');

        expect(windowObject.location.reload).not.toHaveBeenCalled();
        expect(postReloadToastMocks.queuePostReloadToast).not.toHaveBeenCalled();
    });

    it('asks a newly installed worker to skip waiting when an active controller already exists', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const windowObject = {
            ...createEventTarget(),
            location: { reload: vi.fn() },
        };
        const registration = createRegistration();
        const installingWorker = createWorker();
        registration.installing = installingWorker;
        const serviceWorker = {
            ...createEventTarget(),
            controller: { state: 'activated' },
            register: vi.fn().mockResolvedValue(registration),
        };

        registerAppServiceWorker({
            isProd: true,
            navigatorObject: { serviceWorker },
            windowObject,
        });

        windowObject.dispatch('load');
        await flushPromises();
        registration.dispatch('updatefound');
        installingWorker.state = 'installed';
        installingWorker.dispatch('statechange');

        expect(installingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
        expect(postReloadToastMocks.queuePostReloadToast).not.toHaveBeenCalled();
    });

    it('does not ask a newly found worker to skip waiting when no installing worker exists', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const windowObject = {
            ...createEventTarget(),
            location: { reload: vi.fn() },
        };
        const registration = createRegistration();
        const serviceWorker = {
            ...createEventTarget(),
            controller: { state: 'activated' },
            register: vi.fn().mockResolvedValue(registration),
        };

        registerAppServiceWorker({
            isProd: true,
            navigatorObject: { serviceWorker },
            windowObject,
        });

        windowObject.dispatch('load');
        await flushPromises();

        expect(() => registration.dispatch('updatefound')).not.toThrow();
    });

    it('unregisters stale service workers in development', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const unregister = vi.fn();
        const serviceWorker = {
            getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]),
        };

        registerAppServiceWorker({
            isProd: false,
            navigatorObject: { serviceWorker },
            windowObject: { addEventListener: vi.fn(), location: { reload: vi.fn() } },
        });

        await flushPromises();

        expect(serviceWorker.getRegistrations).toHaveBeenCalled();
        expect(unregister).toHaveBeenCalledTimes(2);
    });

    it('handles development service worker lookup failures as non-fatal', async () => {
        postReloadToastMocks.queuePostReloadToast.mockClear();

        const serviceWorker = {
            getRegistrations: vi.fn().mockRejectedValue(new Error('indexed service worker state unavailable')),
        };

        registerAppServiceWorker({
            isProd: false,
            navigatorObject: { serviceWorker },
            windowObject: { addEventListener: vi.fn(), location: { reload: vi.fn() } },
        });

        await flushPromises();

        expect(serviceWorker.getRegistrations).toHaveBeenCalled();
        expect(postReloadToastMocks.queuePostReloadToast).not.toHaveBeenCalled();
    });
});
