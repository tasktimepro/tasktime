import { describe, expect, it, vi } from 'vitest'
import {
    hasCompletedOnboarding,
    hasPendingOnboarding,
    ONBOARDING_COMPLETED_KEY,
    ONBOARDING_PENDING_KEY,
    resetOnboardingCompleted,
    setOnboardingCompleted,
    setOnboardingPending,
} from './onboardingUtils.ts'

describe('onboardingUtils', () => {
    it('reads and writes the onboarding completion flag', () => {
        localStorage.getItem.mockReturnValue('true')

        expect(hasCompletedOnboarding()).toBe(true)

        setOnboardingCompleted(true)
        expect(localStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY, 'true')
        expect(localStorage.removeItem).toHaveBeenCalledWith(ONBOARDING_PENDING_KEY)
    })

    it('reads and writes the onboarding pending flag', () => {
        localStorage.getItem.mockReturnValue('true')

        expect(hasPendingOnboarding()).toBe(true)

        setOnboardingPending(true)
        expect(localStorage.setItem).toHaveBeenCalledWith(ONBOARDING_PENDING_KEY, 'true')
    })

    it('resets both onboarding flags', () => {
        resetOnboardingCompleted()

        expect(localStorage.removeItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY)
        expect(localStorage.removeItem).toHaveBeenCalledWith(ONBOARDING_PENDING_KEY)
    })

    it('returns false when storage reads fail', () => {
        localStorage.getItem.mockImplementation(() => {
            throw new Error('storage blocked')
        })

        expect(hasCompletedOnboarding()).toBe(false)
        expect(hasPendingOnboarding()).toBe(false)
    })

    it('ignores storage write and reset failures', () => {
        localStorage.setItem.mockImplementation(() => {
            throw new Error('storage blocked')
        })
        localStorage.removeItem.mockImplementation(() => {
            throw new Error('storage blocked')
        })

        expect(() => setOnboardingCompleted(true)).not.toThrow()
        expect(() => setOnboardingPending(true)).not.toThrow()
        expect(() => resetOnboardingCompleted()).not.toThrow()
    })

    it('returns safe defaults when window is unavailable', () => {
        const originalWindow = global.window
        const originalLocalStorage = global.localStorage

        vi.stubGlobal('window', undefined)
        vi.stubGlobal('localStorage', undefined)

        expect(hasCompletedOnboarding()).toBe(false)
        expect(hasPendingOnboarding()).toBe(false)
        expect(() => setOnboardingCompleted(true)).not.toThrow()
        expect(() => setOnboardingPending(true)).not.toThrow()
        expect(() => resetOnboardingCompleted()).not.toThrow()

        vi.stubGlobal('window', originalWindow)
        vi.stubGlobal('localStorage', originalLocalStorage)
    })
})