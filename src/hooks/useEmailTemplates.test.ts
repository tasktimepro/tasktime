// @ts-nocheck
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmailTemplates } from './useEmailTemplates';
import { useYjsCollection } from './useYjsCollection';

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }));

const mockUseYjsCollection = useYjsCollection;

describe('useEmailTemplates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sorts templates with defaults first and then by name', () => {
        const get = vi.fn();
        const create = vi.fn();
        const update = vi.fn();
        const remove = vi.fn();

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: '3', name: 'Zulu', type: 'invoice', isDefault: false },
                { id: '1', name: 'Bravo', type: 'invoice', isDefault: true },
                { id: '2', name: 'Alpha', type: 'invoice', isDefault: false },
            ],
            isLoading: true,
            get,
            create,
            update,
            remove,
        });

        const { result } = renderHook(() => useEmailTemplates());

        expect(result.current.emailTemplates).toHaveLength(3);
        expect(result.current.sortedTemplates.map((template) => template.id)).toEqual(['1', '2', '3']);
        expect(result.current.isLoading).toBe(true);
        expect(result.current.getEmailTemplate).toBe(get);
        expect(result.current.createEmailTemplate).toBe(create);
        expect(result.current.updateEmailTemplate).toBe(update);
        expect(result.current.deleteEmailTemplate).toBe(remove);
    });

    it('filters templates by type', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'invoice-1', name: 'Invoice A', type: 'invoice', isDefault: false },
                { id: 'quote-1', name: 'Quote A', type: 'quote', isDefault: false },
                { id: 'invoice-2', name: 'Invoice B', type: 'invoice', isDefault: false },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useEmailTemplates());

        expect(result.current.getByType('invoice').map((template) => template.id)).toEqual(['invoice-1', 'invoice-2']);
        expect(result.current.getByType('quote').map((template) => template.id)).toEqual(['quote-1']);
    });

    it('returns the default template for a type when present', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'invoice-2', name: 'Second', type: 'invoice', isDefault: false },
                { id: 'invoice-1', name: 'First', type: 'invoice', isDefault: true },
                { id: 'quote-1', name: 'Quote', type: 'quote', isDefault: true },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useEmailTemplates());

        expect(result.current.getDefaultForType('invoice')?.id).toBe('invoice-1');
        expect(result.current.getDefaultForType('quote')?.id).toBe('quote-1');
    });

    it('falls back to the first template of a type and returns undefined when none exist', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'invoice-1', name: 'Alpha', type: 'invoice', isDefault: false },
                { id: 'invoice-2', name: 'Beta', type: 'invoice', isDefault: false },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useEmailTemplates());

        expect(result.current.getDefaultForType('invoice')?.id).toBe('invoice-1');
        expect(result.current.getDefaultForType('quote')).toBeUndefined();
    });

    it('sets the target as default and clears only same-type defaults', () => {
        const update = vi.fn();

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'invoice-1', name: 'Invoice A', type: 'invoice', isDefault: true },
                { id: 'invoice-2', name: 'Invoice B', type: 'invoice', isDefault: false },
                { id: 'quote-1', name: 'Quote A', type: 'quote', isDefault: true },
            ],
            isLoading: false,
            get: vi.fn((id) => id === 'invoice-2'
                ? { id: 'invoice-2', name: 'Invoice B', type: 'invoice', isDefault: false }
                : undefined),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useEmailTemplates());

        act(() => {
            result.current.setDefault('invoice-2');
        });

        expect(update).toHaveBeenCalledWith('invoice-1', { isDefault: false });
        expect(update).toHaveBeenCalledWith('invoice-2', { isDefault: true });
        expect(update).not.toHaveBeenCalledWith('quote-1', { isDefault: false });
    });

    it('does nothing when setting a missing template as default', () => {
        const update = vi.fn();

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(() => undefined),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useEmailTemplates());

        act(() => {
            result.current.setDefault('missing');
        });

        expect(update).not.toHaveBeenCalled();
    });
});