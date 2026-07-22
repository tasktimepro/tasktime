import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    OPENCLAW_TOOL_DEFINITIONS,
    TaskTimeBridgeSupervisor,
    createTaskTimeOpenClawPlugin,
    detectLegacyTaskTimeMcpConflict,
} from './index.js';

const tempDirs = [];

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, {
        force: true,
        recursive: true,
    })));
});

describe('TaskTime native OpenClaw plugin', () => {
    it('registers one Gateway service and generated tools for configured scopes', () => {
        const services = [];
        const tools = [];
        const plugin = createTaskTimeOpenClawPlugin();

        plugin.register({
            config: {},
            pluginConfig: {
                scopes: ['read'],
            },
            logger: createLogger(),
            registerService: (service) => services.push(service),
            registerTool: (tool) => tools.push(tool),
        });

        expect(services).toHaveLength(1);
        expect(services[0].id).toBe('tasktime-agent-bridge');
        expect(tools.map((tool) => tool.name)).toEqual(
            OPENCLAW_TOOL_DEFINITIONS
                .filter((tool) => tool.scopes.every((scope) => scope === 'read'))
                .map((tool) => tool.openClawName)
        );
        expect(tools.map((tool) => tool.name)).toContain('tasktime__get_pairing_status');
        expect(tools.map((tool) => tool.name)).not.toContain('tasktime__create_project');
    });

    it('owns one bridge child across repeated starts and tool calls', async () => {
        const stateDir = await createTempDir();
        const children = [];
        const supervisor = new TaskTimeBridgeSupervisor({
            bridgePath: '/plugin/vendor/tasktime-agent-bridge.mjs',
            spawnProcess: (...args) => {
                const child = createMockBridgeChild();
                children.push({ args, child });
                return child;
            },
            logger: createLogger(),
        });

        await supervisor.start({ stateDir });
        await supervisor.start({ stateDir });
        const result = await supervisor.callTool('list_projects', {});

        expect(children).toHaveLength(1);
        expect(children[0].args[0]).toBe(process.execPath);
        expect(children[0].args[1]).toEqual(expect.arrayContaining([
            '/plugin/vendor/tasktime-agent-bridge.mjs',
            '--host',
            '127.0.0.1',
            '--port',
            '0',
            '--agent-id',
            'tasktime.agent.openclaw',
        ]));
        expect(result).toEqual(expect.objectContaining({
            isError: false,
            details: {
                ok: true,
                command: 'list_projects',
            },
        }));

        await supervisor.stop();
        expect(children[0].child.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('uses bounded restart attempts after an unexpected child exit', async () => {
        const stateDir = await createTempDir();
        const children = [];
        const supervisor = new TaskTimeBridgeSupervisor({
            bridgePath: '/plugin/vendor/tasktime-agent-bridge.mjs',
            pluginConfig: {
                childRestartLimit: 1,
            },
            spawnProcess: () => {
                const child = createMockBridgeChild();
                children.push(child);
                return child;
            },
            logger: createLogger(),
        });

        await supervisor.start({ stateDir });
        children[0].exitCode = 1;
        children[0].emit('exit', 1, null);
        await expect(supervisor.callTool('list_projects', {})).resolves.toMatchObject({ isError: false });
        children[1].exitCode = 1;
        children[1].emit('exit', 1, null);

        await expect(supervisor.callTool('list_projects', {})).resolves.toMatchObject({
            isError: true,
            details: {
                error: {
                    code: 'UNAVAILABLE',
                },
            },
        });
        expect(children).toHaveLength(2);
    });

    it('blocks a recognized legacy TaskTime MCP owner instead of starting a duplicate', async () => {
        const spawnProcess = vi.fn();
        const supervisor = new TaskTimeBridgeSupervisor({
            appConfig: {
                mcp: {
                    servers: {
                        tasktime: {
                            command: 'tasktime-agent-bridge',
                        },
                    },
                },
            },
            spawnProcess,
            logger: createLogger(),
        });

        await supervisor.start({ stateDir: await createTempDir() });
        const result = await supervisor.callTool('get_pairing_status', {});

        expect(spawnProcess).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            isError: true,
            details: {
                error: {
                    code: 'legacy_mcp_conflict',
                },
            },
        });
        expect(detectLegacyTaskTimeMcpConflict({
            mcpServers: {
                tasktime: {
                    command: 'node',
                    args: ['run-tasktime-agent-bridge.mjs'],
                },
            },
        })).toBe(true);
    });

    it('never copies credential-bearing bridge stderr into Gateway logs', async () => {
        const logger = createLogger();
        const child = createMockBridgeChild();
        const supervisor = new TaskTimeBridgeSupervisor({
            bridgePath: '/plugin/vendor/tasktime-agent-bridge.mjs',
            spawnProcess: () => child,
            logger,
        });

        await supervisor.start({ stateDir: await createTempDir() });
        child.stderr.write('Pairing code: 123456\nTaskTime Pro launch URL: https://tasktime.pro/account?agentBridgePairingCode=123456\n');

        expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('123456'));
        await supervisor.stop();
    });
});

function createMockBridgeChild() {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.exitCode = null;
    child.signalCode = null;
    child.stdin = new Writable({
        write(chunk, _encoding, callback) {
            const request = JSON.parse(chunk.toString('utf8').trim());
            const result = request.method === 'initialize'
                ? {
                    protocolVersion: '2025-11-25',
                    capabilities: { tools: {} },
                }
                : {
                    content: [{ type: 'text', text: '{"ok":true}' }],
                    structuredContent: {
                        ok: true,
                        command: request.params.name,
                    },
                    isError: false,
                };

            queueMicrotask(() => {
                child.stdout.write(`${JSON.stringify({
                    jsonrpc: '2.0',
                    id: request.id,
                    result,
                })}\n`);
            });
            callback();
        },
    });
    child.kill = vi.fn((signal) => {
        child.signalCode = signal;
        queueMicrotask(() => child.emit('exit', null, signal));
        return true;
    });
    return child;
}

function createLogger() {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
}

async function createTempDir() {
    const directory = await mkdtemp(path.join(tmpdir(), 'tasktime-openclaw-plugin-'));
    tempDirs.push(directory);
    return directory;
}
