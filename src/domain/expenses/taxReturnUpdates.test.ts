import { describe, expect, it } from 'vitest';
import type { TaxReturnPeriod } from '@/stores/yjs/types';
import { buildTaxReturnPeriodFiledUpdates, buildTaxReturnPeriodPaidUpdates } from './taxReturnUpdates';

const period: TaxReturnPeriod = {
    id: 'period-1',
    title: 'VAT Q2',
    type: 'vat',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    status: 'draft',
};

describe('tax return status update builders', () => {
    it('builds filed updates while preserving an existing filed timestamp', () => {
        expect(buildTaxReturnPeriodFiledUpdates({
            existing: period,
            filedAt: 10,
            updatedAt: 11,
        })).toEqual({
            status: 'filed',
            filedAt: 10,
            updatedAt: 11,
        });

        expect(buildTaxReturnPeriodFiledUpdates({
            existing: {
                ...period,
                filedAt: 5,
            },
            filedAt: 10,
            updatedAt: 11,
        })).toEqual({
            status: 'filed',
            filedAt: 5,
            updatedAt: 11,
        });
    });

    it('builds paid updates while preserving existing filed and paid timestamps', () => {
        expect(buildTaxReturnPeriodPaidUpdates({
            existing: period,
            filedAt: 10,
            paidAt: 20,
            updatedAt: 21,
        })).toEqual({
            status: 'paid',
            filedAt: 10,
            paidAt: 20,
            updatedAt: 21,
        });

        expect(buildTaxReturnPeriodPaidUpdates({
            existing: {
                ...period,
                filedAt: 5,
                paidAt: 15,
            },
            filedAt: 10,
            paidAt: 20,
            updatedAt: 21,
        })).toEqual({
            status: 'paid',
            filedAt: 5,
            paidAt: 15,
            updatedAt: 21,
        });
    });
});
