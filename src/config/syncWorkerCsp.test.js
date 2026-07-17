import { describe, expect, it } from 'vitest';
import { injectSyncWorkerCspOrigin } from './syncWorkerCsp.js';

const HTML = `<!doctype html>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://sync.tasktime.pro; frame-src https://accounts.google.com;" />`;

describe('injectSyncWorkerCspOrigin', () => {
    it('adds the configured HTTPS Worker origin only to connect-src', () => {
        const result = injectSyncWorkerCspOrigin(
            HTML,
            'https://tasktime-sync-staging.example.workers.dev',
        );

        expect(result).toContain(
            "connect-src 'self' https://sync.tasktime.pro https://tasktime-sync-staging.example.workers.dev;",
        );
        expect(result).toContain('frame-src https://accounts.google.com;');
        expect(result.match(/tasktime-sync-staging\.example\.workers\.dev/g)).toHaveLength(1);
    });

    it('normalizes the configured URL to its origin', () => {
        const result = injectSyncWorkerCspOrigin(
            HTML,
            'https://worker.example.test/',
        );

        expect(result).toContain('https://worker.example.test;');
        expect(result).not.toContain('https://worker.example.test/;');
    });

    it('does not duplicate an origin already allowed by the static policy', () => {
        const result = injectSyncWorkerCspOrigin(
            HTML,
            'https://sync.tasktime.pro',
        );

        expect(result.match(/https:\/\/sync\.tasktime\.pro/g)).toHaveLength(1);
    });

    it('leaves the policy unchanged when no Worker URL is configured', () => {
        expect(injectSyncWorkerCspOrigin(HTML, undefined)).toBe(HTML);
        expect(injectSyncWorkerCspOrigin(HTML, '')).toBe(HTML);
    });

    it.each([
        'javascript:alert(1)',
        'ftp://worker.example.test',
        'http://worker.example.test',
        'https://user:password@worker.example.test',
    ])('rejects an unsafe Worker URL: %s', (workerUrl) => {
        expect(() => injectSyncWorkerCspOrigin(HTML, workerUrl)).toThrow(
            /VITE_SYNC_WORKER_URL/,
        );
    });

    it.each([
        'http://localhost:8787',
        'http://127.0.0.1:8787',
    ])('allows an explicit loopback HTTP Worker URL: %s', (workerUrl) => {
        expect(injectSyncWorkerCspOrigin(HTML, workerUrl)).toContain(workerUrl);
    });

    it('fails closed when index HTML has no connect-src directive', () => {
        expect(() => injectSyncWorkerCspOrigin(
            '<meta http-equiv="Content-Security-Policy" content="default-src \'self\';" />',
            'https://worker.example.test',
        )).toThrow(/connect-src/);
    });
});
