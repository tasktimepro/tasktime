/**
 * Sorting utilities shared across lists.
 */

export const SORT_OPTIONS = [
    { value: 'createdAt', label: 'Date created' },
    { value: 'lastActive', label: 'Most recent' },
    { value: 'name', label: 'Name' },
] as const;

export type SortOption = typeof SORT_OPTIONS[number]['value'];

type SortInput<T> = {
    items: T[];
    sortBy?: SortOption | null;
    getName: (item: T) => string;
    getCreatedAt: (item: T) => number | null | undefined;
    getLastActive: (item: T) => number | null | undefined;
};

const compareNames = (a: string, b: string): number => {

    return a.localeCompare(b, undefined, { sensitivity: 'base' });
};

const compareNumbersDesc = (a?: number | null, b?: number | null): number => {

    const safeA = a || 0;
    const safeB = b || 0;

    return safeB - safeA;
};

/**
 * Sort a list of items based on a shared sort option.
 */
export const sortItems = <T>({
    items,
    sortBy,
    getName,
    getCreatedAt,
    getLastActive,
}: SortInput<T>): T[] => {

    const sorted = [...items];
    const mode: SortOption = sortBy || 'createdAt';

    if (mode === 'name') {
        sorted.sort((a, b) => compareNames(getName(a), getName(b)));

        return sorted;
    }

    if (mode === 'lastActive') {
        sorted.sort((a, b) => compareNumbersDesc(getLastActive(a), getLastActive(b)));

        return sorted;
    }

    sorted.sort((a, b) => compareNumbersDesc(getCreatedAt(a), getCreatedAt(b)));

    return sorted;
};
