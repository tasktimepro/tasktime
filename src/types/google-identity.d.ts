export {};

declare global {
    interface Window {
        google?: {
            accounts?: {
                oauth2?: {
                    initTokenClient: (options: {
                        client_id: string;
                        scope: string;
                        prompt?: '' | 'none' | 'consent' | 'select_account';
                        hint?: string;
                        callback: (response: {
                            access_token: string;
                            expires_in: number;
                            scope?: string;
                            error?: string;
                            error_description?: string;
                        }) => void;
                    }) => {
                        requestAccessToken: (overrideConfig?: {
                            prompt?: '' | 'none' | 'consent' | 'select_account';
                            hint?: string;
                        }) => void;
                    };
                    revoke: (accessToken: string, callback?: () => void) => void;
                };
            };
        };
    }
}
