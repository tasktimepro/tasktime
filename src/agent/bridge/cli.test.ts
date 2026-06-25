import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
    formatPairingInstructions,
    getTaskTimeAgentBridgeCliUsage,
    parseTaskTimeAgentBridgeCliOptions,
    startTaskTimeAgentBridgeCli,
} from './cli';

function readOutput(stream: PassThrough): Promise<string> {
    return new Promise((resolve) => {
        stream.once('data', (chunk) => resolve(chunk.toString('utf8')));
    });
}

describe('TaskTime agent bridge CLI', () => {
    it('parses defaults and explicit scope/origin options', () => {
        expect(parseTaskTimeAgentBridgeCliOptions([], {})).toEqual({
            host: '127.0.0.1',
            port: 0,
            path: '/tasktime-agent',
            scopes: ['read', 'write', 'navigation'],
            allowedOrigins: undefined,
            pairingTtlMs: 300000,
            sessionTtlMs: undefined,
            commandTimeoutMs: 120000,
            help: false,
        });

        expect(parseTaskTimeAgentBridgeCliOptions([
            '--host',
            '::1',
            '--port',
            '3799',
            '--path',
            'agent',
            '--scope',
            'read',
            '--scope',
            'billing',
            '--origin',
            'http://localhost:3101',
            '--origin',
            'https://app.tasktime.pro',
        ], {})).toEqual(expect.objectContaining({
            host: '::1',
            port: 3799,
            path: '/agent',
            scopes: ['read', 'billing'],
            allowedOrigins: ['http://localhost:3101', 'https://app.tasktime.pro'],
        }));
    });

    it('fails fast for unsupported CLI options and scopes', () => {
        expect(() => parseTaskTimeAgentBridgeCliOptions(['--scope', 'admin'], {})).toThrow(/scope must be one of/);
        expect(() => parseTaskTimeAgentBridgeCliOptions(['--port', '-1'], {})).toThrow(/non-negative integer/);
        expect(() => parseTaskTimeAgentBridgeCliOptions(['--missing'], {})).toThrow(/Unsupported option/);
    });

    it('formats help and pairing text without session tokens', () => {
        expect(getTaskTimeAgentBridgeCliUsage()).toContain('MCP JSON-RPC messages are read from stdin');

        const text = formatPairingInstructions({
            id: 'pairing-1',
            code: '123456',
            endpoint: 'ws://127.0.0.1:3900/tasktime-agent',
            scopes: ['read', 'write'],
            expiresAt: Date.parse('2026-06-25T12:00:00Z'),
        });

        expect(text).toContain('Pairing ID: pairing-1');
        expect(text).toContain('Pairing code: 123456');
        expect(text).not.toContain('sessionToken');
    });

    it('starts a loopback stdio MCP bridge and keeps status output off stdout', async () => {
        const stdin = new PassThrough();
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        let stderrText = '';
        stderr.on('data', (chunk) => {
            stderrText += chunk.toString('utf8');
        });

        const runtime = await startTaskTimeAgentBridgeCli({
            host: '127.0.0.1',
            port: 0,
            path: '/tasktime-agent',
            scopes: ['read'],
            allowedOrigins: ['http://localhost:3101'],
            pairingTtlMs: 300000,
            commandTimeoutMs: 1000,
            help: false,
        }, {
            stdin,
            stdout,
            stderr,
        });

        try {
            const pendingOutput = readOutput(stdout);
            stdin.write(`${JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list',
            })}\n`);

            await expect(pendingOutput).resolves.toContain('"tools"');
            expect(stderrText).toContain('TaskTime local agent bridge is running.');
            expect(stderrText).toContain(runtime.challenge.code);
        } finally {
            await runtime.stop();
        }
    });
});
