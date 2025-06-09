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
            section: params.get('section') || null,
            create: params.get('create') || null,
            tab: params.get('tab') || null
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
                section: searchParams.get('section') || null,
                create: searchParams.get('create') || null,
                tab: searchParams.get('tab') || null
            });
        }
    }, []);

    /**
     * Navigate to projects view
     * @param {Object} params - Optional parameters to include in URL
     */
    const navigateToProjects = useCallback((params = {}) => {
        updateUrl({ view: 'projects', project: null, section: null, create: null, tab: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to project dashboard
     */
    const navigateToProject = useCallback((projectId) => {
        updateUrl({ view: 'projects', project: projectId, section: null, create: null, tab: null });
    }, [updateUrl]);

    /**
     * Navigate to invoices view with optional parameters
     */
    const navigateToInvoices = useCallback((params = {}) => {
        // If no tab is specified in params, explicitly clear it
        const finalParams = { view: 'invoices', project: null, ...params };
        if (!('tab' in params)) {
            finalParams.tab = null;
        }
        updateUrl(finalParams);
    }, [updateUrl]);

    /**
     * Navigate to account view with optional parameters
     */
    const navigateToAccount = useCallback((params = {}) => {
        updateUrl({ view: 'account', project: null, tab: null, ...params });
    }, [updateUrl]);

    /**
     * Navigate to main dashboard view
     */
    const navigateToDashboard = useCallback((params = {}) => {
        updateUrl({ view: 'dashboard', project: null, section: null, create: null, tab: null, ...params });
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
                section: params.get('section') || null,
                create: params.get('create') || null,
                tab: params.get('tab') || null
            });
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    return {
        urlParams,
        navigateToProjects,
        navigateToProject,
        navigateToInvoices,
        navigateToAccount,
        navigateToDashboard,
        updateUrl
    };
};
