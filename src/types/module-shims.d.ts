declare module 'react' {
    export type SetStateAction<T> = T | ((prev: T) => T);
    export type Dispatch<T> = (value: T) => void;
    export type EffectCallback = () => void | (() => void);
    export type DependencyList = ReadonlyArray<unknown>;

    export function useState<T>(initialState: T | (() => T)):
        [T, Dispatch<SetStateAction<T>>];
    export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
    export function useMemo<T>(factory: () => T, deps?: DependencyList): T;
    export function useCallback<T extends (...args: unknown[]) => unknown>(
        callback: T,
        deps?: DependencyList
    ): T;
    export function useRef<T>(initialValue: T): { current: T };

    export type ReactNode = unknown;
}

declare module 'idb' {
    export type IDBPDatabase = {
        get: (storeName: string, key: string) => Promise<unknown>;
        put: (storeName: string, value: unknown, key: string) => Promise<void>;
        delete: (storeName: string, key: string) => Promise<void>;
    };

    export const openDB: (...args: unknown[]) => Promise<IDBPDatabase>;
}
