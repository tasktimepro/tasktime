import { useCallback, useMemo } from 'react';
import { useYjsCollection } from './useYjsCollection';
import { buildTaxReturnPeriodFiledUpdates, buildTaxReturnPeriodPaidUpdates } from '@/domain/expenses/taxReturnUpdates';
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
    const markAsFiled = useCallback((id: string, filedAt = Date.now()) => {
        const existing = get(id);

        if (!existing) {
            return undefined;
        }

        if (existing.status === 'paid') {
            throw new Error('Paid tax return periods cannot be moved back to filed.');
        }

        return update(id, buildTaxReturnPeriodFiledUpdates({
            existing,
            filedAt,
            updatedAt: Date.now(),
        }));
    }, [get, update]);
    const markAsPaid = useCallback((id: string, options: { filedAt?: number; paidAt?: number } = {}) => {
        const existing = get(id);

        if (!existing) {
            return undefined;
        }

        const now = Date.now();

        return update(id, buildTaxReturnPeriodPaidUpdates({
            existing,
            filedAt: options.filedAt ?? now,
            paidAt: options.paidAt ?? now,
            updatedAt: now,
        }));
    }, [get, update]);

    return {
        taxReturnPeriods,
        isLoading,
        getTaxReturnPeriod: get,
        createTaxReturnPeriod: create,
        updateTaxReturnPeriod: update,
        deleteTaxReturnPeriod: remove,
        markTaxReturnPeriodFiled: markAsFiled,
        markTaxReturnPeriodPaid: markAsPaid,
    };
}
