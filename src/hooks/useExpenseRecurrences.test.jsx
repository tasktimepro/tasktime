// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useExpenseRecurrences } from './useExpenseRecurrences'
import { useYjsCollection } from './useYjsCollection'
import { getPendingPeriods, buildExpenseFromRecurrence } from '@/utils/expenseUtils'

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }))
vi.mock('@/utils/expenseUtils', () => ({
    getPendingPeriods: vi.fn(),
    buildExpenseFromRecurrence: vi.fn(),
}))

const mockUseYjsCollection = useYjsCollection

const baseRecurrence = {
    id: 'r1',
    title: 'Rent',
    note: null,
    supplierName: null,
    currency: 'EUR',
    amount: 1200,
    amountType: 'fixed',
    repeat: 'monthly',
    startDate: '2025-01-01',
    endDate: null,
    clientId: null,
    projectId: null,
    isPersonal: true,
    billable: false,
    taxNumber: null,
    isTaxExempt: false,
    lastGeneratedDate: null,
    active: true,
}

describe('useExpenseRecurrences', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('filters active recurrences', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [baseRecurrence, { ...baseRecurrence, id: 'r2', active: false }],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenseRecurrences())
        expect(result.current.activeRecurrences.map((r) => r.id)).toEqual(['r1'])
    })

    it('generatePendingExpenses creates expenses and updates lastGeneratedDate', async () => {
        const update = vi.fn()
        const createExpense = vi.fn()

        getPendingPeriods.mockReturnValue(['2025-02-01', '2025-03-01'])
        buildExpenseFromRecurrence.mockImplementation((recurrence, dateValue) => ({
            id: `det-${recurrence.id}-${dateValue}`,
            title: recurrence.title,
            date: dateValue,
        }))

        mockUseYjsCollection.mockReturnValue({
            items: [baseRecurrence],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenseRecurrences())

        await act(async () => {
            await result.current.generatePendingExpenses(createExpense)
        })

        expect(createExpense).toHaveBeenCalledTimes(2)
        expect(update).toHaveBeenCalledWith('r1', { lastGeneratedDate: '2025-03-01' })
    })

    it('skips expenses that already exist when existingExpenseIds provided', async () => {
        const update = vi.fn()
        const createExpense = vi.fn()

        getPendingPeriods.mockReturnValue(['2025-02-01', '2025-03-01'])
        buildExpenseFromRecurrence.mockImplementation((recurrence, dateValue) => ({
            id: `det-${recurrence.id}-${dateValue}`,
            title: recurrence.title,
            date: dateValue,
        }))

        mockUseYjsCollection.mockReturnValue({
            items: [baseRecurrence],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenseRecurrences())

        const existingIds = new Set(['det-r1-2025-02-01'])

        await act(async () => {
            await result.current.generatePendingExpenses(createExpense, existingIds)
        })

        expect(createExpense).toHaveBeenCalledTimes(1)
        expect(createExpense).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'det-r1-2025-03-01' })
        )
        expect(update).toHaveBeenCalledWith('r1', { lastGeneratedDate: '2025-03-01' })
    })

    it('skips updates when there are no pending dates', async () => {
        const update = vi.fn()
        const createExpense = vi.fn()

        getPendingPeriods.mockReturnValue([])

        mockUseYjsCollection.mockReturnValue({
            items: [baseRecurrence],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenseRecurrences())

        await act(async () => {
            await result.current.generatePendingExpenses(createExpense)
        })

        expect(createExpense).not.toHaveBeenCalled()
        expect(update).not.toHaveBeenCalled()
    })

    it('does not advance the recurrence cursor when expense creation fails', async () => {
        const update = vi.fn()
        const createExpense = vi.fn()
            .mockResolvedValueOnce({ id: 'det-r1-2025-02-01' })
            .mockRejectedValueOnce(new Error('Exchange rates unavailable'))

        getPendingPeriods.mockReturnValue(['2025-02-01', '2025-03-01'])
        buildExpenseFromRecurrence.mockImplementation((recurrence, dateValue) => ({
            id: `det-${recurrence.id}-${dateValue}`,
            title: recurrence.title,
            date: dateValue,
        }))
        mockUseYjsCollection.mockReturnValue({
            items: [baseRecurrence],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenseRecurrences())

        await expect(result.current.generatePendingExpenses(createExpense))
            .rejects.toThrow('Exchange rates unavailable')
        expect(update).not.toHaveBeenCalled()
    })

    it('pauses and resumes recurrences', () => {
        const update = vi.fn()

        mockUseYjsCollection.mockReturnValue({
            items: [baseRecurrence],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove: vi.fn(),
        })

        const { result } = renderHook(() => useExpenseRecurrences())

        act(() => {
            result.current.pauseRecurrence('r1')
            result.current.resumeRecurrence('r1')
        })

        expect(update).toHaveBeenCalledWith('r1', { active: false })
        expect(update).toHaveBeenCalledWith('r1', { active: true })
    })
})
