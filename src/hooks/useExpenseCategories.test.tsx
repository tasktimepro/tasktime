import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExpenseCategories } from './useExpenseCategories';

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

describe('useExpenseCategories', () => {
    beforeEach(() => {
        mockItems = [];
        mockIsLoading = false;
        mockCreate.mockReset();
        mockUpdate.mockReset();
        mockRemove.mockReset();
        mockGet.mockReset();
    });

    it('does not seed the default categories by default', () => {
        renderHook(() => useExpenseCategories());

        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('seeds the default categories when requested and the collection is empty', () => {
        renderHook(() => useExpenseCategories({ seedDefaults: true }));

        expect(mockCreate).toHaveBeenCalledTimes(12);
        expect(mockCreate.mock.calls[0][0]).toMatchObject({
            name: 'Software & subscriptions',
            group: 'software',
            isDefault: true,
            archived: false,
        });
    });

    it('does not seed defaults when categories already exist', () => {
        mockItems = [
            {
                id: 'category-1',
                name: 'Custom',
                group: 'other',
                isDefault: false,
                archived: false,
            },
        ];

        const { result } = renderHook(() => useExpenseCategories({ seedDefaults: true }));

        expect(mockCreate).not.toHaveBeenCalled();
        expect(result.current.expenseCategories).toHaveLength(1);
    });

    it('returns active categories sorted ahead of archived entries', () => {
        mockItems = [
            {
                id: 'category-archived',
                name: 'Archived',
                group: 'other',
                isDefault: false,
                archived: true,
            },
            {
                id: 'category-custom',
                name: 'Consulting',
                group: 'professional',
                isDefault: false,
                archived: false,
            },
            {
                id: 'category-default',
                name: 'Travel',
                group: 'travel',
                isDefault: true,
                archived: false,
            },
        ];

        const { result } = renderHook(() => useExpenseCategories());

        expect(result.current.expenseCategories.map((category) => category.id)).toEqual([
            'category-default',
            'category-custom',
        ]);
        expect(result.current.allExpenseCategories.map((category) => category.id)).toEqual([
            'category-default',
            'category-custom',
            'category-archived',
        ]);
    });
});
