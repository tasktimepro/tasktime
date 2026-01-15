import { useState, useEffect, useCallback } from 'react';

/**
 * Parse URL path and search params into state object
 * Supports paths like: /, /projects, /projects/abc123, /clients, /clients/xyz789, /invoices, /account
 */
function getParamsFromUrl() {
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    // Parse the pathname to extract view and IDs
    const pathParts = pathname.split('/').filter(Boolean); // Remove empty strings
    
    let view = 'dashboard';
    let projectId = null;
    let clientId = null;
    
    if (pathParts.length === 0 || pathname === '/') {
        view = 'dashboard';
    } else {
        const firstPart = pathParts[0];
        
        switch (firstPart) {
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
            case 'account':
                view = 'account';
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
        create: params.get('create') || null,
        tab: params.get('tab') || null,
        preselectedClientId: params.get('preselectedClientId') || null
    };
}

// Monkey-patch pushState/replaceState to fire a custom event
(function() {
    if (typeof window === 'undefined') return;
    const origPushState = window.history.pushState;
    const origReplaceState = window.history.replaceState;
    window.history.pushState = function(...args) {
        const ret = origPushState.apply(this, args);
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    };
    window.history.replaceState = function(...args) {
        const ret = origReplaceState.apply(this, args);
        window.dispatchEvent(new Event('locationchange'));
        return ret;
    };
    window.addEventListener('popstate', () => {
        window.dispatchEvent(new Event('locationchange'));
    });
})();

export const useUrlState = () => {
    const [urlParams, setUrlParams] = useState(getParamsFromUrl);

    // Always update state from URL on any navigation
    useEffect(() => {
        const handler = () => setUrlParams(getParamsFromUrl());
        window.addEventListener('locationchange', handler);
        return () => window.removeEventListener('locationchange', handler);
    }, []);

    /**
     * Build URL from path and optional query params
     */
    const buildUrl = useCallback((path, queryParams = {}) => {
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
    const updateUrl = useCallback((newParams) => {
        // Get current state to merge with
        const currentState = getParamsFromUrl();
        
        // Merge new params with current state
        // If view is not provided, keep current view
        const mergedParams = {
            view: currentState.view,
            project: currentState.projectId,
            client: currentState.clientId,
            section: currentState.section,
            create: currentState.create,
            tab: currentState.tab,
            preselectedClientId: currentState.preselectedClientId,
            ...newParams
        };
        
        // Build the new path based on view and IDs
        let path = '/';
        const queryParams = {};
        
        const view = mergedParams.view || 'dashboard';
        
        switch (view) {
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
    const navigateToProjects = useCallback((params = {}) => {
        updateUrl({ view: 'projects', client: null, project: null, section: null, create: null, tab: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to project dashboard
     */
    const navigateToProject = useCallback((projectId) => {
        updateUrl({ view: 'projects', client: null, project: projectId, section: null, create: null, tab: null });
    }, [updateUrl]);

    /**
     * Navigate to invoices view with optional parameters
     */
    const navigateToInvoices = useCallback((params = {}) => {
        // Ensure we clear section if not specified
        const finalParams = { view: 'invoices', client: null, project: null, ...params };
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
     * Navigate to account view with optional parameters
     */
    const navigateToAccount = useCallback((params = {}) => {
        updateUrl({ view: 'account', client: null, project: null, tab: null, section: 'preferences', ...params });
    }, [updateUrl]);

    /**
     * Navigate to main dashboard view
     */
    const navigateToDashboard = useCallback((params = {}) => {
        updateUrl({ view: 'dashboard', client: null, project: null, section: null, create: null, tab: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to clients view with optional parameters
     */
    const navigateToClients = useCallback((params = {}) => {
        updateUrl({ view: 'clients', client: null, project: null, section: null, create: null, tab: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to client dashboard
     */
    const navigateToClient = useCallback((clientId) => {
        updateUrl({ view: 'clients', client: clientId, project: null, section: null, create: null, tab: null });
    }, [updateUrl]);

    return {
        urlParams,
        navigateToProjects,
        navigateToProject,
        navigateToClients,
        navigateToClient,
        navigateToInvoices,
        navigateToAccount,
        navigateToDashboard,
        updateUrl
    };
};
