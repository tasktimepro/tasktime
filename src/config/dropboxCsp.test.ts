import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Dropbox direct transport CSP', () => {
    it('allows only the Dropbox RPC and content API origins needed by the direct adapter', () => {
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        const policy = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';

        expect(policy).toContain('connect-src');
        expect(policy).toContain('https://api.dropboxapi.com');
        expect(policy).toContain('https://content.dropboxapi.com');
        expect(policy).not.toContain('https://*.dropboxapi.com');
        expect(policy).not.toContain('https://www.dropbox.com');
    });
});
