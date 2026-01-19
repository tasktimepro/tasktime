import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUrlState } from './useUrlState'

describe('useUrlState', () => {

    beforeEach(() => {

        window.history.pushState({}, '', '/')
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

    it('navigates to invoices with default section', () => {

        const { result } = renderHook(() => useUrlState())

        act(() => {
            result.current.navigateToInvoices()
        })

        expect(window.location.pathname).toBe('/invoices')
        expect(window.location.search).toContain('section=invoices')
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
})
