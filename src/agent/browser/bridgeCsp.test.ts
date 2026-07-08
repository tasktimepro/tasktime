import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('agent bridge CSP', () => {
    it('allows local sync worker and loopback WebSocket bridge endpoints in connect-src', () => {
        const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        const cspMatch = indexHtml.match(/Content-Security-Policy" content="([^"]+)"/);

        expect(cspMatch?.[1]).toContain('connect-src');
        expect(cspMatch?.[1]).toContain('http://127.0.0.1:8787');
        expect(cspMatch?.[1]).toContain('http://localhost:8787');
        expect(cspMatch?.[1]).toContain('ws://127.0.0.1:*');
        expect(cspMatch?.[1]).toContain('ws://localhost:*');
        expect(cspMatch?.[1]).toContain('wss://127.0.0.1:*');
        expect(cspMatch?.[1]).toContain('wss://localhost:*');
        expect(cspMatch?.[1]).not.toContain('http://0.0.0.0');
        expect(cspMatch?.[1]).not.toContain('http://*:');
        expect(cspMatch?.[1]).not.toContain('ws://0.0.0.0');
        expect(cspMatch?.[1]).not.toContain('ws://*:');
    });
});
