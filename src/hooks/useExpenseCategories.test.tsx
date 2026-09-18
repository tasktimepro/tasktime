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

    it('keeps an empty collection empty across mounting and remounting', () => {
        const { result, unmount } = renderHook(() => useExpenseCategories());

        expect(result.current.allExpenseCategories).toEqual([]);
        unmount();
        renderHook(() => useExpenseCategories());
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('reads categories arriving after loading without creating or changing records', () => {
        mockIsLoading = true;
        const { result, rerender } = renderHook(() => useExpenseCategories());

        expect(result.current.isLoading).toBe(true);
        mockIsLoading = false;
        rerender();
        expect(result.current.allExpenseCategories).toEqual([]);

        mockItems = [
            {
                id: 'legacy-default',
                name: 'Travel',
                group: 'travel',
                isDefault: true,
                archived: true,
            },
        ];
        rerender();

        expect(result.current.allExpenseCategories).toEqual(mockItems);
        expect(result.current.expenseCategories).toEqual([]);
        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockRemove).not.toHaveBeenCalled();
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
                id: 'category-custom-2',
                name: 'Books',
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
            'category-custom-2',
            'category-custom',
        ]);
        expect(result.current.allExpenseCategories.map((category) => category.id)).toEqual([
            'category-default',
            'category-custom-2',
            'category-custom',
            'category-archived',
        ]);
    });

    it('wraps category mutations with safe defaults', () => {
        mockCreate.mockReturnValue({ id: 'created-category' });
        mockUpdate.mockReturnValue({ id: 'updated-category' });
        mockRemove.mockReturnValue(true);
        mockGet.mockReturnValue({ id: 'category-1' });

        const { result } = renderHook(() => useExpenseCategories());

        expect(result.current.getExpenseCategory('category-1')).toEqual({ id: 'category-1' });
        expect(result.current.createExpenseCategory({ name: 'Custom', group: 'other' })).toEqual({ id: 'created-category' });
        expect(mockCreate).toHaveBeenCalledWith({
            name: 'Custom',
            group: 'other',
            isDefault: false,
            archived: false,
        });

        expect(result.current.archiveExpenseCategory('category-1')).toEqual({ id: 'updated-category' });
        expect(mockUpdate).toHaveBeenCalledWith('category-1', { archived: true });

        expect(result.current.restoreExpenseCategory('category-1')).toEqual({ id: 'updated-category' });
        expect(mockUpdate).toHaveBeenCalledWith('category-1', { archived: false });

        expect(result.current.deleteExpenseCategory('category-1')).toBe(true);
        expect(mockRemove).toHaveBeenCalledWith('category-1');
        expect(result.current.updateExpenseCategory).toBe(mockUpdate);
    });
});
