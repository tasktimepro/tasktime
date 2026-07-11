import type * as Y from 'yjs';
import type { YjsStore } from '@/stores/yjs/YjsStore';
import type { BackupImportPayload } from '@/utils/backupData';

export type AgentPermissionScope =
    | 'read'
    | 'write'
    | 'billing'
    | 'export'
    | 'email'
    | 'navigation';

export type AgentCommandErrorCode =
    | 'APP_NOT_READY'
    | 'NOT_FOUND'
    | 'INVALID_INPUT'
    | 'CONFLICT'
    | 'PERMISSION_DENIED'
    | 'RATE_LIMITED'
    | 'UNAVAILABLE';

export class AgentCommandError extends Error {

    code: AgentCommandErrorCode;
    details?: Record<string, unknown>;

    constructor(code: AgentCommandErrorCode, message: string, details?: Record<string, unknown>) {
        super(message);
        this.name = 'AgentCommandError';
        this.code = code;
        this.details = details;
    }
}

export interface AgentNavigationAdapter {
    openRoute: (path: string) => void;
}

export interface AgentCommandContext {
    store: YjsStore;
    isReady?: boolean;
    clearAllData?: () => Promise<void>;
    restoreBackupData?: (data: BackupImportPayload) => Promise<void>;
    revokeDriveAccess?: () => Promise<void>;
    now?: () => number;
    generateId?: () => string;
    navigation?: AgentNavigationAdapter;
    permissions?: Set<AgentPermissionScope>;
    idempotency?: Map<string, unknown>;
    driveSessionId?: string | null;
}

export interface AgentCommandResult<T> {
    ok: true;
    data: T;
}

export interface AgentCommandSuccess<T = unknown> {
    ok: true;
    command: string;
    data: T;
}

export interface AgentCommandFailure {
    ok: false;
    command: string;
    error: {
        code: AgentCommandErrorCode;
        message: string;
        details?: Record<string, unknown>;
    };
}

export type AgentCommandResponse<T = unknown> = AgentCommandSuccess<T> | AgentCommandFailure;

export type AgentCommandHandler<Input, Output> = (
    context: AgentCommandContext,
    input: Input
) => Output | Promise<Output>;

export type AgentYMap<T = unknown> = Y.Map<string, T>;
