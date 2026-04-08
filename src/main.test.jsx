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
})