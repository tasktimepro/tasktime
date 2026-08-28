import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AuthCallback from './AuthCallback';

describe('AuthCallback provider routing', () => {
    const postMessage = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        postMessage.mockReset();
        Object.defineProperty(window, 'opener', {
            configurable: true,
            value: { postMessage },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        window.history.replaceState({}, '', '/');
    });

    it('preserves the existing Google callback message contract', () => {
        window.history.replaceState({}, '', '/auth/callback?code=google-code&state=google-state');

        render(<AuthCallback />);

        expect(postMessage).toHaveBeenCalledWith({
            type: 'google-auth-callback',
            code: 'google-code',
            state: 'google-state',
            error: null,
        }, window.location.origin);
    });

    it('uses a separate Dropbox message type and channel identity', () => {
        window.history.replaceState({}, '', '/auth/dropbox/callback?code=dropbox-code&state=dropbox-state');

        render(<AuthCallback />);

        expect(postMessage).toHaveBeenCalledWith({
            type: 'dropbox-auth-callback',
            code: 'dropbox-code',
            state: 'dropbox-state',
            error: null,
        }, window.location.origin);
    });
});
