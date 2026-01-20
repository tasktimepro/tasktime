export const GOOGLE_CONFIG = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scopes: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/drive.appdata',
    ].join(' '),
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
};
