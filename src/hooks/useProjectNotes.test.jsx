// @ts-nocheck
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectNotes } from './useProjectNotes';
import { useProjects } from './useProjects';
import { useYjs } from '@/contexts/YjsContext';
import { PROJECT_NOTES_LOCAL_SAVE_ORIGIN } from '@/constants/syncOrigins';

vi.mock('./useProjects', () => ({ useProjects: vi.fn() }));
vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }));

const mockUseProjects = useProjects;
const mockUseYjs = useYjs;

const createDocument = (text) => ({
    type: 'doc',
    content: [
        {
            type: 'paragraph',
            content: [{ type: 'text', text }],
        },
    ],
});

describe('useProjectNotes', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockUseProjects.mockReturnValue({
            updateProject: vi.fn(() => ({ id: 'project-1' })),
        });

        mockUseYjs.mockReturnValue({
            isDriveConnected: true,
            manualSyncInProgress: false,
            pendingSyncChanges: false,
            lastSyncedAt: 1_700_000_000_000,
            forceSyncDrive: vi.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('saves project note edits on the next task without waiting for blur', () => {
        vi.useFakeTimers();

        const updateProject = vi.fn(() => ({ id: 'project-1' }));
        mockUseProjects.mockReturnValue({ updateProject });

        const { result } = renderHook(() => useProjectNotes('project-1', null));

        act(() => {
            result.current.updateDraft(createDocument('Project kickoff notes'));
        });

        expect(updateProject).not.toHaveBeenCalled();

        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
            notes: expect.objectContaining({
                type: 'tiptap-json',
                plainTextPreview: 'Project kickoff notes',
            }),
        }), { origin: PROJECT_NOTES_LOCAL_SAVE_ORIGIN });
        expect(result.current.isDirty).toBe(false);
        expect(result.current.lastLocalSavedAt).not.toBeNull();

    });

    it('flushes notes before forcing a push-only cloud save', async () => {
        const updateProject = vi.fn(() => ({ id: 'project-1' }));
        const forceSyncDrive = vi.fn().mockResolvedValue(undefined);

        mockUseProjects.mockReturnValue({ updateProject });
        mockUseYjs.mockReturnValue({
            isDriveConnected: true,
            manualSyncInProgress: false,
            pendingSyncChanges: false,
            lastSyncedAt: null,
            forceSyncDrive,
        });

        const { result } = renderHook(() => useProjectNotes('project-1', null));

        act(() => {
            result.current.updateDraft(createDocument('Send summary to client'));
        });

        await act(async () => {
            await result.current.saveNotesToCloud();
        });

        expect(updateProject).toHaveBeenCalledTimes(1);
        expect(forceSyncDrive).toHaveBeenCalledWith({ allowPull: false });
    });

    it('flushes pending note edits on pagehide', () => {
        const updateProject = vi.fn(() => ({ id: 'project-1' }));
        mockUseProjects.mockReturnValue({ updateProject });

        const { result } = renderHook(() => useProjectNotes('project-1', null));

        act(() => {
            result.current.updateDraft(createDocument('Pagehide flush'));
        });

        act(() => {
            window.dispatchEvent(new Event('pagehide'));
        });

        expect(updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
            notes: expect.objectContaining({
                plainTextPreview: 'Pagehide flush',
            }),
        }), { origin: PROJECT_NOTES_LOCAL_SAVE_ORIGIN });
    });

    it('reuses the pending commit timer and saves only the latest draft', () => {
        vi.useFakeTimers();

        const updateProject = vi.fn(() => ({ id: 'project-1' }));
        mockUseProjects.mockReturnValue({ updateProject });

        const { result } = renderHook(() => useProjectNotes('project-1', null));

        act(() => {
            result.current.updateDraft(createDocument('First draft'));
            result.current.updateDraft(createDocument('Latest draft'));
        });

        act(() => {
            vi.runOnlyPendingTimers();
        });

        expect(updateProject).toHaveBeenCalledTimes(1);
        expect(updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
            notes: expect.objectContaining({
                plainTextPreview: 'Latest draft',
            }),
        }), { origin: PROJECT_NOTES_LOCAL_SAVE_ORIGIN });
    });

    it('skips forceSyncDrive when the cloud is disconnected', async () => {
        const updateProject = vi.fn(() => ({ id: 'project-1' }));
        const forceSyncDrive = vi.fn().mockResolvedValue(undefined);

        mockUseProjects.mockReturnValue({ updateProject });
        mockUseYjs.mockReturnValue({
            isDriveConnected: false,
            manualSyncInProgress: false,
            pendingSyncChanges: false,
            lastSyncedAt: null,
            forceSyncDrive,
        });

        const { result } = renderHook(() => useProjectNotes('project-1', null));

        act(() => {
            result.current.updateDraft(createDocument('Offline draft'));
        });

        let savedToCloud;

        await act(async () => {
            savedToCloud = await result.current.saveNotesToCloud();
        });

        expect(savedToCloud).toBe(false);
        expect(updateProject).toHaveBeenCalledTimes(1);
        expect(forceSyncDrive).not.toHaveBeenCalled();
    });

    it('ignores visibilitychange while visible and flushes pending notes on unmount', () => {
        const updateProject = vi.fn(() => ({ id: 'project-1' }));
        const originalVisibilityState = document.visibilityState;

        mockUseProjects.mockReturnValue({ updateProject });

        const { result, unmount } = renderHook(() => useProjectNotes('project-1', null));

        act(() => {
            result.current.updateDraft(createDocument('Unmount flush'));
        });

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'visible',
        });

        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(updateProject).not.toHaveBeenCalled();

        unmount();

        expect(updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
            notes: expect.objectContaining({
                plainTextPreview: 'Unmount flush',
            }),
        }), { origin: PROJECT_NOTES_LOCAL_SAVE_ORIGIN });

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: originalVisibilityState,
        });
    });

    it('returns false when flushing unchanged notes or when a project update fails', () => {
        const updateProject = vi.fn(() => null);
        mockUseProjects.mockReturnValue({ updateProject });

        const { result } = renderHook(() => useProjectNotes('project-1', null));

        let unchangedResult;

        act(() => {
            unchangedResult = result.current.flushPendingNotes();
        });

        expect(unchangedResult).toBe(false);

        act(() => {
            result.current.updateDraft(createDocument('Failed save'));
        });

        let failedSaveResult;

        act(() => {
            failedSaveResult = result.current.flushPendingNotes();
        });

        expect(failedSaveResult).toBe(false);
        expect(result.current.isSavingLocal).toBe(false);
        expect(updateProject).toHaveBeenCalledTimes(1);
    });
});