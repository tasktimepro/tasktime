import { useState, useEffect, useCallback, useMemo } from 'react';
import { getWeek, getWeekYear } from 'date-fns';
import { usePreferences } from '@/hooks/usePreferences';

type ViewName = 'dashboard' | 'planner' | 'projects' | 'clients' | 'invoices' | 'reports' | 'expenses' | 'account' | 'auth-callback';

type UrlParams = {
    view: ViewName;
    projectId: string | null;
    clientId: string | null;
    section: string | null;
    year: string | null;
    week: string | null;
    create: string | null;
    tab: string | null;
    preselectedClientId: string | null;
    expenseClientId: string | null;
    expenseProjectId: string | null;
};

type UrlUpdateParams = Partial<{
    view: ViewName;
    project: string | null;
    client: string | null;
    section: string | null;
    year: string | null;
    week: string | null;
    create: string | null;
    tab: string | null;
    preselectedClientId: string | null;
    expenseClientId: string | null;
    expenseProjectId: string | null;
}>;

/**
 * Parse URL path and search params into state object
 * Supports paths like: /, /projects, /projects/abc123, /clients, /clients/xyz789, /invoices, /reports, /expenses, /account
 */
function getParamsFromUrl(): UrlParams {
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    // Parse the pathname to extract view and IDs
    const pathParts = pathname.split('/').filter(Boolean); // Remove empty strings

    let view: ViewName = 'dashboard';
    let projectId: string | null = null;
    let clientId: string | null = null;
    let year: string | null = null;
    let week: string | null = null;

    if (pathParts.length === 0 || pathname === '/') {
        view = 'dashboard';
    } else {
        const firstPart = pathParts[0];

        switch (firstPart) {
            case 'planner':
                view = 'planner';
                if (pathParts[1] && pathParts[2]) {
                    year = pathParts[1];
                    week = pathParts[2];
                }
                break;
            case 'projects':
                view = 'projects';
                if (pathParts[1]) {
                    projectId = pathParts[1];
                }
                break;
            case 'clients':
                view = 'clients';
                if (pathParts[1]) {
                    clientId = pathParts[1];
                }
                break;
            case 'invoices':
                view = 'invoices';
                break;
            case 'reports':
                view = 'reports';
                break;
            case 'expenses':
                view = 'expenses';
                break;
            case 'account':
                view = 'account';
                break;
            case 'auth':
                // Handle /auth/callback path
                if (pathParts[1] === 'callback') {
                    view = 'auth-callback';
                }
                break;
            default:
                view = 'dashboard';
        }
    }

    return {
        view,
        projectId,
        clientId,
        section: params.get('section') || null,
        year,
        week,
        create: params.get('create') || null,
        tab: params.get('tab') || null,
        preselectedClientId: params.get('preselectedClientId') || null,
        expenseClientId: params.get('clientId') || null,
        expenseProjectId: params.get('projectId') || null
    };
}

// Monkey-patch pushState/replaceState to fire a custom event
(function () {
    if (typeof window === 'undefined') return;
    const origPushState = window.history.pushState.bind(window.history);
    const origReplaceState = window.history.replaceState.bind(window.history);
    window.history.pushState = function (...args) {
        const ret = origPushState(...args);
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    };
    window.history.replaceState = function (...args) {
        const ret = origReplaceState(...args);
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    };
    window.addEventListener('popstate', () => {
        window.dispatchEvent(new Event('locationchange'));
    });
})();

export const useUrlState = () => {
    const [urlParams, setUrlParams] = useState(getParamsFromUrl);
    const { preferences } = usePreferences();
    const weekStartsOn = useMemo(
        () => (typeof preferences.weekStartsOn === 'number' ? preferences.weekStartsOn : 1),
        [preferences.weekStartsOn]
    );
    const firstWeekContainsDate = useMemo<1 | 4>(
        () => (weekStartsOn === 1 ? 4 : 1),
        [weekStartsOn]
    );
    const weekOptions = useMemo(
        () => ({ weekStartsOn, firstWeekContainsDate }),
        [weekStartsOn, firstWeekContainsDate]
    );

    // Always update state from URL on any navigation
    useEffect(() => {
        const handler = () => setUrlParams(getParamsFromUrl());
        window.addEventListener('locationchange', handler);
        return () => window.removeEventListener('locationchange', handler);
    }, []);

    /**
     * Build URL from path and optional query params
     */
    const buildUrl = useCallback((path: string, queryParams: Record<string, string | null | undefined> = {}) => {
        const searchParams = new URLSearchParams();

        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                searchParams.set(key, value);
            }
        });

        const queryString = searchParams.toString();
        return queryString ? `${path}?${queryString}` : path;
    }, []);

    /**
     * Update URL and state - now uses path-based routing
     * Merges with current state when partial params are provided
     */
    const updateUrl = useCallback((newParams: UrlUpdateParams) => {
        // Get current state to merge with
        const currentState = getParamsFromUrl();

        // Merge new params with current state
        // If view is not provided, keep current view
        const mergedParams = {
            view: currentState.view,
            project: currentState.projectId,
            client: currentState.clientId,
            section: currentState.section,
            year: currentState.year,
            week: currentState.week,
            create: currentState.create,
            tab: currentState.tab,
            preselectedClientId: currentState.preselectedClientId,
            expenseClientId: currentState.expenseClientId,
            expenseProjectId: currentState.expenseProjectId,
            ...newParams
        };

        // Build the new path based on view and IDs
        let path = '/';
        const queryParams: Record<string, string> = {};

        const view = mergedParams.view || 'dashboard';

        switch (view) {
            case 'planner':
                if (mergedParams.year && mergedParams.week) {
                    path = `/planner/${mergedParams.year}/${mergedParams.week}`;
                } else {
                    path = '/planner';
                }
                break;
            case 'projects':
                if (mergedParams.project) {
                    path = `/projects/${mergedParams.project}`;
                } else {
                    path = '/projects';
                }
                break;
            case 'clients':
                if (mergedParams.client) {
                    path = `/clients/${mergedParams.client}`;
                } else {
                    path = '/clients';
                }
                break;
            case 'invoices':
                path = '/invoices';
                break;
            case 'reports':
                path = '/reports';
                break;
            case 'expenses':
                path = '/expenses';
                break;
            case 'account':
                path = '/account';
                break;
            default:
                path = '/';
        }

        // Add optional query params (section, create, tab, preselectedClientId)
        // Only add if truthy (not null/undefined/empty)
        if (mergedParams.section) queryParams.section = mergedParams.section;
        if (mergedParams.create) queryParams.create = mergedParams.create;
        if (mergedParams.tab) queryParams.tab = mergedParams.tab;
        if (mergedParams.preselectedClientId) queryParams.preselectedClientId = mergedParams.preselectedClientId;
        if (mergedParams.expenseClientId) queryParams.clientId = mergedParams.expenseClientId;
        if (mergedParams.expenseProjectId) queryParams.projectId = mergedParams.expenseProjectId;

        const newUrl = buildUrl(path, queryParams);

        // Update URL and state
        window.history.pushState({}, '', newUrl);

        // Create new state object to force re-render
        const newState = getParamsFromUrl();
        setUrlParams(newState);
    }, [buildUrl]);

    /**
     * Navigate to projects view
     * @param {Object} params - Optional parameters to include in URL
     */
    const navigateToProjects = useCallback((params: UrlUpdateParams = {}) => {
        updateUrl({ view: 'projects', client: null, project: null, section: null, year: null, week: null, create: null, tab: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to project dashboard
     */
    const navigateToProject = useCallback((projectId: string) => {
        updateUrl({ view: 'projects', client: null, project: projectId, section: null, year: null, week: null, create: null, tab: null });
    }, [updateUrl]);

    /**
     * Navigate to invoices view with optional parameters
     */
    const navigateToInvoices = useCallback((params: UrlUpdateParams = {}) => {
        // Ensure we clear section if not specified
        const finalParams: UrlUpdateParams = { view: 'invoices', client: null, project: null, year: null, week: null, ...params };
        // If no section is specified, set it to the default (invoices)
        if (!('section' in params)) {
            finalParams.section = 'invoices';
        }
        // If no tab is specified in params, explicitly clear it
        if (!('tab' in params)) {
            finalParams.tab = null;
        }
        updateUrl(finalParams);
    }, [updateUrl]);

    /**
     * Navigate to expenses view
     */
    const navigateToExpenses = useCallback((params: UrlUpdateParams = {}) => {
        updateUrl({ view: 'expenses', client: null, project: null, section: null, year: null, week: null, create: null, tab: null, expenseClientId: null, expenseProjectId: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to reports view with optional parameters
     */
    const navigateToReports = useCallback((params: UrlUpdateParams = {}) => {
        const finalParams: UrlUpdateParams = {
            view: 'reports',
            client: null,
            project: null,
            year: null,
            week: null,
            create: null,
            tab: null,
            expenseClientId: null,
            expenseProjectId: null,
            ...params
        };

        if (!('section' in params)) {
            finalParams.section = 'overview';
        }

        if (!('tab' in params)) {
            finalParams.tab = null;
        }

        updateUrl(finalParams);
    }, [updateUrl]);

    /**
     * Navigate to account view with optional parameters
     */
    const navigateToAccount = useCallback((params: UrlUpdateParams = {}) => {
        updateUrl({ view: 'account', client: null, project: null, tab: null, section: 'preferences', year: null, week: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to main dashboard view
     */
    const navigateToDashboard = useCallback((params: UrlUpdateParams = {}) => {
        updateUrl({ view: 'dashboard', client: null, project: null, section: null, year: null, week: null, create: null, tab: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to planner view
     */
    const navigateToPlanner = useCallback((params: UrlUpdateParams = {}) => {
        const shouldDefaultWeek = !('year' in params) && !('week' in params);
        const today = new Date();
        const defaultYear = String(getWeekYear(today, weekOptions));
        const defaultWeek = String(getWeek(today, weekOptions));

        updateUrl({
            view: 'planner',
            client: null,
            project: null,
            section: null,
            year: shouldDefaultWeek ? defaultYear : null,
            week: shouldDefaultWeek ? defaultWeek : null,
            create: null,
            tab: null,
            ...params
        });
    }, [updateUrl, weekOptions]);

    /**
     * Navigate to clients view with optional parameters
     */
    const navigateToClients = useCallback((params: UrlUpdateParams = {}) => {
        updateUrl({ view: 'clients', client: null, project: null, section: null, year: null, week: null, create: null, tab: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to client dashboard
     */
    const navigateToClient = useCallback((clientId: string) => {
        updateUrl({ view: 'clients', client: clientId, project: null, section: null, year: null, week: null, create: null, tab: null });
    }, [updateUrl]);

    return {
        urlParams,
        navigateToProjects,
        navigateToProject,
        navigateToClients,
        navigateToClient,
        navigateToInvoices,
        navigateToReports,
        navigateToExpenses,
        navigateToAccount,
        navigateToDashboard,
        navigateToPlanner,
        updateUrl
    };
};
