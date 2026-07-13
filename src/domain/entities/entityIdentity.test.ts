import { describe, expect, it } from 'vitest';
import { assertEntityIdentityAvailable, EntityIdentityConflictError } from './entityIdentity';

describe('entity identity operations', () => {
    it('allows an unused ID', () => {
        expect(() => assertEntityIdentityAvailable({
            id: 'new-id',
            existingIds: ['existing-id'],
            label: 'Task',
        })).not.toThrow();
    });

    it('rejects an existing ID with a stable conflict error', () => {
        expect(() => assertEntityIdentityAvailable({
            id: 'existing-id',
            existingIds: ['existing-id'],
            label: 'Task',
        })).toThrow(EntityIdentityConflictError);

        expect(() => assertEntityIdentityAvailable({
            id: 'existing-id',
            existingIds: ['existing-id'],
            label: 'Task',
        })).toThrow('Task existing-id already exists.');
    });
});
