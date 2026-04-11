import { beforeEach, describe, expect, it, vi } from 'vitest'

const renderSpy = vi.fn()
const createRootSpy = vi.fn(() => ({ render: renderSpy }))

vi.mock('./App', () => ({
    default: () => null,
}))

vi.mock('react-dom/client', () => ({
    createRoot: createRootSpy,
}))

describe('main entrypoint', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        document.body.innerHTML = '<div id="root"></div>'
        document.documentElement.style.removeProperty('--viewport-height')

        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: {
                height: 724,
                addEventListener: vi.fn(),
            },
        })

        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: {
                getRegistrations: vi.fn(() => Promise.resolve([])),
            },
        })
    })

    it('registers global error handlers and logs uncaught failures', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        await import('./main.jsx')

        expect(createRootSpy).toHaveBeenCalledWith(document.getElementById('root'))
        expect(renderSpy).toHaveBeenCalled()

        const uncaughtError = new Error('boom')
        window.dispatchEvent(new ErrorEvent('error', {
            message: 'boom',
            error: uncaughtError,
        }))

        const rejectionEvent = new Event('unhandledrejection')
        Object.defineProperty(rejectionEvent, 'reason', {
            configurable: true,
            value: 'nope',
        })
        window.dispatchEvent(rejectionEvent)

        expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, '[TaskTime] Uncaught error:', uncaughtError)
        expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[TaskTime] Unhandled promise rejection:', 'nope')

        consoleErrorSpy.mockRestore()
    })

    it('syncs the viewport height CSS variable from the visual viewport', async () => {
        await import('./main.jsx')

        expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('724px')

        window.visualViewport.height = 680
        window.dispatchEvent(new Event('resize'))

        expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('680px')
    })
})