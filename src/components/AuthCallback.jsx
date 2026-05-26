/**
 * OAuth Callback Page Component
 * 
 * This page handles the redirect from Google OAuth when using Worker-based auth.
 * It extracts the authorization code from the URL and sends it to the opener window.
 */

import { useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';

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

                // Keep channel open long enough for the message to propagate
                // to other tabs before this page closes. Mobile Safari can drop
                // BroadcastChannel messages if the sending tab closes too soon.
                setTimeout(() => channel.close(), 2000);
                delivered = true;
            } catch {
                // BroadcastChannel not available in this context
            }
        }

        if (delivered) {
            // Close popup after a delay that gives BroadcastChannel messages
            // time to propagate to the opener tab. On mobile Safari, closing
            // too early (e.g. 300ms) can race with message delivery.
            setTimeout(() => {
                try {
                    window.close();
                } catch {
                    // Ignore if blocked by browser policies
                }
            }, 1200);
        } else {
            // Neither channel available - redirect to home
            window.location.href = '/';
        }
    }, []);

    return (
        <div className="app-viewport-shell flex items-center justify-center">
            <div className="text-center">
                <Spinner className="mx-auto mb-4 h-8 w-8 text-gray-900" />
                <p className="text-gray-600">Completing authentication...</p>
            </div>
        </div>
    );
};

export default AuthCallback;
