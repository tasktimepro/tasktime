import type { TaxReturnPeriod } from '@/stores/yjs/types';

export function buildTaxReturnPeriodFiledUpdates({
    existing,
    filedAt,
    updatedAt,
}: {
    existing: TaxReturnPeriod;
    filedAt: number;
    updatedAt: number;
}): Partial<TaxReturnPeriod> {
    return {
        status: 'filed',
        filedAt: existing.filedAt ?? filedAt,
        updatedAt,
    };
}

export function buildTaxReturnPeriodPaidUpdates({
    existing,
    filedAt,
    paidAt,
    updatedAt,
}: {
    existing: TaxReturnPeriod;
    filedAt: number;
    paidAt: number;
    updatedAt: number;
}): Partial<TaxReturnPeriod> {
    return {
        status: 'paid',
        filedAt: existing.filedAt ?? filedAt,
        paidAt: existing.paidAt ?? paidAt,
        updatedAt,
    };
}
