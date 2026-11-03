import { afterEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { createDebugBundleBrowserSdk } from '@debugbundle/sdk-browser'
import { startProductAnalytics, recordProductActivity } from './productAnalytics'

let sdk
let stop = () => {}

afterEach(() => {
    stop()
    sdk?.dispose()
    window.history.replaceState({}, '', '/')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

it('sends safe SDK analytics and reuses only a project-scoped visitor hash across page sessions', async () => {
    const events = []
    const stored = new Map()
    vi.stubGlobal('crypto', webcrypto)
    vi.stubGlobal('localStorage', {
        getItem: key => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, value),
        removeItem: key => stored.delete(key),
    })
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
        const batch = options?.body ? JSON.parse(options.body).events ?? [] : []
        events.push(...batch)
        return new Response(JSON.stringify({ accepted: batch.length, rejected: 0, errors: [] }), { status: 200 })
    }))
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://tasktime.pro/pricing/?private=referrer-secret')
    window.history.replaceState({}, '', '/projects/private-client-name?code=oauth-secret&utm_source=newsletter&utm_medium=email&utm_campaign=autumn#private-note')
    const initialize = (projectToken = 'dbundle_proj_synthetic_analytics_fixture') => {
        sdk = createDebugBundleBrowserSdk()
        sdk.init({
            projectToken,
            service: 'tasktime-app', environment: 'test', captureClicks: false, captureNetwork: false,
            captureRouteChanges: false, tracePropagationTargets: [],
            analytics: {
                enabled: true, privacyMode: 'standard', consentRequired: false, trackPageViews: false, trackRouteChanges: false,
                trackSessions: true, trackReferrers: true, trackActions: false,
                trackFrictionSignals: false, journeySampleRate: 0,
            },
            transport: async request => {
                events.push(...request.events)
                return { status: 200, body: { accepted: request.events.length, rejected: 0, errors: [] } }
            },
        })
        stop = startProductAnalytics(sdk)
    }
    const waitForAnalytics = async () => {
        await vi.waitFor(async () => {
            await sdk.flush()
            expect(events.some(event => event.event_type === 'analytics_event')).toBe(true)
        })
        return events.filter(event => event.event_type === 'analytics_event')
    }
    initialize()
    await waitForAnalytics()
    recordProductActivity('task_create')
    recordProductActivity('timer_start')
    recordProductActivity('timer_stop')
    window.history.pushState({}, '', '/clients/private-email@example.com?token=private-token')
    window.dispatchEvent(new Event('locationchange'))
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }))
    await sdk.flush()

    const analytics = events.filter(event => event.event_type === 'analytics_event')
    expect(analytics.length).toBeGreaterThanOrEqual(10)
    expect(analytics.filter(event => event.payload.kind === 'page_view').map(event => event.payload.route.path))
        .toEqual(['/projects/:id', '/clients/:id'])
    expect(analytics.map(event => event.payload.kind)).toContain('session_summary')
    expect(analytics.map(event => event.payload.signal.step_key).filter(Boolean))
        .toEqual(['app_opened', 'timer_started', 'time_recorded'])
    for (const event of analytics) {
        expect(event.correlation.visitor_id_hash).toMatch(/^sha256:[a-f0-9]{64}$/)
        expect(event.correlation.user_id_hash).toBeNull()
        expect(event.payload.custom_dimensions).toEqual({})
        expect(event.payload.dimensions.referrer_domain).toBe('tasktime.pro')
    }
    expect(analytics.find(event => event.payload.kind === 'page_view').payload.dimensions).toMatchObject({
        utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'autumn',
    })
    expect(analytics.at(-1).payload.dimensions.utm_source).toBeNull()
    expect(JSON.stringify(analytics)).not.toMatch(/private-client|oauth-secret|private-note|private-email|private-token|referrer-secret/)
    expect(stored.size).toBe(1)
    const visitorHash = analytics[0].correlation.visitor_id_hash
    const sessionId = analytics[0].correlation.session_id
    expect(new Set(analytics.map(event => event.correlation.visitor_id_hash))).toEqual(new Set([visitorHash]))
    expect(JSON.stringify(events)).not.toContain([...stored.values()][0])

    stop()
    sdk.dispose()
    events.length = 0
    initialize()
    const reloaded = await waitForAnalytics()
    expect(reloaded[0].correlation.visitor_id_hash).toBe(visitorHash)
    expect(reloaded[0].correlation.session_id).not.toBe(sessionId)
    expect(stored.size).toBe(1)

    stop()
    sdk.dispose()
    events.length = 0
    initialize('dbundle_proj_synthetic_separate_project')
    const separateProject = await waitForAnalytics()
    expect(separateProject[0].correlation.visitor_id_hash).not.toBe(visitorHash)
    expect(stored.size).toBe(2)
})
