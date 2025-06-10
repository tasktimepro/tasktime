import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for URL-based state management
 * Syncs application state with browser URL parameters
 */
export const useUrlState = () => {
    const [urlParams, setUrlParams] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            view: params.get('view') || 'dashboard',
            projectId: params.get('project') || null,
            clientId: params.get('client') || null,
            section: params.get('section') || null,
            create: params.get('create') || null,
            tab: params.get('tab') || null,
            preselectedClientId: params.get('preselectedClientId') || null
        };
    });

    /**
     * Update URL parameters without page reload
     */
    const updateUrl = useCallback((newParams) => {
        const url = new URL(window.location);
        const searchParams = new URLSearchParams(url.search);

        // Update or remove parameters
        Object.entries(newParams).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                searchParams.delete(key);
            } else {
                searchParams.set(key, value);
            }
        });

        // Update the URL
        const newUrl = `${url.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        
        // Only update if URL actually changed
        if (newUrl !== window.location.pathname + window.location.search) {
            window.history.pushState({}, '', newUrl);
            setUrlParams({
                view: searchParams.get('view') || 'dashboard',
                projectId: searchParams.get('project') || null,
                clientId: searchParams.get('client') || null,
                section: searchParams.get('section') || null,
                create: searchParams.get('create') || null,
                tab: searchParams.get('tab') || null,
                preselectedClientId: searchParams.get('preselectedClientId') || null
            });
        }
    }, []);

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

    /**
     * Handle browser back/forward navigation
     */
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            setUrlParams({
                view: params.get('view') || 'dashboard',
                projectId: params.get('project') || null,
                clientId: params.get('client') || null,
                section: params.get('section') || null,
                create: params.get('create') || null,
                tab: params.get('tab') || null,
                preselectedClientId: params.get('preselectedClientId') || null
            });
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

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
