import { beforeEach, describe, expect, it, vi } from 'vitest'

const renderSpy = vi.fn()
const createRootSpy = vi.fn(() => ({ render: renderSpy }))
const initializeDebugBundleSpy = vi.fn()
const captureDebugBundleGlobalErrorSpy = vi.fn()
const captureDebugBundleUnhandledRejectionSpy = vi.fn()

vi.mock('./App', () => ({
    default: () => null,
}))

vi.mock('./utils/debugbundle', () => ({
    initializeDebugBundle: initializeDebugBundleSpy,
    captureDebugBundleGlobalError: captureDebugBundleGlobalErrorSpy,
    captureDebugBundleUnhandledRejection: captureDebugBundleUnhandledRejectionSpy,
}))

vi.mock('react-dom/client', () => ({
    createRoot: createRootSpy,
}))

describe('main entrypoint', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        vi.unstubAllEnvs()
        document.body.innerHTML = '<div id="root"></div>'
        document.documentElement.style.removeProperty('--viewport-height')

        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 900,
        })

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

        Object.defineProperty(navigator, 'maxTouchPoints', {
            configurable: true,
            value: 0,
        })
    })

    it('registers global error handlers and logs uncaught failures', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.stubEnv('PROD', false)

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

        expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, '[TaskTime Pro] Uncaught error:', uncaughtError)
        expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[TaskTime Pro] Unhandled promise rejection:', 'nope')
        expect(initializeDebugBundleSpy).toHaveBeenCalledTimes(1)
        expect(captureDebugBundleGlobalErrorSpy).toHaveBeenCalledWith(uncaughtError, expect.objectContaining({
            message: 'boom',
        }))
        expect(captureDebugBundleUnhandledRejectionSpy).toHaveBeenCalledWith('nope', { type: 'unhandledrejection' })

        consoleErrorSpy.mockRestore()
    })

    it('ignores all CSP violations', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.stubEnv('PROD', true)

        await import('./main.jsx')

        const cspViolationEvent = new Event('securitypolicyviolation')
        Object.defineProperties(cspViolationEvent, {
            blockedURI: { configurable: true, value: 'https://example.com/script.js' },
            disposition: { configurable: true, value: 'enforce' },
            effectiveDirective: { configurable: true, value: 'script-src' },
            sourceFile: { configurable: true, value: 'https://challenge.cloudflare.com/turnstile.js' },
            violatedDirective: { configurable: true, value: 'script-src' },
        })

        window.dispatchEvent(cspViolationEvent)

        expect(consoleErrorSpy).not.toHaveBeenCalledWith('[TaskTime Pro] Content Security Policy violation:', cspViolationEvent)

        consoleErrorSpy.mockRestore()
    })

    it('uses innerHeight for non-touch desktop viewports even when visualViewport exists', async () => {
        await import('./main.jsx')

        expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('900px')

        window.visualViewport.height = 680
        window.dispatchEvent(new Event('resize'))

        expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('900px')
    })

    it('syncs the viewport height CSS variable from the visual viewport on touch devices', async () => {
        Object.defineProperty(navigator, 'maxTouchPoints', {
            configurable: true,
            value: 5,
        })

        await import('./main.jsx')

        expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('724px')

        window.visualViewport.height = 680
        window.dispatchEvent(new Event('resize'))

        expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('680px')
    })

    it('uses innerHeight in standalone PWA mode unless keyboard is open', async () => {
        Object.defineProperty(window.navigator, 'standalone', {
            configurable: true,
            value: true,
        })

        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 844,
        })

        window.visualViewport.height = 810

        await import('./main.jsx')

        // Should use innerHeight (844) since keyboard is not open
        expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('844px')

        // Simulate keyboard opening (visualViewport significantly smaller)
        window.visualViewport.height = 400
        window.dispatchEvent(new Event('resize'))

        expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('400px')
    })
})
