import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUrlState } from './useUrlState'
import { getWeek, getWeekYear } from 'date-fns'

vi.mock('@/hooks/usePreferences', () => ({
    usePreferences: () => ({
        preferences: { weekStartsOn: 1 },
    })
}))

describe('useUrlState', () => {

    let consoleErrorSpy;

    beforeEach(() => {

        window.history.pushState({}, '', '/')
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {

        consoleErrorSpy?.mockRestore()
    })

    it('parses root path as dashboard view', () => {

        const { result } = renderHook(() => useUrlState())
        expect(result.current.urlParams.view).toBe('dashboard')
    })

    it('parses /projects path correctly', () => {

        window.history.pushState({}, '', '/projects')
        const { result } = renderHook(() => useUrlState())
        expect(result.current.urlParams.view).toBe('projects')
    })

    it('parses planner year and week from URL', () => {

        window.history.pushState({}, '', '/planner/2026/05')
        const { result } = renderHook(() => useUrlState())
        expect(result.current.urlParams.view).toBe('planner')
        expect(result.current.urlParams.year).toBe('2026')
        expect(result.current.urlParams.week).toBe('05')
    })

    it('parses project ID from URL', () => {

        window.history.pushState({}, '', '/projects/my-project-abc123')
        const { result } = renderHook(() => useUrlState())
        expect(result.current.urlParams.view).toBe('projects')
        expect(result.current.urlParams.projectId).toBe('my-project-abc123')
    })

    it('updates URL when view changes', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.updateUrl({ view: 'clients' })
        })

        expect(window.location.pathname).toBe('/clients')
        expect(result.current.urlParams.view).toBe('clients')
    })

    it('builds project path when project ID provided', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.updateUrl({ view: 'projects', project: 'proj-1' })
        })

        expect(window.location.pathname).toBe('/projects/proj-1')
    })

    it('builds client path when client ID provided', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.updateUrl({ view: 'clients', client: 'client-1' })
        })

        expect(window.location.pathname).toBe('/clients/client-1')
    })

    it('adds query params when provided', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.updateUrl({
                view: 'invoices',
                section: 'templates',
                tab: 'email'
            })
        })

        expect(window.location.pathname).toBe('/invoices')
        expect(window.location.search).toContain('section=templates')
        expect(window.location.search).toContain('tab=email')
    })

    it('includes create and preselectedClientId when provided', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.updateUrl({
                view: 'projects',
                create: 'task',
                preselectedClientId: 'client-42'
            })
        })

        expect(window.location.pathname).toBe('/projects')
        expect(window.location.search).toContain('create=task')
        expect(window.location.search).toContain('preselectedClientId=client-42')
    })

    it('omits empty query params', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.updateUrl({
                view: 'invoices',
                section: '',
                tab: '',
                create: '',
                preselectedClientId: ''
            })
        })

        expect(window.location.pathname).toBe('/invoices')
        expect(window.location.search).toBe('')
    })

    it('navigates to invoices with default section', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.navigateToInvoices()
        })

        expect(window.location.pathname).toBe('/invoices')
        expect(window.location.search).toContain('section=invoices')
    })

    it('navigates to invoices without overriding provided section or tab', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.navigateToInvoices({ section: 'templates', tab: 'email' })
        })

        expect(window.location.pathname).toBe('/invoices')
        expect(window.location.search).toContain('section=templates')
        expect(window.location.search).toContain('tab=email')
    })

    it('navigates to account with preferences section', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.navigateToAccount()
        })

        expect(window.location.pathname).toBe('/account')
        expect(window.location.search).toContain('section=preferences')
    })

    it('parses client ID from URL', () => {

        window.history.pushState({}, '', '/clients/client-123')
        const { result } = renderHook(() => useUrlState())
        expect(result.current.urlParams.view).toBe('clients')
        expect(result.current.urlParams.clientId).toBe('client-123')
    })

    it('parses expenses, account, and auth callback paths', () => {

        window.history.pushState({}, '', '/expenses')
        const { result: expensesResult } = renderHook(() => useUrlState())
        expect(expensesResult.current.urlParams.view).toBe('expenses')

        window.history.pushState({}, '', '/account')
        const { result: accountResult } = renderHook(() => useUrlState())
        expect(accountResult.current.urlParams.view).toBe('account')

        window.history.pushState({}, '', '/auth/callback')
        const { result: authResult } = renderHook(() => useUrlState())
        expect(authResult.current.urlParams.view).toBe('auth-callback')
    })

    it('falls back to dashboard path for unknown view', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.updateUrl({ view: 'unknown' })
        })

        expect(window.location.pathname).toBe('/')
    })

    it('navigates to planner with optional year and week', () => {

        const { result } = renderHook(() => useUrlState())
        const today = new Date()
        const defaultYear = String(getWeekYear(today, { weekStartsOn: 1, firstWeekContainsDate: 4 }))
        const defaultWeek = String(getWeek(today, { weekStartsOn: 1, firstWeekContainsDate: 4 }))

        act(() => {
            result.current.navigateToPlanner()
        })

        expect(window.location.pathname).toBe(`/planner/${defaultYear}/${defaultWeek}`)

        act(() => {
            result.current.navigateToPlanner({ year: '2026', week: '05' })
        })

        expect(window.location.pathname).toBe('/planner/2026/05')
    })

    it('navigates to clients, client, expenses, and dashboard', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.navigateToClients()
        })

        expect(window.location.pathname).toBe('/clients')

        act(() => {
            result.current.navigateToClient('client-99')
        })

        expect(window.location.pathname).toBe('/clients/client-99')

        act(() => {
            result.current.navigateToExpenses()
        })

        expect(window.location.pathname).toBe('/expenses')

        act(() => {
            result.current.navigateToDashboard()
        })

        expect(window.location.pathname).toBe('/')
    })
})
