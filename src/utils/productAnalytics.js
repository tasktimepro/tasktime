/** Anonymous section views and fixed action categories; never accepts work records. */
const SECTIONS = new Set(['planner', 'projects', 'clients', 'invoices', 'reports', 'expenses', 'account', 'auth'])
const ACTIONS = new Set([
    'project_create', 'client_create', 'task_create', 'invoice_create',
    'timer_start', 'timer_pause', 'timer_resume', 'timer_stop', 'time_entry_create',
])

let analytics = null
let stopActiveAnalytics = () => {}

/** Collapse record IDs, dates and unknown paths before calling the SDK. */
function getSectionPath() {
    const parts = window.location.pathname.split('/').filter(Boolean)
    const section = parts[0]

    if (!section) return '/'
    if (!SECTIONS.has(section)) return '/other'
    if ((section === 'projects' || section === 'clients') && parts.length > 1) return `/${section}/:id`
    return `/${section}`
}

/** Start after production SDK initialization. All navigation uses explicit safe paths. */
export function startProductAnalytics(sdk) {
    stopActiveAnalytics()
    analytics = sdk.analytics
    let lastPath = null

    const captureSection = () => {
        try {
            const path = getSectionPath()
            if (path === lastPath) return
            analytics.pageView({ path })
            lastPath = path
        } catch {
            // Analytics cannot interrupt navigation, including when blocked.
        }
    }

    captureSection()
    try {
        analytics.funnel('app_activation', 'app_opened')
    } catch {
        // Analytics cannot interrupt startup.
    }
    window.addEventListener('locationchange', captureSection)
    window.addEventListener('popstate', captureSection)

    stopActiveAnalytics = () => {
        window.removeEventListener('locationchange', captureSection)
        window.removeEventListener('popstate', captureSection)
        analytics = null
    }
    return stopActiveAnalytics
}

/** Forward only existing successful mutation categories, without IDs or dimensions. */
export function recordProductActivity(action) {
    if (!analytics || !ACTIONS.has(action)) return

    try {
        analytics.track(action)
        if (action === 'timer_start') analytics.funnel('app_activation', 'timer_started')
        if (action === 'timer_stop') {
            analytics.funnel('app_activation', 'time_recorded')
            analytics.convert('tracked_time')
        }
    } catch {
        // Optional reporting cannot affect a successful user action.
    }
}
