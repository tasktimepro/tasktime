declare module 'react' {
    export type SetStateAction<T> = T | ((prev: T) => T);
    export type Dispatch<T> = (value: T) => void;
    export type EffectCallback = () => void | (() => void);
    export type DependencyList = ReadonlyArray<unknown>;
    
    export interface ProviderProps<T> {
        value: T;
        children?: ReactNode;
    }
    
    export interface Context<T> {
        Provider: (props: ProviderProps<T>) => ReactNode;
        Consumer: unknown;
        displayName?: string;
    }

    export function useState<T>(initialState: T | (() => T)):
        [T, Dispatch<SetStateAction<T>>];
    export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
    export function useMemo<T>(factory: () => T, deps?: DependencyList): T;
    export function useCallback<T extends (...args: unknown[]) => unknown>(
        callback: T,
        deps?: DependencyList
    ): T;
    export function useRef<T>(initialValue: T): { current: T };
    export function createContext<T>(defaultValue: T): Context<T>;
    export function useContext<T>(context: Context<T>): T;

    export type ReactNode = unknown;
}

declare module 'react/jsx-runtime' {
    export const jsx: unknown;
    export const jsxs: unknown;
    export const Fragment: unknown;
}

declare module 'idb' {
    export type IDBPDatabase = {
        get: (storeName: string, key: string) => Promise<unknown>;
        put: (storeName: string, value: unknown, key: string) => Promise<void>;
        delete: (storeName: string, key: string) => Promise<void>;
    };

    export const openDB: (...args: unknown[]) => Promise<IDBPDatabase>;
}

declare module 'date-fns' {
    export function formatDistanceToNow(date: Date | number, options?: {
        addSuffix?: boolean;
        includeSeconds?: boolean;
    }): string;
    export function format(date: Date | number, formatStr: string): string;
    export function startOfDay(date: Date | number): Date;
    export function endOfDay(date: Date | number): Date;
    export function startOfWeek(date: Date | number, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): Date;
    export function endOfWeek(date: Date | number, options?: { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): Date;
    export function startOfMonth(date: Date | number): Date;
    export function endOfMonth(date: Date | number): Date;
    export function subDays(date: Date | number, amount: number): Date;
    export function subWeeks(date: Date | number, amount: number): Date;
    export function addDays(date: Date | number, amount: number): Date;
    export function isWithinInterval(date: Date | number, interval: { start: Date | number; end: Date | number }): boolean;
    export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
    export function parseISO(dateString: string): Date;
}
