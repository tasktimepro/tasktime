import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentCommandContext } from './useAgentCommandContext';

const yjsMocks = vi.hoisted(() => ({
    store: { marker: 'store' },
    isReady: true,
    driveSessionId: 'drive-session-1',
    clearAllData: vi.fn(async () => undefined),
    restoreBackupData: vi.fn(async () => undefined),
}));

const googleAuthMocks = vi.hoisted(() => ({
    revokeAccess: vi.fn(async () => undefined),
}));

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => yjsMocks,
}));

vi.mock('./useGoogleAuth', () => ({
    useGoogleAuth: () => googleAuthMocks,
}));

describe('useAgentCommandContext', () => {
    beforeEach(() => {
        yjsMocks.isReady = true;
        yjsMocks.driveSessionId = 'drive-session-1';
        yjsMocks.clearAllData.mockClear();
        yjsMocks.restoreBackupData.mockClear();
        googleAuthMocks.revokeAccess.mockClear();
        window.history.pushState({}, '', '/account?section=agent');
    });

    it('builds a browser app-session command context from Yjs and auth hooks', () => {
        const { result, rerender } = renderHook(() => useAgentCommandContext());
        const firstIdempotency = result.current.idempotency;

        expect(result.current).toEqual(expect.objectContaining({
            store: yjsMocks.store,
            isReady: true,
            clearAllData: yjsMocks.clearAllData,
            restoreBackupData: yjsMocks.restoreBackupData,
            revokeDriveAccess: googleAuthMocks.revokeAccess,
            driveSessionId: 'drive-session-1',
        }));
        expect(firstIdempotency).toBeInstanceOf(Map);

        rerender();

        expect(result.current.idempotency).toBe(firstIdempotency);
    });

    it('opens app routes through browser history without leaving the current origin', () => {
        const { result } = renderHook(() => useAgentCommandContext());

        result.current.navigation?.openRoute('/projects/project-1?tab=tasks');

        expect(window.location.pathname).toBe('/projects/project-1');
        expect(window.location.search).toBe('?tab=tasks');
    });
});
