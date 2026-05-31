import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

type PushClientModule = typeof import('./pushNotificationClient');

let pushClient: PushClientModule;

async function loadPushClient(): Promise<PushClientModule> {
    vi.resetModules();
    vi.stubEnv('DEV', false);
    pushClient = await import('./pushNotificationClient');
    return pushClient;
}

function setSecureContext(value: boolean): void {
    Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        value,
    });
}

function installPushGlobals({
    existingSubscription = null,
    permission = 'granted',
    subscriptionResult = null,
}: {
    existingSubscription?: PushSubscription | null;
    permission?: NotificationPermission;
    subscriptionResult?: PushSubscription | null;
} = {}) {
    const subscribe = vi.fn().mockResolvedValue(subscriptionResult);
    const getSubscription = vi.fn().mockResolvedValue(existingSubscription);
    const registration = {
        scope: '/',
        pushManager: {
            getSubscription,
            subscribe,
        },
    } as unknown as ServiceWorkerRegistration;
    const serviceWorker = {
        getRegistration: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
    };

    vi.stubGlobal('navigator', { serviceWorker });
    vi.stubGlobal('Notification', {
        requestPermission: vi.fn().mockResolvedValue(permission),
    });
    vi.stubGlobal('PushManager', function PushManager() {});
    Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: globalThis.Notification,
    });
    Object.defineProperty(window, 'PushManager', {
        configurable: true,
        value: globalThis.PushManager,
    });
    setSecureContext(true);

    return {
        getSubscription,
        registration,
        serviceWorker,
        subscribe,
    };
}

function createSubscription(endpoint = 'https://push.example.test/subscription'): PushSubscription {
    return {
        endpoint,
        toJSON: () => ({
            endpoint,
            keys: {
                auth: 'auth-key',
                p256dh: 'p256dh-key',
            },
        }),
        unsubscribe: vi.fn().mockResolvedValue(true),
    } as unknown as PushSubscription;
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe('pushNotificationClient', () => {
    it('classifies supported and unsupported push environments', async () => {
        const { getPushSupportState } = await loadPushClient();

        expect(getPushSupportState({
            isDev: false,
            notificationsEnabledFlag: 'false',
            workerUrl: 'https://sync.tasktime.pro',
        })).toEqual({ supported: false, reason: 'feature-disabled' });

        expect(getPushSupportState({
            isDev: false,
            workerUrl: '',
            navigatorObject: {} as Navigator,
            windowObject: {} as Window & typeof globalThis,
        })).toEqual({ supported: false, reason: 'worker-url-missing' });

        expect(getPushSupportState({
            isDev: false,
            workerUrl: 'https://sync.tasktime.pro',
            navigatorObject: {} as Navigator,
            windowObject: { isSecureContext: false } as Window & typeof globalThis,
        })).toEqual({ supported: false, reason: 'insecure-context' });

        expect(getPushSupportState({
            isDev: false,
            workerUrl: 'https://sync.tasktime.pro',
            navigatorObject: {} as Navigator,
            windowObject: { isSecureContext: true } as Window & typeof globalThis,
        })).toEqual({ supported: false, reason: 'unsupported-api' });

        expect(getPushSupportState({
            isDev: true,
            workerUrl: 'https://sync.tasktime.pro',
            navigatorObject: { serviceWorker: {} } as Navigator,
            windowObject: {
                Notification: function Notification() {},
                PushManager: function PushManager() {},
                isSecureContext: true,
            } as unknown as Window & typeof globalThis,
        })).toEqual({ supported: false, reason: 'dev-server' });

        expect(getPushSupportState({
            isDev: false,
            workerUrl: 'https://sync.tasktime.pro',
            navigatorObject: { serviceWorker: {} } as Navigator,
            windowObject: {
                Notification: function Notification() {},
                PushManager: function PushManager() {},
                isSecureContext: true,
            } as unknown as Window & typeof globalThis,
        })).toEqual({ supported: true });
    });

    it('loads the VAPID public key and validates the worker response', async () => {
        const { getVapidPublicKey } = await loadPushClient();

        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({ publicKey: 'BEl6QmY' }),
            })
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValue({ publicKey: 123 }),
            }));

        await expect(getVapidPublicKey()).resolves.toBe('BEl6QmY');
        await expect(getVapidPublicKey()).rejects.toThrow('Unable to load push configuration');
        await expect(getVapidPublicKey()).rejects.toThrow('Invalid push configuration');
    });

    it('fails fast when no service worker support or registration is available', async () => {
        const { getReadyServiceWorkerRegistration } = await loadPushClient();

        await expect(getReadyServiceWorkerRegistration({
            navigatorObject: undefined,
        })).rejects.toThrow('Service workers are not supported');

        vi.useFakeTimers();

        const serviceWorker = {
            getRegistration: vi.fn().mockResolvedValue(undefined),
            ready: new Promise<ServiceWorkerRegistration>(() => {}),
        };

        const registrationPromise = getReadyServiceWorkerRegistration({
            isDev: false,
            navigatorObject: { serviceWorker } as Navigator,
            timeoutMs: 100,
        });
        void registrationPromise.catch(() => {});

        await vi.advanceTimersByTimeAsync(100);
        await expect(registrationPromise).rejects.toThrow(
            'TaskTime push reminders are not ready on this device yet. Reload and try again.',
        );
    });

    it('returns an existing service worker registration immediately', async () => {
        const { getReadyServiceWorkerRegistration } = await loadPushClient();
        const registration = { scope: '/' } as ServiceWorkerRegistration;
        const serviceWorker = {
            getRegistration: vi.fn().mockResolvedValue(registration),
            ready: Promise.resolve(registration),
        };

        await expect(getReadyServiceWorkerRegistration({
            navigatorObject: { serviceWorker } as Navigator,
        })).resolves.toBe(registration);
    });

    it('returns null when push is unsupported and returns the current subscription when supported', async () => {
        const { getCurrentPushSubscription } = await loadPushClient();
        vi.stubGlobal('navigator', {});
        vi.stubGlobal('Notification', function Notification() {});
        vi.stubGlobal('PushManager', function PushManager() {});
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: globalThis.Notification,
        });
        Object.defineProperty(window, 'PushManager', {
            configurable: true,
            value: globalThis.PushManager,
        });
        setSecureContext(true);

        await expect(getCurrentPushSubscription()).resolves.toBeNull();

        const existingSubscription = createSubscription();
        installPushGlobals({ existingSubscription });

        await expect(getCurrentPushSubscription()).resolves.toBe(existingSubscription);
    });

    it('subscribes to push with the worker VAPID key when needed', async () => {
        const { subscribeToTaskTimePush } = await loadPushClient();
        const existingSubscription = createSubscription('https://push.example.test/existing');
        installPushGlobals({ existingSubscription });

        await expect(subscribeToTaskTimePush()).resolves.toBe(existingSubscription);

        const createdSubscription = createSubscription('https://push.example.test/new');
        const { subscribe } = installPushGlobals({ subscriptionResult: createdSubscription });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ publicKey: 'AQIDBA' }),
        }));

        await expect(subscribeToTaskTimePush()).resolves.toBe(createdSubscription);
        expect(subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: new Uint8Array([1, 2, 3, 4]),
        });
    });

    it('rejects unsupported push environments and denied notification permission', async () => {
        const { subscribeToTaskTimePush } = await loadPushClient();
        vi.stubGlobal('navigator', {});
        vi.stubGlobal('Notification', function Notification() {});
        vi.stubGlobal('PushManager', function PushManager() {});
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: globalThis.Notification,
        });
        Object.defineProperty(window, 'PushManager', {
            configurable: true,
            value: globalThis.PushManager,
        });
        setSecureContext(true);

        await expect(subscribeToTaskTimePush()).rejects.toThrow('Push notifications are not supported: unsupported-api');

        installPushGlobals({ permission: 'denied' });

        await expect(subscribeToTaskTimePush()).rejects.toThrow(
            'Allow notifications in site settings and try again.',
        );
    });

    it('persists, deletes, uploads, and test-sends push data through the worker', async () => {
        const {
            deletePushSubscription,
            savePushSubscription,
            sendTestPush,
            uploadPushSchedules,
        } = await loadPushClient();
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);

        const subscription = createSubscription();
        const schedules = [{
            scheduleKey: 'todo-today:2026-06-01',
            type: 'todo_today' as const,
            localDate: '2026-06-01',
            dueAt: '2026-06-01T09:00:00.000Z',
            timezone: 'UTC',
        }];

        await savePushSubscription(subscription);
        await deletePushSubscription(subscription.endpoint);
        await uploadPushSchedules({
            subscriptionEndpoint: subscription.endpoint,
            schedules,
            replaceHorizonUntil: '2026-06-15',
        });
        await sendTestPush(subscription);

        expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://sync.tasktime.pro/push/subscription', expect.objectContaining({
            method: 'PUT',
        }));
        expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://sync.tasktime.pro/push/subscription', expect.objectContaining({
            method: 'DELETE',
        }));
        expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://sync.tasktime.pro/push/schedules', expect.objectContaining({
            method: 'PUT',
        }));
        expect(fetchMock).toHaveBeenNthCalledWith(4, 'https://sync.tasktime.pro/push/test', expect.objectContaining({
            method: 'POST',
        }));
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
            appVersion: 'test-version',
            subscription: {
                endpoint: subscription.endpoint,
            },
        });
    });

    it('throws when worker persistence endpoints fail', async () => {
        const {
            deletePushSubscription,
            savePushSubscription,
            sendTestPush,
            uploadPushSchedules,
        } = await loadPushClient();
        const subscription = createSubscription();

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        await expect(savePushSubscription(subscription)).rejects.toThrow('Unable to save push subscription');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        await expect(deletePushSubscription(subscription.endpoint)).rejects.toThrow('Unable to delete push subscription');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        await expect(uploadPushSchedules({
            subscriptionEndpoint: subscription.endpoint,
            schedules: [],
            replaceHorizonUntil: '2026-06-15',
        })).rejects.toThrow('Unable to sync push notification schedule');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
        await expect(sendTestPush(subscription)).rejects.toThrow('Unable to send test push');
    });

    it('removes the current browser subscription when present', async () => {
        const { unsubscribeFromTaskTimePush } = await loadPushClient();
        const subscription = createSubscription();
        installPushGlobals({ existingSubscription: subscription });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

        await unsubscribeFromTaskTimePush();

        expect(fetch).toHaveBeenCalledWith('https://sync.tasktime.pro/push/subscription', expect.objectContaining({
            method: 'DELETE',
        }));
        expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    it('short-circuits unsubscribe when there is no current subscription', async () => {
        const { unsubscribeFromTaskTimePush } = await loadPushClient();
        installPushGlobals({ existingSubscription: null });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await unsubscribeFromTaskTimePush();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('exposes internal helpers for deterministic low-level tests', async () => {
        const { pushNotificationClientInternalsForTest } = await loadPushClient();

        expect(pushNotificationClientInternalsForTest.getServiceWorkerUnavailableMessage(true))
            .toContain('preview or deployed app');
        expect(Array.from(pushNotificationClientInternalsForTest.base64UrlToUint8Array('AQIDBA')))
            .toEqual([1, 2, 3, 4]);
    });

    it('times out push service requests that do not resolve', async () => {
        const { pushNotificationClientInternalsForTest } = await loadPushClient();
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn((_input, init) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
            });
        })));

        const request = pushNotificationClientInternalsForTest.fetchWithTimeout(
            'https://sync.tasktime.pro/push/subscription',
            {},
            100,
        );
        void request.catch(() => {});

        await vi.advanceTimersByTimeAsync(100);

        await expect(request).rejects.toThrow('Push service request timed out');
    });
});
