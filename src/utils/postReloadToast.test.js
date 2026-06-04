import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumeAppVersionUpdateToast, consumePostReloadToast, queuePostReloadToast } from './postReloadToast.ts'

describe('postReloadToast', () => {
    const originalWindow = global.window
    const originalLocalStorage = global.localStorage
    const originalSessionStorage = global.sessionStorage

    let sessionStorageMock
    let localStorageMock

    beforeEach(() => {
        sessionStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }
        localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }

        vi.stubGlobal('window', originalWindow)
        vi.stubGlobal('localStorage', localStorageMock)
        vi.stubGlobal('sessionStorage', sessionStorageMock)
    })

    it('queues a toast in session storage', () => {
        const toast = {
            level: 'success',
            message: 'Saved',
            duration: 3000,
        }

        queuePostReloadToast(toast)

        expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
            'tasktime-post-reload-toast',
            JSON.stringify(toast)
        )
    })

    it('ignores queue requests when storage writes fail', () => {
        sessionStorageMock.setItem.mockImplementation(() => {
            throw new Error('storage blocked')
        })

        expect(() => queuePostReloadToast({ level: 'error', message: 'Failed' })).not.toThrow()
    })

    it('returns safe defaults when window is unavailable', () => {
        vi.stubGlobal('window', undefined)
        vi.stubGlobal('localStorage', undefined)
        vi.stubGlobal('sessionStorage', undefined)

        expect(() => queuePostReloadToast({ level: 'info', message: 'Queued' })).not.toThrow()
        expect(consumePostReloadToast()).toBeNull()
        expect(consumeAppVersionUpdateToast('1.2.3')).toBeNull()

        vi.stubGlobal('window', originalWindow)
        vi.stubGlobal('localStorage', originalLocalStorage)
        vi.stubGlobal('sessionStorage', originalSessionStorage)
    })

    it('returns null and stores the version on the first seen build', () => {
        localStorageMock.getItem.mockReturnValue(null)

        expect(consumeAppVersionUpdateToast('1.2.3')).toBeNull()
        expect(localStorageMock.setItem).toHaveBeenCalledWith('tasktime-last-seen-app-version', '1.2.3')
    })

    it('returns null when the build version is unchanged', () => {
        localStorageMock.getItem.mockReturnValue('1.2.3')

        expect(consumeAppVersionUpdateToast('1.2.3')).toBeNull()
        expect(localStorageMock.setItem).toHaveBeenCalledWith('tasktime-last-seen-app-version', '1.2.3')
    })

    it('returns a success toast when the build version changed', () => {
        localStorageMock.getItem.mockReturnValue('1.2.2')

        expect(consumeAppVersionUpdateToast('1.2.3')).toEqual({
            level: 'success',
            message: 'TaskTime was updated',
        })
        expect(localStorageMock.setItem).toHaveBeenCalledWith('tasktime-last-seen-app-version', '1.2.3')
    })

    it('returns null when version storage access fails', () => {
        localStorageMock.getItem.mockImplementation(() => {
            throw new Error('storage blocked')
        })

        expect(consumeAppVersionUpdateToast('1.2.3')).toBeNull()
    })

    it('returns null when no queued toast exists', () => {
        sessionStorageMock.getItem.mockReturnValue(null)

        expect(consumePostReloadToast()).toBeNull()
        expect(sessionStorageMock.removeItem).not.toHaveBeenCalled()
    })

    it('consumes and clears a valid queued toast', () => {
        sessionStorageMock.getItem.mockReturnValue(JSON.stringify({
            level: 'warning',
            message: 'Reload required',
            duration: 1500,
        }))

        expect(consumePostReloadToast()).toEqual({
            level: 'warning',
            message: 'Reload required',
            duration: 1500,
        })
        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('tasktime-post-reload-toast')
    })

    it('returns null for invalid queued toast payloads after clearing the stored value', () => {
        sessionStorageMock.getItem.mockReturnValue(JSON.stringify({
            level: 'success',
        }))

        expect(consumePostReloadToast()).toBeNull()
        expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('tasktime-post-reload-toast')
    })

    it('returns null when storage reads or parsing fail', () => {
        sessionStorageMock.getItem.mockImplementationOnce(() => {
            throw new Error('storage blocked')
        })

        expect(consumePostReloadToast()).toBeNull()

        sessionStorageMock.getItem.mockReturnValueOnce('{bad json')

        expect(consumePostReloadToast()).toBeNull()
    })
})
