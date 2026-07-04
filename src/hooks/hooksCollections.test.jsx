// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import * as Y from 'yjs'
import { useBusinessInfos } from './useBusinessInfos'
import { useClients } from './useClients'
import { useInvoiceTemplates } from './useInvoiceTemplates'
import { usePaymentMethods } from './usePaymentMethods'
import { useProjects } from './useProjects'
import { useYjsCollection } from './useYjsCollection'

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))
vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        store: { plannerAttachments: new Y.Doc().getMap('plannerAttachments') },
        isReady: true,
    }),
}))

const mockUseYjsCollection = useYjsCollection

function makeCollection(items) {
    const update = vi.fn((id, updates) => ({ id, ...updates }))
    return {
        items,
        isLoading: false,
        get: vi.fn((id) => items.find((i) => i.id === id)),
        create: vi.fn(),
        update,
        remove: vi.fn(),
    }
}

describe('collection-backed hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('business infos derive default and setDefault updates', () => {
        const collection = makeCollection([
            { id: 'a', isDefault: false, name: 'One' },
            { id: 'b', isDefault: true, name: 'Two' },
        ])
        mockUseYjsCollection.mockReturnValue(collection)

        const { result } = renderHook(() => useBusinessInfos())

        expect(result.current.defaultBusinessInfo?.id).toBe('b')

        act(() => {
            result.current.setDefault('a')
        })

        expect(collection.update).toHaveBeenCalledWith('b', { isDefault: false })
        expect(collection.update).toHaveBeenCalledWith('a', { isDefault: true })
    })

    it('business infos fall back to the first record when no default is marked', () => {
        const collection = makeCollection([
            { id: 'a', isDefault: false, name: 'One' },
            { id: 'b', isDefault: false, name: 'Two' },
        ])
        mockUseYjsCollection.mockReturnValue(collection)

        const { result } = renderHook(() => useBusinessInfos())

        expect(result.current.defaultBusinessInfo?.id).toBe('a')
    })

    it('clients are sorted and can be found case-insensitively', () => {
        const collection = makeCollection([
            { id: '1', title: 'Zephyr' },
            { id: '2', title: 'alpha' },
        ])
        mockUseYjsCollection.mockReturnValue(collection)

        const { result } = renderHook(() => useClients())

        expect(result.current.sortedClients.map((c) => c.title)).toEqual(['alpha', 'Zephyr'])
        expect(result.current.findByName('ALPHA')?.id).toBe('2')
    })

    it('clients handle missing titles in sorting and lookup', () => {

        const collection = makeCollection([
            { id: '1' },
            { id: '2', title: 'Beta' },
        ])
        mockUseYjsCollection.mockReturnValue(collection)

        const { result } = renderHook(() => useClients())

        expect(result.current.sortedClients[0]?.id).toBe('1')
        expect(result.current.findByName('')?.id).toBe('1')
        expect(result.current.findByName('beta')?.id).toBe('2')
    })

    it('invoice templates expose numbering helpers and default toggle', () => {
        const collection = makeCollection([
            { id: 't1', name: 'Template 1', prefix: 'INV-', currentSequentialNumber: 7, useSequentialNumbers: true, isDefault: true },
            { id: 't2', name: 'Template 2', prefix: '', currentSequentialNumber: 2, useSequentialNumbers: true, isDefault: false },
        ])
        mockUseYjsCollection.mockReturnValue(collection)

        const { result } = renderHook(() => useInvoiceTemplates())

        expect(result.current.getNextInvoiceNumber('t1')).toBe('INV-0007')

        act(() => {
            result.current.incrementSequentialNumber('t1')
            result.current.setDefault('t2')
        })

        expect(collection.update).toHaveBeenCalledWith('t1', { currentSequentialNumber: 8 })
        expect(collection.update).toHaveBeenCalledWith('t1', { isDefault: false })
        expect(collection.update).toHaveBeenCalledWith('t2', { isDefault: true })
    })

    it('payment methods derive default and setDefault updates', () => {
        const collection = makeCollection([
            { id: 'p1', isDefault: false, label: 'Cash' },
            { id: 'p2', isDefault: true, label: 'Card' },
        ])
        mockUseYjsCollection.mockReturnValue(collection)

        const { result } = renderHook(() => usePaymentMethods())

        expect(result.current.defaultPaymentMethod?.id).toBe('p2')

        act(() => {
            result.current.setDefault('p1')
        })

        expect(collection.update).toHaveBeenCalledWith('p2', { isDefault: false })
        expect(collection.update).toHaveBeenCalledWith('p1', { isDefault: true })
    })

    it('payment methods fall back to the first record when no default is marked', () => {
        const collection = makeCollection([
            { id: 'p1', isDefault: false, label: 'Cash' },
            { id: 'p2', isDefault: false, label: 'Card' },
        ])
        mockUseYjsCollection.mockReturnValue(collection)

        const { result } = renderHook(() => usePaymentMethods())

        expect(result.current.defaultPaymentMethod?.id).toBe('p1')
    })

    it('projects expose active/archived splits and archive helpers', () => {
        const collection = makeCollection([
            { id: 'p1', archived: false },
            { id: 'p2', archived: true },
        ])
        mockUseYjsCollection.mockReturnValue(collection)

        const { result } = renderHook(() => useProjects())

        expect(result.current.activeProjects.map((p) => p.id)).toEqual(['p1'])
        expect(result.current.archivedProjects.map((p) => p.id)).toEqual(['p2'])

        act(() => {
            result.current.archiveProject('p1')
            result.current.unarchiveProject('p2')
        })

        expect(collection.update).toHaveBeenCalledWith(
            'p1',
            expect.objectContaining({
                archived: true,
                archivedOnDate: expect.any(String)
            })
        )
        expect(collection.update).toHaveBeenCalledWith(
            'p2',
            expect.objectContaining({
                archived: false,
                archivedOnDate: null
            })
        )
    })
})
