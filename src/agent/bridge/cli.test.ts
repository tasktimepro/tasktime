import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
    buildTaskTimeAgentBridgeLaunchUrl,
    formatPairingInstructions,
    getTaskTimeAgentBridgeManifest,
    getTaskTimeAgentBridgeCliUsage,
    parseTaskTimeAgentBridgeCliOptions,
    runTaskTimeAgentBridgeCli,
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
            toolCallRateLimit: 120,
            toolCallRateWindowMs: 60000,
            appUrl: undefined,
            help: false,
            manifest: false,
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
            '--tool-rate-limit',
            '30',
            '--tool-rate-window-ms',
            '10000',
            '--app-url',
            'http://localhost:3101',
        ], {})).toEqual(expect.objectContaining({
            host: '::1',
            port: 3799,
            path: '/agent',
            scopes: ['read', 'billing'],
            allowedOrigins: ['http://localhost:3101', 'https://app.tasktime.pro'],
            toolCallRateLimit: 30,
            toolCallRateWindowMs: 10000,
            appUrl: 'http://localhost:3101/',
        }));

        expect(parseTaskTimeAgentBridgeCliOptions([], {
            TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT: '0',
            TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS: '1500',
            TASKTIME_APP_URL: 'https://tasktime.pro/app',
        })).toEqual(expect.objectContaining({
            toolCallRateLimit: 0,
            toolCallRateWindowMs: 1500,
            appUrl: 'https://tasktime.pro/app',
        }));
    });

    it('fails fast for unsupported CLI options and scopes', () => {
        expect(() => parseTaskTimeAgentBridgeCliOptions(['--scope', 'admin'], {})).toThrow(/scope must be one of/);
        expect(() => parseTaskTimeAgentBridgeCliOptions(['--port', '-1'], {})).toThrow(/non-negative integer/);
        expect(() => parseTaskTimeAgentBridgeCliOptions(['--tool-rate-window-ms', '0'], {})).toThrow(/positive integer/);
        expect(() => parseTaskTimeAgentBridgeCliOptions(['--app-url', 'file:///tmp/tasktime'], {})).toThrow(/http:\/\/ or https:\/\//);
        expect(() => parseTaskTimeAgentBridgeCliOptions(['--missing'], {})).toThrow(/Unsupported option/);
    });

    it('formats help and pairing text without session tokens', () => {
        expect(getTaskTimeAgentBridgeCliUsage()).toContain('MCP JSON-RPC messages are read from stdin');
        expect(getTaskTimeAgentBridgeCliUsage()).toContain('--tool-rate-limit <count>');
        expect(getTaskTimeAgentBridgeCliUsage()).toContain('--app-url <url>');
        expect(getTaskTimeAgentBridgeCliUsage()).toContain('--manifest');
        expect(getTaskTimeAgentBridgeManifest()).toEqual(expect.objectContaining({
            schemaVersion: 1,
            bridge: expect.objectContaining({
                binary: 'tasktime-agent-bridge',
                transport: 'mcp-stdio-json-rpc',
                launch: expect.objectContaining({
                    pairingParams: {
                        endpoint: 'agentBridgeEndpoint',
                        pairingId: 'agentBridgePairingId',
                        pairingCode: 'agentBridgePairingCode',
                    },
                }),
            }),
        }));

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

        const launchUrl = buildTaskTimeAgentBridgeLaunchUrl({
            id: 'pairing-1',
            code: '123456',
            endpoint: 'ws://127.0.0.1:3900/tasktime-agent',
            scopes: ['read', 'write'],
            expiresAt: Date.parse('2026-06-25T12:00:00Z'),
        }, 'https://tasktime.pro/');
        expect(launchUrl).toBe('https://tasktime.pro/account?section=agent&agentBridgeEndpoint=ws%3A%2F%2F127.0.0.1%3A3900%2Ftasktime-agent&agentBridgePairingId=pairing-1&agentBridgePairingCode=123456');

        expect(formatPairingInstructions({
            id: 'pairing-1',
            code: '123456',
            endpoint: 'ws://127.0.0.1:3900/tasktime-agent',
            scopes: ['read', 'write'],
            expiresAt: Date.parse('2026-06-25T12:00:00Z'),
        }, 'https://tasktime.pro/')).toContain(`TaskTime launch URL: ${launchUrl}`);
    });

    it('prints local agent discovery metadata without starting the bridge', async () => {
        const stdin = new PassThrough();
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        let stdoutText = '';
        let stderrText = '';
        stdout.on('data', (chunk) => {
            stdoutText += chunk.toString('utf8');
        });
        stderr.on('data', (chunk) => {
            stderrText += chunk.toString('utf8');
        });

        await expect(runTaskTimeAgentBridgeCli(['--manifest'], {
            stdin,
            stdout,
            stderr,
        }, {})).resolves.toBeNull();

        expect(JSON.parse(stdoutText)).toEqual(getTaskTimeAgentBridgeManifest());
        expect(stderrText).toBe('');
    });

    it('keeps the static discovery manifest aligned with the CLI manifest', () => {
        const staticManifest = JSON.parse(readFileSync(
            'public/.well-known/tasktime-agent.json',
            'utf8'
        ));

        expect(staticManifest).toEqual(getTaskTimeAgentBridgeManifest());
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
            toolCallRateLimit: 120,
            toolCallRateWindowMs: 60000,
            appUrl: 'http://localhost:3101',
            help: false,
            manifest: false,
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
            expect(stderrText).toContain('TaskTime launch URL: http://localhost:3101/account?section=agent&agentBridgeEndpoint=');
        } finally {
            await runtime.stop();
        }
    });
});
