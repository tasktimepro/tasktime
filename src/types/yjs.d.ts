/**
 * Type declarations for Yjs-related modules
 * 
 * These declarations help the IDE recognize yjs and y-indexeddb modules
 * when node_modules is not available locally (Docker development).
 * The actual types come from the packages at runtime.
 */

declare module 'yjs' {
    export class Doc {
        constructor();
        readonly share: globalThis.Map<string, unknown>;
        getMap<T = unknown>(name: string): Map<string, T>;
        destroy(): void;
        on(event: string, callback: (...args: unknown[]) => void): void;
        off(event: string, callback: (...args: unknown[]) => void): void;
        transact(callback: () => void, origin?: unknown): void;
    }

    export class Map<K = string, V = unknown> {
        readonly size: number;
        get(key: K): V | undefined;
        set(key: K, value: V): V;
        delete(key: K): boolean;
        has(key: K): boolean;
        forEach(callback: (value: V, key: K, map: Map<K, V>) => void): void;
        values(): IterableIterator<V>;
        entries(): IterableIterator<[K, V]>;
        keys(): IterableIterator<K>;
        observe(callback: (event: unknown, transaction: unknown) => void): void;
        unobserve(callback: (event: unknown, transaction: unknown) => void): void;
        observeDeep(callback: (events: unknown[], transaction: unknown) => void): void;
        unobserveDeep(callback: (events: unknown[], transaction: unknown) => void): void;
        toJSON(): Record<string, V>;
        [Symbol.iterator](): IterableIterator<[K, V]>;
    }

    export function encodeStateAsUpdate(doc: Doc, encodedTargetStateVector?: Uint8Array): Uint8Array;
    export function applyUpdate(doc: Doc, update: Uint8Array, origin?: unknown): void;
    export function mergeUpdates(updates: Uint8Array[]): Uint8Array;
    export function encodeStateVector(doc: Doc): Uint8Array;
}

declare module 'y-indexeddb' {
    import { Doc } from 'yjs';

    export class IndexeddbPersistence {
        constructor(name: string, doc: Doc);
        synced: boolean;
        destroy(): Promise<void>;
        clearData(): Promise<void>;
        once(event: 'synced', callback: () => void): void;
        on(event: string, callback: (...args: unknown[]) => void): void;
        off(event: string, callback: (...args: unknown[]) => void): void;
        whenSynced: Promise<IndexeddbPersistence>;
        set(key: string | number | ArrayBuffer | Date, value: string | number | ArrayBuffer | Date): Promise<string | number | ArrayBuffer | Date>;
    }
}
