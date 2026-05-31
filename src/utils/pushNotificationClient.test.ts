import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/google', () => ({
    SYNC_WORKER_CONFIG: {
        workerUrl: 'https://sync.tasktime.pro',
        endpoints: {
            pushSchedules: 'https://sync.tasktime.pro/push/schedules',
            pushSubscription: 'https://sync.tasktime.pro/push/subscription',
            pushTest: 'https://sync.tasktime.pro/push/test',
            pushVapidPublicKey: 'https://sync.tasktime.pro/push/vapid-public-key',
        },
    },
}));

vi.mock('@/constants/app', () => ({
    APP_VERSION: 'test-version',
}));

import {
    getPushSupportState,
    getReadyServiceWorkerRegistration,
} from './pushNotificationClient';

describe('pushNotificationClient', () => {
    it('treats the Vite dev server as unsupported for closed-app push', () => {
        const support = getPushSupportState({
            isDev: true,
            navigatorObject: { serviceWorker: {} } as Navigator,
            windowObject: {
                Notification: function Notification() {},
                PushManager: function PushManager() {},
                isSecureContext: true,
            } as unknown as Window & typeof globalThis,
            workerUrl: 'https://sync.tasktime.pro',
        });

        expect(support).toEqual({ supported: false, reason: 'dev-server' });
    });

    it('fails fast when no service worker registration becomes ready', async () => {
        vi.useFakeTimers();

        const serviceWorker = {
            getRegistration: vi.fn().mockResolvedValue(undefined),
            ready: new Promise<ServiceWorkerRegistration>(() => {}),
        };

        const registrationPromise = getReadyServiceWorkerRegistration({
            isDev: true,
            navigatorObject: { serviceWorker } as Navigator,
            timeoutMs: 100,
        });

        const rejection = expect(registrationPromise).rejects.toThrow(
            'TaskTime push reminders require the preview or deployed app. The Vite dev server disables the app service worker.',
        );

        await vi.advanceTimersByTimeAsync(100);

        await rejection;

        vi.useRealTimers();
    });

    it('returns an existing service worker registration immediately', async () => {
        const registration = { scope: '/' } as ServiceWorkerRegistration;
        const serviceWorker = {
            getRegistration: vi.fn().mockResolvedValue(registration),
            ready: Promise.resolve(registration),
        };

        await expect(getReadyServiceWorkerRegistration({
            navigatorObject: { serviceWorker } as Navigator,
        })).resolves.toBe(registration);
    });
});