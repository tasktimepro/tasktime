import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    _resetDriveAuthInvalidationForTests,
    publishDriveAuthInvalidation,
    subscribeToDriveAuthInvalidation,
} from './driveAuthInvalidation';

class BroadcastChannelMock {
    static instances: BroadcastChannelMock[] = [];
    readonly name: string;
    readonly postMessage = vi.fn();
    readonly close = vi.fn();
    onmessage: ((event: MessageEvent) => void) | null = null;

    constructor(name: string) {
        this.name = name;
        BroadcastChannelMock.instances.push(this);
    }

    emit(data: unknown): void {
        this.onmessage?.({ data } as MessageEvent);
    }
}

describe('driveAuthInvalidation', () => {
    beforeEach(() => {
        _resetDriveAuthInvalidationForTests();
        BroadcastChannelMock.instances = [];
        vi.stubGlobal('BroadcastChannel', BroadcastChannelMock);
    });

    afterEach(() => {
        _resetDriveAuthInvalidationForTests();
        vi.unstubAllGlobals();
    });

    it('publishes only a versioned reason without session or credential material', () => {
        const unsubscribe = subscribeToDriveAuthInvalidation(vi.fn());

        publishDriveAuthInvalidation('session-replaced');

        const channel = BroadcastChannelMock.instances[0];
        expect(channel?.postMessage).toHaveBeenCalledWith({
            type: 'tasktime-drive-auth-invalidation',
            version: 1,
            reason: 'session-replaced',
        });
        const serialized = JSON.stringify(channel?.postMessage.mock.calls[0]?.[0]);
        expect(serialized).not.toContain('sessionId');
        expect(serialized).not.toContain('accessToken');
        unsubscribe();
    });

    it('accepts supported messages and ignores malformed, unknown-version, and same-tab publishes', () => {
        const subscriber = vi.fn();
        const unsubscribe = subscribeToDriveAuthInvalidation(subscriber);
        const channel = BroadcastChannelMock.instances[0];

        publishDriveAuthInvalidation('signed-out');
        expect(subscriber).not.toHaveBeenCalled();

        channel?.emit({ type: 'tasktime-drive-auth-invalidation', version: 2, reason: 'signed-out' });
        channel?.emit({ type: 'tasktime-drive-auth-invalidation', version: 1, reason: 'unknown' });
        channel?.emit({ type: 'other', version: 1, reason: 'signed-out' });
        expect(subscriber).not.toHaveBeenCalled();

        channel?.emit({
            type: 'tasktime-drive-auth-invalidation',
            version: 1,
            reason: 'authorization-failed',
        });
        expect(subscriber).toHaveBeenCalledOnce();
        expect(subscriber).toHaveBeenCalledWith('authorization-failed');
        unsubscribe();
    });

    it('falls back safely when BroadcastChannel is unavailable', () => {
        vi.stubGlobal('BroadcastChannel', undefined);
        const subscriber = vi.fn();

        const unsubscribe = subscribeToDriveAuthInvalidation(subscriber);
        expect(() => publishDriveAuthInvalidation('revoked')).not.toThrow();
        expect(subscriber).not.toHaveBeenCalled();
        unsubscribe();
    });
});
