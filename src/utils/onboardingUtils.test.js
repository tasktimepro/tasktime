import { describe, expect, it, vi } from 'vitest'
import {
    hasCompletedOnboarding,
    ONBOARDING_COMPLETED_KEY,
    resetOnboardingCompleted,
    setOnboardingCompleted,
} from './onboardingUtils.ts'

describe('onboardingUtils', () => {
    it('reads and writes the onboarding completion flag', () => {
        localStorage.getItem.mockReturnValue('true')

        expect(hasCompletedOnboarding()).toBe(true)

        setOnboardingCompleted(false)
        expect(localStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY, 'false')

        resetOnboardingCompleted()
        expect(localStorage.removeItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY)
    })

    it('returns false when storage reads fail', () => {
        localStorage.getItem.mockImplementation(() => {
            throw new Error('storage blocked')
        })

        expect(hasCompletedOnboarding()).toBe(false)
    })

    it('ignores storage write and reset failures', () => {
        localStorage.setItem.mockImplementation(() => {
            throw new Error('storage blocked')
        })
        localStorage.removeItem.mockImplementation(() => {
            throw new Error('storage blocked')
        })

        expect(() => setOnboardingCompleted(true)).not.toThrow()
        expect(() => resetOnboardingCompleted()).not.toThrow()
    })

    it('returns safe defaults when window is unavailable', () => {
        const originalWindow = global.window
        const originalLocalStorage = global.localStorage

        vi.stubGlobal('window', undefined)
        vi.stubGlobal('localStorage', undefined)

        expect(hasCompletedOnboarding()).toBe(false)
        expect(() => setOnboardingCompleted(true)).not.toThrow()
        expect(() => resetOnboardingCompleted()).not.toThrow()

        vi.stubGlobal('window', originalWindow)
        vi.stubGlobal('localStorage', originalLocalStorage)
    })
})