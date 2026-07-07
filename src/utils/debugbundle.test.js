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
        vi.useRealTimers()
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
        vi.stubEnv('VITE_DEBUGBUNDLE_ENVIRONMENT', undefined)
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
        vi.stubEnv('VITE_DEBUGBUNDLE_ENVIRONMENT', undefined)
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

    it('captures handled incidents with stable metadata and throttling', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-06-04T10:00:00Z'))
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', 'token')

        const { captureDebugBundleIncident, initializeDebugBundle } = await loadDebugBundleModule()

        expect(initializeDebugBundle()).toBe(true)

        const originalError = new Error('drive write failed')

        expect(captureDebugBundleIncident({
            incidentKey: 'drive.delta_upload_failed',
            message: 'TaskTime Pro could not upload a Drive delta update',
            error: originalError,
            context: { docName: 'core' },
            throttleMs: 1_000,
        })).toBe(true)

        expect(captureDebugBundleIncident({
            incidentKey: 'drive.delta_upload_failed',
            message: 'TaskTime Pro could not upload a Drive delta update',
            error: originalError,
            context: { docName: 'core' },
            throttleMs: 1_000,
        })).toBe(false)

        vi.advanceTimersByTime(1_001)

        expect(captureDebugBundleIncident({
            incidentKey: 'drive.delta_upload_failed',
            message: 'TaskTime Pro could not upload a Drive delta update',
            error: originalError,
            context: { docName: 'core' },
            throttleMs: 1_000,
        })).toBe(true)

        expect(captureExceptionSpy).toHaveBeenCalledTimes(2)

        const capturedIncident = captureExceptionSpy.mock.calls[0][0]

        expect(capturedIncident).toMatchObject({
            name: 'TaskTimeHandledIncident',
            message: 'TaskTime Pro could not upload a Drive delta update',
            debugbundleIncidentKey: 'drive.delta_upload_failed',
            debugbundleHandled: true,
            debugbundleContext: { docName: 'core' },
            debugbundleOriginalName: 'Error',
            debugbundleOriginalMessage: 'drive write failed',
        })
    })

    it('captures global browser failures and unhandled rejections with incident keys', async () => {
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', 'token')

        const {
            captureDebugBundleGlobalError,
            captureDebugBundleUnhandledRejection,
            initializeDebugBundle,
        } = await loadDebugBundleModule()

        expect(initializeDebugBundle()).toBe(true)

        captureDebugBundleGlobalError(new Error('boom'), { filename: 'main.jsx' })
        captureDebugBundleUnhandledRejection('nope', { type: 'unhandledrejection' })

        expect(captureExceptionSpy).toHaveBeenCalledTimes(2)
        expect(captureExceptionSpy.mock.calls[0][0].debugbundleIncidentKey).toBe('browser.global_error')
        expect(captureExceptionSpy.mock.calls[1][0].debugbundleIncidentKey).toBe('browser.unhandled_rejection')
    })

    it('swallows sdk capture failures so incident reporting cannot break the app', async () => {
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', 'token')
        captureExceptionSpy.mockImplementation(() => {
            throw new Error('sdk failure')
        })

        const {
            captureDebugBundleException,
            captureDebugBundleIncident,
            initializeDebugBundle,
        } = await loadDebugBundleModule()

        expect(initializeDebugBundle()).toBe(true)
        expect(captureDebugBundleException(new Error('boom'))).toBe(false)
        expect(captureDebugBundleIncident({
            incidentKey: 'drive.sync_failed',
            message: 'TaskTime Pro sync failed',
        })).toBe(false)
    })

    it('allows handled incidents without an original error or context payload', async () => {
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', 'token')
        captureExceptionSpy.mockImplementation(() => undefined)

        const {
            captureDebugBundleIncident,
            initializeDebugBundle,
        } = await loadDebugBundleModule()

        expect(initializeDebugBundle()).toBe(true)
        expect(captureDebugBundleIncident({
            incidentKey: 'drive.sync_failed_repeatedly',
            name: 'TaskTimeDriveSyncError',
            message: 'TaskTime Pro Drive sync failed repeatedly',
        })).toBe(true)

        expect(captureExceptionSpy).toHaveBeenCalledTimes(1)
        expect(captureExceptionSpy.mock.calls[0][0]).toMatchObject({
            name: 'TaskTimeDriveSyncError',
            message: 'TaskTime Pro Drive sync failed repeatedly',
            debugbundleIncidentKey: 'drive.sync_failed_repeatedly',
            debugbundleHandled: true,
        })
        expect(captureExceptionSpy.mock.calls[0][0].debugbundleContext).toBeUndefined()
    })

    it('does not throw when metadata cannot be attached to the original error', async () => {
        vi.stubEnv('VITE_DEBUGBUNDLE_PROJECT_TOKEN', 'token')

        const {
            captureDebugBundleGlobalError,
            initializeDebugBundle,
        } = await loadDebugBundleModule()

        expect(initializeDebugBundle()).toBe(true)

        const frozenError = Object.freeze(new Error('frozen'))

        expect(() => {
            captureDebugBundleGlobalError(frozenError, { filename: 'main.jsx' })
        }).not.toThrow()
        expect(captureExceptionSpy).toHaveBeenCalledWith(frozenError)
    })
})
