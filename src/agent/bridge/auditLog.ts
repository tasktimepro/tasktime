import type { AgentCommandErrorCode } from '@/agent/types';

export type BridgeAuditAction =
    | 'session_connected'
    | 'session_disconnected'
    | 'pairing_succeeded'
    | 'access_revoked'
    | 'command_dispatched'
    | 'command_completed'
    | 'command_failed';

export type BridgeAuditCommandCategory =
    | 'read'
    | 'write'
    | 'billing'
    | 'export'
    | 'navigation'
    | 'unknown';

export interface BridgeAuditEvent {
    id: string;
    timestamp: number;
    action: BridgeAuditAction;
    clientId?: string;
    requestId?: string;
    command?: string;
    commandCategory?: BridgeAuditCommandCategory;
    ok?: boolean;
    errorCode?: AgentCommandErrorCode;
    details?: Record<string, unknown>;
}

export interface CreateBridgeAuditEventInput {
    action: BridgeAuditAction;
    clientId?: string;
    requestId?: string;
    command?: string;
    commandCategory?: BridgeAuditCommandCategory;
    ok?: boolean;
    errorCode?: AgentCommandErrorCode;
    details?: Record<string, unknown>;
}

export interface BridgeAuditLogOptions {
    maxEvents?: number;
    now?: () => number;
    idFactory?: () => string;
}

const DEFAULT_MAX_AUDIT_EVENTS = 500;

export function getBridgeAuditCommandCategory(command: string): BridgeAuditCommandCategory {
    if (command.startsWith('open_') || command.startsWith('focus_')) {
        return 'navigation';
    }

    if (command.includes('invoice') || command.includes('billed') || command.includes('billing')) {
        if (command.startsWith('export_')) {
            return 'export';
        }

        return 'billing';
    }

    if (command.startsWith('list_') || command.startsWith('get_') || command.startsWith('find_') || command.startsWith('preview_')) {
        return 'read';
    }

    if (
        command.startsWith('create_')
        || command.startsWith('update_')
        || command.startsWith('complete_')
        || command.startsWith('archive_')
        || command.startsWith('start_')
        || command.startsWith('pause_')
        || command.startsWith('stop_')
        || command.startsWith('add_')
        || command.startsWith('mark_')
        || command.startsWith('finalize_')
    ) {
        return 'write';
    }

    return 'unknown';
}

export class BridgeAuditLog {

    private readonly maxEvents: number;
    private readonly now: () => number;
    private readonly idFactory: () => string;
    private readonly events: BridgeAuditEvent[] = [];
    private nextId = 0;

    constructor(options: BridgeAuditLogOptions = {}) {
        this.maxEvents = options.maxEvents ?? DEFAULT_MAX_AUDIT_EVENTS;
        this.now = options.now ?? Date.now;
        this.idFactory = options.idFactory ?? (() => `bridge-audit-${this.nextId++}`);
    }

    append(input: CreateBridgeAuditEventInput): BridgeAuditEvent {
        const event: BridgeAuditEvent = {
            id: this.idFactory(),
            timestamp: this.now(),
            action: input.action,
        };
        const commandCategory = input.commandCategory ?? (input.command ? getBridgeAuditCommandCategory(input.command) : undefined);

        if (input.clientId) event.clientId = input.clientId;
        if (input.requestId) event.requestId = input.requestId;
        if (input.command) event.command = input.command;
        if (commandCategory) event.commandCategory = commandCategory;
        if (typeof input.ok === 'boolean') event.ok = input.ok;
        if (input.errorCode) event.errorCode = input.errorCode;
        if (input.details) event.details = input.details;

        this.events.push(event);

        while (this.events.length > this.maxEvents) {
            this.events.shift();
        }

        return event;
    }

    list(): BridgeAuditEvent[] {
        return this.events.map((event) => ({
            ...event,
            details: event.details ? { ...event.details } : undefined,
        }));
    }

    clear(): void {
        this.events.length = 0;
    }
}
