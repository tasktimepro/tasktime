import { beforeEach, describe, expect, it, vi } from 'vitest'

const initSpy = vi.fn()
const captureExceptionSpy = vi.fn()

vi.mock('@debugbundle/sdk-browser', () => ({
    createDebugBundleBrowserSdk: () => ({
        init: initSpy,
        captureException: captureExceptionSpy,
    }),
}))

async function loadDebugBundleModule() {
    return import('./debugbundle')
}

describe('debugbundle utility', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    it('does not initialize when the project token is missing or blank', async () => {
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', undefined)

        const { initializeDebugBundle } = await loadDebugBundleModule()

        expect(initializeDebugBundle()).toBe(false)
        expect(initSpy).not.toHaveBeenCalled()

        vi.resetModules()
        vi.clearAllMocks()
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', '   ')

        const { initializeDebugBundle: initializeWithBlankToken } = await loadDebugBundleModule()

        expect(initializeWithBlankToken()).toBe(false)
        expect(initSpy).not.toHaveBeenCalled()
    })

    it('initializes once with a trimmed token and configured environment', async () => {
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', '  project-token  ')
        vi.stubEnv('VITE_DEBUGBUNDLE_ENVIRONMENT', '  staging  ')

        const { initializeDebugBundle } = await loadDebugBundleModule()

        expect(initializeDebugBundle()).toBe(true)
        expect(initializeDebugBundle()).toBe(false)
        expect(initSpy).toHaveBeenCalledTimes(1)
        expect(initSpy).toHaveBeenCalledWith({
            projectToken: 'project-token',
            environment: 'staging',
            service: 'tasktime-web',
        })
    })

    it('falls back to development and production environments when none is configured', async () => {
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', 'token')
        vi.stubEnv('PROD', false)

        let debugBundleModule = await loadDebugBundleModule()

        expect(debugBundleModule.initializeDebugBundle()).toBe(true)
        expect(initSpy).toHaveBeenLastCalledWith({
            projectToken: 'token',
            environment: 'development',
            service: 'tasktime-web',
        })

        vi.resetModules()
        vi.clearAllMocks()
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', 'token')
        vi.stubEnv('PROD', true)

        debugBundleModule = await loadDebugBundleModule()

        expect(debugBundleModule.initializeDebugBundle()).toBe(true)
        expect(initSpy).toHaveBeenLastCalledWith({
            projectToken: 'token',
            environment: 'production',
            service: 'tasktime-web',
        })
    })

    it('captures exceptions only after initialization and with a non-null error', async () => {
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', 'token')

        const { captureDebugBundleException, initializeDebugBundle } = await loadDebugBundleModule()
        const error = new Error('boom')

        captureDebugBundleException(error)
        captureDebugBundleException(null)

        expect(captureExceptionSpy).not.toHaveBeenCalled()

        expect(initializeDebugBundle()).toBe(true)

        captureDebugBundleException(null)
        captureDebugBundleException(error)

        expect(captureExceptionSpy).toHaveBeenCalledTimes(1)
        expect(captureExceptionSpy).toHaveBeenCalledWith(error)
    })
})