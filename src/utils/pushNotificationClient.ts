import { SYNC_WORKER_CONFIG } from '@/config/google';
import { APP_VERSION } from '@/constants/app';
import type { TodoNotificationSchedule } from '@/utils/todoNotificationSchedule';

export type PushSupportState = {
    supported: boolean;
    reason?: 'dev-server' | 'feature-disabled' | 'worker-disabled' | 'unsupported-api' | 'insecure-context' | 'worker-url-missing';
};

export type PushScheduleUploadPayload = {
    subscriptionEndpoint: string;
    schedules: TodoNotificationSchedule[];
    replaceHorizonUntil: string;
};

type PushSupportStateOptions = {
    isDev?: boolean;
    navigatorObject?: Navigator;
    notificationsEnabledFlag?: string | boolean;
    windowObject?: Window & typeof globalThis;
    workerUrl?: string;
};

type ReadyServiceWorkerRegistrationOptions = {
    isDev?: boolean;
    navigatorObject?: Navigator;
    timeoutMs?: number;
};

const PUSH_REQUEST_TIMEOUT_MS = 10000;

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const raw = atob(padded);
    const output = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
        output[index] = raw.charCodeAt(index);
    }

    return output;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = PUSH_REQUEST_TIMEOUT_MS): Promise<Response> {
    if (typeof AbortController === 'undefined') {
        return fetch(input, init);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
            throw new Error('Push service request timed out');
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

export function getPushSupportState({
    isDev = import.meta.env.DEV,
    navigatorObject = typeof navigator !== 'undefined' ? navigator : undefined,
    notificationsEnabledFlag = import.meta.env.VITE_PUSH_NOTIFICATIONS_ENABLED,
    windowObject = typeof window !== 'undefined' ? window : undefined,
    workerUrl = SYNC_WORKER_CONFIG.workerUrl,
}: PushSupportStateOptions = {}): PushSupportState {
    if (notificationsEnabledFlag === 'false') {
        return { supported: false, reason: 'feature-disabled' };
    }

    if (!workerUrl) {
        return { supported: false, reason: 'worker-url-missing' };
    }

    if (!windowObject || !navigatorObject) {
        return { supported: false, reason: 'unsupported-api' };
    }

    if (isDev) {
        return { supported: false, reason: 'dev-server' };
    }

    if (windowObject.isSecureContext === false) {
        return { supported: false, reason: 'insecure-context' };
    }

    if (!('serviceWorker' in navigatorObject) || !('PushManager' in windowObject) || !('Notification' in windowObject)) {
        return { supported: false, reason: 'unsupported-api' };
    }

    return { supported: true };
}

export async function getVapidPublicKey(): Promise<string> {
    const response = await fetchWithTimeout(SYNC_WORKER_CONFIG.endpoints.pushVapidPublicKey);
    if (!response.ok) {
        throw new Error('Unable to load push configuration');
    }

    const data = await response.json();
    if (!data?.publicKey || typeof data.publicKey !== 'string') {
        throw new Error('Invalid push configuration');
    }

    return data.publicKey;
}

export function getNotificationPermissionFailureMessage(permission: NotificationPermission): string {
    if (permission === 'denied') {
        return 'Allow notifications in site settings and try again.';
    }

    return 'Check the address bar permission prompt or allow notifications in site settings.';
}

function getServiceWorkerUnavailableMessage(isDev: boolean): string {
    if (isDev) {
        return 'TaskTime Pro push reminders require the preview or deployed app. The Vite dev server disables the app service worker.';
    }

    return 'TaskTime Pro push reminders are not ready on this device yet. Reload and try again.';
}

export async function getReadyServiceWorkerRegistration({
    isDev = import.meta.env.DEV,
    navigatorObject = typeof navigator !== 'undefined' ? navigator : undefined,
    timeoutMs = 1500,
}: ReadyServiceWorkerRegistrationOptions = {}): Promise<ServiceWorkerRegistration> {
    if (!navigatorObject || !('serviceWorker' in navigatorObject)) {
        throw new Error('Service workers are not supported');
    }

    const serviceWorker = navigatorObject.serviceWorker;
    const existing = await serviceWorker.getRegistration();
    if (existing) {
        return existing;
    }

    const timeoutError = new Error(getServiceWorkerUnavailableMessage(isDev));
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            serviceWorker.ready,
            new Promise<ServiceWorkerRegistration>((_, reject) => {
                timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
    const support = getPushSupportState();
    if (!support.supported) {
        return null;
    }

    const registration = await getReadyServiceWorkerRegistration();
    return registration.pushManager.getSubscription();
}

export async function subscribeToTaskTimePush(): Promise<PushSubscription> {
    const support = getPushSupportState();
    if (!support.supported) {
        throw new Error(`Push notifications are not supported: ${support.reason}`);
    }

    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error(getNotificationPermissionFailureMessage(permission));
    }

    const registration = await getReadyServiceWorkerRegistration();
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
        return existing;
    }

    const publicKey = await getVapidPublicKey();
    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
    });
}

export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
    const response = await fetchWithTimeout(SYNC_WORKER_CONFIG.endpoints.pushSubscription, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subscription: subscription.toJSON(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            appVersion: APP_VERSION,
        }),
    });

    if (!response.ok) {
        throw new Error('Unable to save push subscription');
    }
}

export async function unsubscribeFromTaskTimePush(): Promise<void> {
    const subscription = await getCurrentPushSubscription();
    if (!subscription) {
        return;
    }

    await deletePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
}

export async function deletePushSubscription(subscriptionEndpoint: string): Promise<void> {
    const response = await fetchWithTimeout(SYNC_WORKER_CONFIG.endpoints.pushSubscription, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionEndpoint }),
    });

    if (!response.ok) {
        throw new Error('Unable to delete push subscription');
    }
}

export async function uploadPushSchedules(payload: PushScheduleUploadPayload): Promise<void> {
    const response = await fetchWithTimeout(SYNC_WORKER_CONFIG.endpoints.pushSchedules, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error('Unable to sync push notification schedule');
    }
}

export async function sendTestPush(subscription: PushSubscription): Promise<void> {
    const response = await fetchWithTimeout(SYNC_WORKER_CONFIG.endpoints.pushTest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!response.ok) {
        throw new Error('Unable to send test push');
    }
}

export const pushNotificationClientInternalsForTest = {
    base64UrlToUint8Array,
    fetchWithTimeout,
    getServiceWorkerUnavailableMessage,
};
