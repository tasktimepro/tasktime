import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaxReturnPeriods } from './useTaxReturnPeriods';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockGet = vi.fn();

let mockItems = [];
let mockIsLoading = false;

vi.mock('./useYjsCollection', () => ({
    useYjsCollection: () => ({
        items: mockItems,
        isLoading: mockIsLoading,
        get: mockGet,
        create: mockCreate,
        update: mockUpdate,
        remove: mockRemove,
    }),
}));

describe('useTaxReturnPeriods', () => {
    beforeEach(() => {
        mockItems = [];
        mockIsLoading = false;
        mockCreate.mockReset();
        mockUpdate.mockReset();
        mockRemove.mockReset();
        mockGet.mockReset();
    });

    it('sorts tax return periods by end date descending', () => {
        mockItems = [
            {
                id: 'period-1',
                title: 'Q1 VAT',
                type: 'vat',
                startDate: '2026-01-01',
                endDate: '2026-03-31',
                status: 'draft',
            },
            {
                id: 'period-2',
                title: 'April VAT',
                type: 'vat',
                startDate: '2026-04-01',
                endDate: '2026-04-30',
                status: 'draft',
            },
        ];

        const { result } = renderHook(() => useTaxReturnPeriods());

        expect(result.current.taxReturnPeriods.map((period) => period.id)).toEqual([
            'period-2',
            'period-1',
        ]);
        expect(result.current.createTaxReturnPeriod).toBe(mockCreate);
        expect(result.current.getTaxReturnPeriod).toBe(mockGet);
        expect(result.current.updateTaxReturnPeriod).toBe(mockUpdate);
        expect(result.current.deleteTaxReturnPeriod).toBe(mockRemove);
        expect(result.current.isLoading).toBe(false);
    });

    it('sorts matching end dates by start date and title', () => {
        mockItems = [
            {
                id: 'period-title-b',
                title: 'B return',
                type: 'vat',
                startDate: '2026-01-01',
                endDate: '2026-03-31',
                status: 'draft',
            },
            {
                id: 'period-title-a',
                title: 'A return',
                type: 'vat',
                startDate: '2026-01-01',
                endDate: '2026-03-31',
                status: 'draft',
            },
            {
                id: 'period-later-start',
                title: 'Later start',
                type: 'vat',
                startDate: '2026-02-01',
                endDate: '2026-03-31',
                status: 'draft',
            },
        ];
        mockIsLoading = true;

        const { result } = renderHook(() => useTaxReturnPeriods());

        expect(result.current.taxReturnPeriods.map((period) => period.id)).toEqual([
            'period-later-start',
            'period-title-a',
            'period-title-b',
        ]);
        expect(result.current.isLoading).toBe(true);
    });
});
