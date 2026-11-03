import { afterEach, describe, expect, it, vi } from 'vitest'
import { startProductAnalytics, recordProductActivity } from './productAnalytics'

const createSdk = () => ({ analytics: { pageView: vi.fn(), track: vi.fn(), funnel: vi.fn(), convert: vi.fn() } })
let stop = () => {}

afterEach(() => {
    stop()
    window.history.replaceState({}, '', '/')
})

describe('anonymous product analytics', () => {
    it.each([
        ['/', '/'],
        ['/projects', '/projects'],
        ['/projects/private-project?token=secret#private', '/projects/:id'],
        ['/clients/private-client', '/clients/:id'],
        ['/planner/2026/41', '/planner'],
        ['/account?section=billing&session=secret', '/account'],
        ['/invoices/private-invoice', '/invoices'],
        ['/reports?clientId=private', '/reports'],
        ['/expenses?projectId=private', '/expenses'],
        ['/auth/dropbox/callback?code=secret&state=private', '/auth'],
        ['/private-unrecognised-route', '/other'],
    ])('reports only a fixed category for %s', (path, expected) => {
        window.history.replaceState({}, '', path)
        const sdk = createSdk()
        stop = startProductAnalytics(sdk)
        expect(sdk.analytics.pageView).toHaveBeenCalledExactlyOnceWith({ path: expected })
        expect(sdk.analytics.funnel).toHaveBeenCalledExactlyOnceWith('app_activation', 'app_opened')
    })

    it('counts section changes once and removes listeners when stopped', () => {
        const sdk = createSdk()
        stop = startProductAnalytics(sdk)
        window.history.pushState({}, '', '/projects/first-private-id')
        window.dispatchEvent(new Event('locationchange'))
        window.history.replaceState({}, '', '/projects/second-private-id?section=notes')
        window.dispatchEvent(new Event('locationchange'))
        window.history.pushState({}, '', '/reports')
        window.dispatchEvent(new Event('popstate'))
        expect(sdk.analytics.pageView.mock.calls).toEqual([
            [{ path: '/' }], [{ path: '/projects/:id' }], [{ path: '/reports' }],
        ])
        stop()
        window.history.pushState({}, '', '/clients')
        window.dispatchEvent(new Event('locationchange'))
        expect(sdk.analytics.pageView).toHaveBeenCalledTimes(3)
    })

    it('tracks only approved successful actions and an ordered timer funnel without action data', () => {
        const sdk = createSdk()
        stop = startProductAnalytics(sdk)
        for (const action of ['task_create', 'timer_start', 'timer_stop', 'private_client_create', 'toString', undefined]) {
            recordProductActivity(action)
        }
        expect(sdk.analytics.track.mock.calls).toEqual([['task_create'], ['timer_start'], ['timer_stop']])
        expect(sdk.analytics.funnel.mock.calls).toEqual([
            ['app_activation', 'app_opened'], ['app_activation', 'timer_started'], ['app_activation', 'time_recorded'],
        ])
        expect(sdk.analytics.convert).toHaveBeenCalledExactlyOnceWith('tracked_time')
        stop()
        recordProductActivity('task_create')
        expect(sdk.analytics.track).toHaveBeenCalledTimes(3)
    })

    it('isolates SDK failures from navigation and product actions', () => {
        const sdk = createSdk()
        for (const method of Object.values(sdk.analytics)) method.mockImplementation(() => { throw new Error('blocked') })
        expect(() => { stop = startProductAnalytics(sdk) }).not.toThrow()
        expect(() => recordProductActivity('timer_start')).not.toThrow()
        expect(() => {
            window.history.pushState({}, '', '/reports')
            window.dispatchEvent(new Event('locationchange'))
        }).not.toThrow()
    })
})
