import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consumePostReloadToast, queuePostReloadToast } from './postReloadToast.ts'

describe('postReloadToast', () => {
    const originalWindow = global.window
    const originalSessionStorage = global.sessionStorage

    let sessionStorageMock

    beforeEach(() => {
        sessionStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }

        vi.stubGlobal('window', originalWindow)
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
        vi.stubGlobal('sessionStorage', undefined)

        expect(() => queuePostReloadToast({ level: 'info', message: 'Queued' })).not.toThrow()
        expect(consumePostReloadToast()).toBeNull()

        vi.stubGlobal('window', originalWindow)
        vi.stubGlobal('sessionStorage', originalSessionStorage)
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