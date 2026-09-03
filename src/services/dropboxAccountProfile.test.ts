import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDropboxAccountEmail } from './dropboxAccountProfile';

describe('getDropboxAccountEmail', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reads a verified account email directly from Dropbox without exposing the token elsewhere', async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({
            account_id: 'dbid:account-fixture',
            email: 'owner@example.com',
            email_verified: true,
            disabled: false,
        }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getDropboxAccountEmail('dropbox-access-token-fixture'))
            .resolves.toBe('owner@example.com');
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.dropboxapi.com/2/users/get_current_account',
            {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer dropbox-access-token-fixture',
                    'Content-Type': 'application/json',
                },
                body: 'null',
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            },
        );
    });

    it.each([
        [{ account_id: 'dbid:account-fixture', email: '', email_verified: true, disabled: false }],
        [{ account_id: 'dbid:account-fixture', email: 'owner@example.com', email_verified: false, disabled: false }],
        [{ account_id: 'dbid:account-fixture', email: 'owner@example.com', email_verified: true, disabled: true }],
    ])('rejects unusable Dropbox account identity responses', async (body) => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));

        await expect(getDropboxAccountEmail('dropbox-access-token-fixture'))
            .rejects.toThrow('Dropbox returned an unusable account identity.');
    });

    it('does not expose an upstream response body when the profile request is rejected', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ error_summary: 'secret-provider-detail' }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
        )));

        await expect(getDropboxAccountEmail('dropbox-access-token-fixture'))
            .rejects.toThrow('Dropbox could not confirm the connected account.');
        await expect(getDropboxAccountEmail('dropbox-access-token-fixture'))
            .rejects.not.toThrow(/secret-provider-detail/);
    });
});
