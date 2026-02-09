// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useInvoiceTemplates } from './useInvoiceTemplates'
import { useYjsCollection } from './useYjsCollection'

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))

const mockUseYjsCollection = useYjsCollection

describe('useInvoiceTemplates', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('sorts templates by name', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'b', name: 'Beta' },
                { id: 'a', name: 'Alpha' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoiceTemplates())
        expect(result.current.sortedTemplates.map((t) => t.id)).toEqual(['a', 'b'])
    })

    it('returns empty invoice number when template missing', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(() => null),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoiceTemplates())
        expect(result.current.getNextInvoiceNumber('missing')).toBe('')
    })

    it('increments sequential numbers when enabled', () => {
        const update = vi.fn()
        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(() => ({ id: 't1', useSequentialNumbers: true, currentSequentialNumber: 9 })),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoiceTemplates())

        act(() => {
            result.current.incrementSequentialNumber('t1')
        })

        expect(update).toHaveBeenCalledWith('t1', { currentSequentialNumber: 10 })
    })

    it('skips increment when sequential numbers disabled', () => {
        const update = vi.fn()
        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(() => ({ id: 't1', useSequentialNumbers: false })),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoiceTemplates())

        act(() => {
            result.current.incrementSequentialNumber('t1')
        })

        expect(update).not.toHaveBeenCalled()
    })

    it('sets a default template and clears prior default', () => {
        const update = vi.fn()
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 't1', name: 'A', isDefault: true },
                { id: 't2', name: 'B', isDefault: false },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useInvoiceTemplates())

        act(() => {
            result.current.setDefault('t2')
        })

        expect(update).toHaveBeenCalledWith('t1', { isDefault: false })
        expect(update).toHaveBeenCalledWith('t2', { isDefault: true })
    })
})
