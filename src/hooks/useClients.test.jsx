// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useClients } from './useClients'
import { deleteWorkspaceRecords } from '@/stores/yjs/workspaceDeletion'
import { useYjsCollection } from './useYjsCollection'
import { useYjs } from '@/contexts/YjsContext'
import { createTestYMap } from '@/test/yjs-test-helpers'

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))
vi.mock('@/stores/yjs/workspaceDeletion', () => ({ deleteWorkspaceRecords: vi.fn() }))
vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))
const billing = vi.hoisted(() => ({ enabled: false, resolution: { kind: 'unresolved', reason: 'lifecycle' } }))
vi.mock('@/config/billingFeatures', () => ({ BILLING_FEATURES: {
    get clientLimitEnforcement() { return billing.enabled },
} }))
vi.mock('@/contexts/BillingContext', () => ({ useBilling: () => ({ resolution: billing.resolution }) }))

const mockUseYjsCollection = useYjsCollection
const mockUseYjs = useYjs

function setupMocks({ items = [], remove = vi.fn(() => true), plannerAttachments = createTestYMap() } = {}) {
    mockUseYjs.mockReturnValue({
        store: { plannerAttachments },
        isReady: true,
    })
    mockUseYjsCollection.mockReturnValue({
        items,
        isLoading: false,
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        remove,
    })
    return { remove, plannerAttachments }
}

describe('useClients', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        billing.enabled = false
    })

    it('sorts clients by title', () => {
        setupMocks({
            items: [
                { id: 'c2', title: 'Banana' },
                { id: 'c1', title: 'Apple' },
            ],
        })

        const { result } = renderHook(() => useClients())

        expect(result.current.sortedClients.map((c) => c.id)).toEqual(['c1', 'c2'])
    })

    it('rechecks the current plan after waiting for the client mutation lock', async () => {
        billing.enabled = true
        billing.resolution = { kind: 'canonical', snapshot: { accessStatus: 'active' } }
        const clients = createTestYMap({ c1: { id: 'c1', title: 'Existing' } })
        setupMocks()
        mockUseYjs.mockReturnValue({ store: { clients }, isReady: true })
        const create = mockUseYjsCollection().create
        let apply
        const previousLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
        Object.defineProperty(navigator, 'locks', { configurable: true, value: {
            request: vi.fn((_name, _options, callback) => new Promise((resolve, reject) => {
                apply = () => Promise.resolve().then(callback).then(resolve, reject)
            })),
        } })
        try {
            const hook = renderHook(() => useClients())
            const pending = hook.result.current.createClientWithPolicyLock({ title: 'Second' })
            const rejected = expect(pending).rejects.toThrow('ENTITLEMENT_STATUS_UNAVAILABLE')
            billing.resolution = { kind: 'unresolved', reason: 'lifecycle' }
            hook.rerender()
            await act(async () => { await apply(); await rejected })
            expect(create).not.toHaveBeenCalled()
        } finally {
            if (previousLocks) Object.defineProperty(navigator, 'locks', previousLocks)
            else Reflect.deleteProperty(navigator, 'locks')
        }
    })

    it('finds client by name case-insensitively', () => {
        setupMocks({
            items: [
                { id: 'c1', title: 'Acme Corp' },
            ],
        })

        const { result } = renderHook(() => useClients())

        expect(result.current.findByName('acme corp')?.id).toBe('c1')
        expect(result.current.findByName('ACME CORP')?.id).toBe('c1')
        expect(result.current.findByName('nope')).toBeUndefined()
    })

    it('validates client creates and updates', () => {
        const existing = { id: 'c1', title: 'Existing' }
        const get = vi.fn((id) => id === 'c1' ? existing : undefined)
        const create = vi.fn((client) => client)
        const update = vi.fn((id, updates) => ({ ...existing, ...updates, id }))
        mockUseYjs.mockReturnValue({ store: { plannerAttachments: createTestYMap() }, isReady: true })
        mockUseYjsCollection.mockReturnValue({
            items: [existing], isLoading: false, get, create, update, remove: vi.fn(),
        })

        const { result } = renderHook(() => useClients())
        let created
        act(() => {
            created = result.current.createClient({ title: ' New client ' })
        })
        expect(created).toEqual(expect.objectContaining({ title: 'New client', archived: false }))

        act(() => {
            result.current.updateClient('c1', { title: 'Updated' })
        })
        expect(update).toHaveBeenCalledWith('c1', { title: 'Updated' })
        expect(result.current.updateClient('missing', { title: 'Nope' })).toBeUndefined()
        expect(() => result.current.createClient({ title: '   ' })).toThrow('title is required')
        expect(() => result.current.updateClient('c1', { id: 'replacement' })).toThrow(/identity/i)
    })

    it('commits create and restore operations through the policy-lock boundary', async () => {
        const existing = { id: 'c1', title: 'Archived', archived: true }
        const create = vi.fn(client => client)
        const update = vi.fn((id, updates) => ({ ...existing, ...updates, id }))
        mockUseYjs.mockReturnValue({ store: { plannerAttachments: createTestYMap() }, isReady: true })
        mockUseYjsCollection.mockReturnValue({
            items: [existing],
            isLoading: false,
            get: vi.fn(id => id === 'c1' ? existing : undefined),
            create,
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useClients())
        await act(async () => {
            await result.current.createClientWithPolicyLock({ title: 'Created through lock' })
            await result.current.updateClientWithPolicyLock('c1', { archived: false })
        })

        expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Created through lock' }))
        expect(update).toHaveBeenCalledWith('c1', { archived: false })
    })

    it('awaits the shared deletion and passes the explicit invoice choice', async () => {
        setupMocks()
        deleteWorkspaceRecords.mockResolvedValueOnce({})
        const { result } = renderHook(() => useClients())
        await expect(result.current.deleteClient('id', { includeInvoiceDeletion: true })).resolves.toBe(true)
        expect(deleteWorkspaceRecords).toHaveBeenCalledWith(mockUseYjs().store, { kind: 'client', id: 'id', includeInvoiceDeletion: true })
    })

    it('propagates a failed deletion without reporting success', async () => {
        setupMocks()
        deleteWorkspaceRecords.mockRejectedValueOnce(new Error('Unable to persist'))
        const { result } = renderHook(() => useClients())
        await expect(result.current.deleteClient('id')).rejects.toThrow('Unable to persist')
    })
})
