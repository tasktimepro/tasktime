import { useMemo } from 'react';
import { useYjsCollection } from './useYjsCollection';
import type { TaxReturnPeriod } from '@/stores/yjs/types';

const sortTaxReturnPeriods = (periods: TaxReturnPeriod[]) => {
    return [...periods].sort((left, right) => {
        if (left.endDate !== right.endDate) {
            return right.endDate.localeCompare(left.endDate);
        }

        if (left.startDate !== right.startDate) {
            return right.startDate.localeCompare(left.startDate);
        }

        return left.title.localeCompare(right.title);
    });
};

export function useTaxReturnPeriods() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<TaxReturnPeriod>(
        (store) => store.taxReturnPeriods,
        { collectionName: 'taxReturnPeriods' }
    );

    const taxReturnPeriods = useMemo(() => sortTaxReturnPeriods(items), [items]);

    return {
        taxReturnPeriods,
        isLoading,
        getTaxReturnPeriod: get,
        createTaxReturnPeriod: create,
        updateTaxReturnPeriod: update,
        deleteTaxReturnPeriod: remove,
    };
}
