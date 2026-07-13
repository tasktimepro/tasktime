export class EntityIdentityConflictError extends Error {
    readonly code = 'CONFLICT';
    readonly details: { id: string; label: string };

    constructor(id: string, label: string) {
        super(`${label} ${id} already exists.`);
        this.name = 'EntityIdentityConflictError';
        this.details = { id, label };
    }
}

/**
 * Fail closed before a persisted entity create could overwrite an existing ID.
 */
export function assertEntityIdentityAvailable({
    id,
    existingIds,
    label = 'Entity',
}: {
    id: string;
    existingIds: Iterable<string>;
    label?: string;
}): void {
    for (const existingId of existingIds) {
        if (existingId === id) {
            throw new EntityIdentityConflictError(id, label);
        }
    }
}
