import type * as Y from 'yjs';
import { generateId as defaultGenerateId } from '@/utils/idUtils';
import { readEntity, updateEntityFields, objectToYMap } from '@/stores/yjs/entityUtils';
import { validateCollectionEntity, type YjsCollectionName } from '@/stores/yjs/validation';
import { AgentCommandError, type AgentCommandContext, type AgentPermissionScope } from '@/agent/types';

export function assertReady(context: AgentCommandContext): void {
    const isReady = context.isReady ?? context.store.isReady;

    if (!isReady) {
        throw new AgentCommandError('APP_NOT_READY', 'TaskTime Pro is not ready yet.');
    }
}

export function assertPermission(context: AgentCommandContext, scope: AgentPermissionScope): void {
    if (!context.permissions || context.permissions.has(scope)) {
        return;
    }

    throw new AgentCommandError('PERMISSION_DENIED', `Missing ${scope} permission.`, { scope });
}

export function getNow(context: AgentCommandContext): number {
    return context.now ? context.now() : Date.now();
}

export function getId(context: AgentCommandContext): string {
    return context.generateId ? context.generateId() : defaultGenerateId();
}

export function requireString(value: unknown, field: string): string {
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }

    throw new AgentCommandError('INVALID_INPUT', `${field} is required.`, { field });
}

export function readRequiredEntity<T>(
    map: Y.Map<string, unknown>,
    id: string,
    label: string
): T {
    const entity = readEntity<T>(map.get(id));

    if (!entity) {
        throw new AgentCommandError('NOT_FOUND', `${label} not found.`, { id });
    }

    return entity;
}

export function createValidatedEntity<T extends { id: string }>(
    map: Y.Map<string, unknown>,
    collectionName: YjsCollectionName,
    data: Record<string, unknown>,
    contextLabel: string
): T {
    const validated = validateCollectionEntity<T>(collectionName, data, contextLabel);
    map.set(validated.id, objectToYMap(validated as unknown as Record<string, unknown>));
    return validated;
}

export function updateValidatedEntity<T extends { id: string }>(
    map: Y.Map<string, unknown>,
    collectionName: YjsCollectionName,
    id: string,
    updates: Record<string, unknown>,
    contextLabel: string
): T {
    const existing = readEntity<Record<string, unknown>>(map.get(id));

    if (!existing) {
        throw new AgentCommandError('NOT_FOUND', `${collectionName} entity not found.`, { id });
    }

    const merged = { ...existing, ...updates };
    const validated = validateCollectionEntity<T>(collectionName, merged, contextLabel);
    updateEntityFields(map, id, updates);
    return validated;
}

export function withIdempotency<T>(
    context: AgentCommandContext,
    key: string | undefined,
    create: () => T
): T {
    if (!key) {
        return create();
    }

    const existing = context.idempotency?.get(key);

    if (existing) {
        return existing as T;
    }

    const result = create();
    context.idempotency?.set(key, result);
    return result;
}
