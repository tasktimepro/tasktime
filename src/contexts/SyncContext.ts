import { createContext } from 'react';
import type { SyncState } from '@/services/sync';
import type { GoogleUser } from '@/hooks/useGoogleAuth';

export type SyncContextValue = {
    isEnabled: boolean;
    isSignedIn: boolean;
    isLoading: boolean;
    state: SyncState;
    user: GoogleUser | null;
    lastSyncedAt: number | null;
    error: string | null;
    enableSync: () => Promise<void>;
    disableSync: () => Promise<void>;
    forceSync: () => Promise<void>;
};

export const SyncContext = createContext<SyncContextValue | undefined>(undefined);
