// @ts-nocheck
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePreferences } from './usePreferences'
import { useYjs } from '@/contexts/YjsContext'

vi.mock('@/contexts/YjsContext', () => ({ useYjs: vi.fn() }))

const mockUseYjs = useYjs

function createPreferencesMap(initial = {}) {
    const map = new Map(Object.entries(initial))
    const observers = new Set()

    return {
        set: vi.fn((key, value) => {
            map.set(key, value)
            observers.forEach((fn) => fn())
        }),
        forEach: (cb) => map.forEach((value, key) => cb(value, key)),
        observe: (fn) => observers.add(fn),
        unobserve: (fn) => observers.delete(fn),
    }
}

describe('usePreferences', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not write preferences when not ready', () => {

        const preferences = createPreferencesMap({ currency: 'USD' })
        mockUseYjs.mockReturnValue({ store: { preferences }, isReady: false })

        const { result } = renderHook(() => usePreferences())

        expect(result.current.isLoading).toBe(true)

        act(() => {
            result.current.setPreference('currency', 'GBP')
            result.current.updatePreferences({ currency: 'GBP', timeFormat: undefined })
            result.current.resetPreferences()
        })

        expect(preferences.set).not.toHaveBeenCalled()
    })

    it('syncs and updates preferences when ready', async () => {

        const preferences = createPreferencesMap({ currency: 'USD', showCompletedTasks: false })
        mockUseYjs.mockReturnValue({ store: { preferences }, isReady: true })

        const { result } = renderHook(() => usePreferences())

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.preferences.currency).toBe('USD')
        expect(result.current.preferences.showCompletedTasks).toBe(false)

        act(() => {
            result.current.updatePreferences({ currency: 'GBP', timeFormat: undefined })
        })

        expect(preferences.set).toHaveBeenCalledWith('currency', 'GBP')
        expect(preferences.set.mock.calls.some(([key]) => key === 'timeFormat')).toBe(false)

        act(() => {
            result.current.resetPreferences()
        })

        expect(preferences.set).toHaveBeenCalledWith('currency', 'EUR')
    })
})
