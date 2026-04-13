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

        const payload = {
            type: 'google-auth-callback',
            code,
            state,
            error,
        };

        let delivered = false;

        // Primary: postMessage to opener window (works when popup reference is intact)
        if (window.opener) {
            try {
                window.opener.postMessage(payload, window.location.origin);
                delivered = true;
            } catch {
                // Cross-origin or COOP may block; fall through to BroadcastChannel
            }
        }

        // Fallback: BroadcastChannel for mobile browsers where window.opener
        // is lost after cross-origin Google OAuth redirects
        if (!delivered && typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('google-auth-callback');
                channel.postMessage(payload);

                // Keep channel open briefly so the message is delivered
                setTimeout(() => channel.close(), 500);
                delivered = true;
            } catch {
                // BroadcastChannel not available in this context
            }
        }

        if (delivered) {
            // Close popup after short delay; ignore if COOP blocks
            setTimeout(() => {
                try {
                    window.close();
                } catch {
                    // Ignore if blocked by browser policies
                }
            }, 300);
        } else {
            // Neither channel available - redirect to home
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
