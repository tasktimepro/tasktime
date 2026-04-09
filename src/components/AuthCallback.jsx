/**
 * OAuth Callback Page Component
 * 
 * This page handles the redirect from Google OAuth when using Worker-based auth.
 * It extracts the authorization code from the URL and sends it to the opener window.
 */

import { useEffect } from 'react';

export const AuthCallback = () => {

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        // Send message to opener window
        if (window.opener) {
            window.opener.postMessage(
                {
                    type: 'google-auth-callback',
                    code,
                    state,
                    error,
                },
                window.location.origin
            );

            // Close popup after short delay; ignore if COOP blocks
            setTimeout(() => {
                try {
                    window.close();
                } catch {
                    // Ignore if blocked by browser policies
                }
            }, 150);
        } else {
            // Not in a popup - redirect to home
            window.location.href = '/';
        }
    }, []);

    return (
        <div className="app-viewport-shell flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-gray-600">Completing authentication...</p>
            </div>
        </div>
    );
};

export default AuthCallback;
