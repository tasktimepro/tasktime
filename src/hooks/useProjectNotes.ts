import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjects } from './useProjects';
import { useYjs } from '@/contexts/YjsContext';
import {
    cloneProjectNotesDocument,
    createProjectNotesPayload,
    createEmptyProjectNotesDocument,
} from '@/utils/projectNotesUtils';
import { PROJECT_NOTES_LOCAL_SAVE_ORIGIN } from '@/constants/syncOrigins';
import type { ProjectNotes, TipTapJsonNode } from '@/stores/yjs/types';

type CommitOptions = {
    updateState?: boolean;
};

type CommitTimer = ReturnType<typeof setTimeout>;

export function useProjectNotes(projectId: string, initialNotes?: ProjectNotes | null) {
    const { updateProject } = useProjects();
    const {
        isDriveConnected,
        isSyncing,
        manualSyncInProgress,
        pendingSyncChanges,
        lastSyncedAt,
        forceSyncDrive,
    } = useYjs();

    const initialDocumentRef = useRef<TipTapJsonNode>(
        cloneProjectNotesDocument(initialNotes?.content ?? createEmptyProjectNotesDocument())
    );
    const latestDocumentRef = useRef<TipTapJsonNode>(cloneProjectNotesDocument(initialDocumentRef.current));
    const lastCommittedSerializedRef = useRef(JSON.stringify(initialDocumentRef.current));
    const scheduledCommitRef = useRef<CommitTimer | null>(null);
    const flushPendingNotesRef = useRef<(options?: CommitOptions) => boolean>(() => false);
    const isMountedRef = useRef(true);

    const [isDirty, setIsDirty] = useState(false);
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const [lastLocalSavedAt, setLastLocalSavedAt] = useState<number | null>(null);

    const commitNotes = useCallback((options: CommitOptions = {}) => {
        const { updateState = true } = options;

        const document = cloneProjectNotesDocument(latestDocumentRef.current);
        const serialized = JSON.stringify(document);

        if (serialized === lastCommittedSerializedRef.current) {
            if (updateState && isMountedRef.current) {
                setIsDirty(false);
            }

            return false;
        }

        if (updateState && isMountedRef.current) {
            setIsSavingLocal(true);
        }

        const payload = createProjectNotesPayload(document);
        const updatedProject = updateProject(projectId, { notes: payload }, {
            origin: PROJECT_NOTES_LOCAL_SAVE_ORIGIN,
        });

        if (!updatedProject) {
            if (updateState && isMountedRef.current) {
                setIsSavingLocal(false);
            }

            return false;
        }

        latestDocumentRef.current = cloneProjectNotesDocument(payload.content);
        lastCommittedSerializedRef.current = JSON.stringify(payload.content);

        if (isMountedRef.current) {
            setLastLocalSavedAt(payload.updatedAt);

            if (updateState) {
                setIsDirty(false);
                setIsSavingLocal(false);
            }
        }

        return true;
    }, [projectId, updateProject]);

    const clearScheduledCommit = useCallback(() => {
        if (!scheduledCommitRef.current) {
            return;
        }

        clearTimeout(scheduledCommitRef.current);
        scheduledCommitRef.current = null;
    }, []);

    const flushPendingNotes = useCallback((options: CommitOptions = {}) => {
        clearScheduledCommit();

        return commitNotes(options);
    }, [clearScheduledCommit, commitNotes]);

    useEffect(() => {
        flushPendingNotesRef.current = flushPendingNotes;
    }, [flushPendingNotes]);

    const scheduleLocalCommit = useCallback(() => {
        if (scheduledCommitRef.current) {
            return;
        }

        scheduledCommitRef.current = setTimeout(() => {
            scheduledCommitRef.current = null;
            commitNotes();
        }, 0);
    }, [commitNotes]);

    const updateDraft = useCallback((document: TipTapJsonNode) => {
        latestDocumentRef.current = document;

        if (isMountedRef.current) {
            setIsDirty(true);
        }

        scheduleLocalCommit();
    }, [scheduleLocalCommit]);

    const saveNotesToCloud = useCallback(async () => {
        flushPendingNotes();

        if (!isDriveConnected) {
            return false;
        }

        await forceSyncDrive({ allowPull: false });
        return true;
    }, [flushPendingNotes, forceSyncDrive, isDriveConnected]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'hidden') {
                return;
            }

            flushPendingNotes({ updateState: false });
        };

        const handlePageHide = () => {
            flushPendingNotes({ updateState: false });
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [flushPendingNotes]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            flushPendingNotesRef.current({ updateState: false });
        };
    }, []);

    return {
        initialDocument: initialDocumentRef.current,
        isDirty,
        isSavingLocal,
        isDriveConnected,
        isDriveSyncing: isSyncing || manualSyncInProgress,
        manualSyncInProgress,
        pendingSyncChanges,
        lastLocalSavedAt,
        lastSyncedAt,
        updateDraft,
        flushPendingNotes,
        saveNotesToCloud,
    };
}
