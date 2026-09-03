const DROPBOX_CURRENT_ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account';
const MAX_EMAIL_LENGTH = 254;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUsableEmail(value: unknown): value is string {
    return typeof value === 'string'
        && value.length <= MAX_EMAIL_LENGTH
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Reads the connected account identity directly from Dropbox in the browser. */
export async function getDropboxAccountEmail(accessToken: string): Promise<string> {
    let response: Response;
    try {
        response = await fetch(DROPBOX_CURRENT_ACCOUNT_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: 'null',
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
    } catch {
        throw new Error('Dropbox could not confirm the connected account.');
    }
    if (!response.ok) {
        throw new Error('Dropbox could not confirm the connected account.');
    }

    let value: unknown;
    try {
        value = await response.json();
    } catch {
        throw new Error('Dropbox returned an unusable account identity.');
    }
    if (!isRecord(value)
        || typeof value.account_id !== 'string'
        || !value.account_id
        || !isUsableEmail(value.email)
        || value.email_verified !== true
        || value.disabled !== false) {
        throw new Error('Dropbox returned an unusable account identity.');
    }
    return value.email;
}
