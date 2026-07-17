export type DriveAuthInvalidationReason =
    | 'authorization-failed'
    | 'revoked'
    | 'session-replaced'
    | 'signed-out';

const CHANNEL_NAME = 'tasktime-drive-auth-invalidation-v1';
const MESSAGE_TYPE = 'tasktime-drive-auth-invalidation';
const MESSAGE_VERSION = 1;
const REASONS = new Set<DriveAuthInvalidationReason>([
    'authorization-failed',
    'revoked',
    'session-replaced',
    'signed-out',
]);

type Subscriber = (reason: DriveAuthInvalidationReason) => void;

const subscribers = new Set<Subscriber>();
let channel: BroadcastChannel | null = null;
let channelInitializationAttempted = false;

function isInvalidationReason(value: unknown): value is DriveAuthInvalidationReason {
    return typeof value === 'string' && REASONS.has(value as DriveAuthInvalidationReason);
}

function ensureChannel(): BroadcastChannel | null {
    if (channelInitializationAttempted) return channel;
    channelInitializationAttempted = true;

    if (typeof BroadcastChannel === 'undefined') return null;

    try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent<unknown>) => {
            const value = event.data;
            if (!value || typeof value !== 'object' || Array.isArray(value)) return;

            const message = value as { type?: unknown; version?: unknown; reason?: unknown };
            if (message.type !== MESSAGE_TYPE
                || message.version !== MESSAGE_VERSION
                || !isInvalidationReason(message.reason)) {
                return;
            }

            subscribers.forEach((subscriber) => subscriber(message.reason as DriveAuthInvalidationReason));
        };
    } catch {
        channel = null;
    }

    return channel;
}

export function subscribeToDriveAuthInvalidation(subscriber: Subscriber): () => void {
    subscribers.add(subscriber);
    ensureChannel();

    return () => {
        subscribers.delete(subscriber);
    };
}

export function publishDriveAuthInvalidation(reason: DriveAuthInvalidationReason): void {
    const currentChannel = ensureChannel();
    if (!currentChannel) return;

    try {
        currentChannel.postMessage({
            type: MESSAGE_TYPE,
            version: MESSAGE_VERSION,
            reason,
        });
    } catch {
        // Shared IndexedDB remains the source of truth when broadcasting fails.
    }
}

export function _resetDriveAuthInvalidationForTests(): void {
    subscribers.clear();
    try {
        channel?.close();
    } catch {
        // Ignore already-closed test channels.
    }
    channel = null;
    channelInitializationAttempted = false;
}
