import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for URL-based state management
 * Syncs application state with browser URL parameters
 */
export const useUrlState = () => {
    const [urlParams, setUrlParams] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            view: params.get('view') || 'projects',
            projectId: params.get('project') || null
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
                view: searchParams.get('view') || 'projects',
                projectId: searchParams.get('project') || null
            });
        }
    }, []);

    /**
     * Navigate to projects view
     */
    const navigateToProjects = useCallback(() => {
        updateUrl({ view: 'projects', project: null });
    }, [updateUrl]);

    /**
     * Navigate to project dashboard
     */
    const navigateToProject = useCallback((projectId) => {
        updateUrl({ view: 'dashboard', project: projectId });
    }, [updateUrl]);

    /**
     * Navigate to invoices view
     */
    const navigateToInvoices = useCallback(() => {
        updateUrl({ view: 'invoices', project: null });
    }, [updateUrl]);

    /**
     * Navigate to account view with optional parameters
     */
    const navigateToAccount = useCallback((params = {}) => {
        updateUrl({ view: 'account', project: null, ...params });
    }, [updateUrl]);

    /**
     * Handle browser back/forward navigation
     */
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            setUrlParams({
                view: params.get('view') || 'projects',
                projectId: params.get('project') || null
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
        updateUrl
    };
};
