import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    listRegisteredPersistedDocs,
    registerPersistedDoc,
    unregisterPersistedDocs,
} from './persistedDocRegistry';

describe('persisted document registry fallback', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('retains historical document identity when database enumeration is unavailable', async () => {
        vi.stubGlobal('indexedDB', undefined);

        await registerPersistedDoc('entries-1987');
        await expect(listRegisteredPersistedDocs()).resolves.toContain('entries-1987');

        await unregisterPersistedDocs(['entries-1987']);
        await expect(listRegisteredPersistedDocs()).resolves.not.toContain('entries-1987');
    });
});
