import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_TOOL_DEFINITIONS } from '../../../../src/agent/bridge/mcpTools.ts';

const PLUGIN_ID = 'tasktime';
const DEFAULT_SCOPES = ['read', 'write', 'navigation'];
const VALID_SCOPES = ['read', 'write', 'billing', 'export', 'email', 'navigation'];
const SETUP_TOOLS = [
    {
        name: 'get_pairing_status',
        description: 'Return the active local TaskTime Pro bridge endpoint, launch URL, pairing expiry, stable agent identity, and app-session status. This tool works before the browser app is paired.',
        scopes: [],
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: 'refresh_pairing',
        description: 'Create a fresh local TaskTime Pro pairing challenge and launch URL for the same bridge process when the previous pairing code expired or was consumed. This tool works before the browser app is paired.',
        scopes: [],
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
    },
];

export const OPENCLAW_TOOL_DEFINITIONS = [...SETUP_TOOLS, ...MCP_TOOL_DEFINITIONS]
    .map((tool) => ({
        ...tool,
        openClawName: `tasktime__${tool.name}`,
    }))
    .sort((left, right) => left.openClawName.localeCompare(right.openClawName));

export const OPENCLAW_TOOL_CONTRACT_NAMES = OPENCLAW_TOOL_DEFINITIONS.map((tool) => tool.openClawName);

export class TaskTimeBridgeSupervisor {

    constructor(options = {}) {
        this.spawnProcess = options.spawnProcess ?? spawn;
        this.bridgePath = options.bridgePath ?? resolveBundledBridgePath();
        this.pluginConfig = normalizePluginConfig(options.pluginConfig);
        this.appConfig = options.appConfig ?? {};
        this.logger = options.logger ?? createNoopLogger();
        this.child = null;
        this.pending = new Map();
        this.nextRequestId = 1;
        this.launchCount = 0;
        this.stopping = false;
        this.conflict = detectLegacyTaskTimeMcpConflict(this.appConfig);
        this.statusFile = null;
    }

    async start(context) {
        if (this.conflict) {
            this.logger.error('TaskTime native plugin found a legacy TaskTime MCP configuration at mcp.servers.tasktime; disable it before enabling the native bridge.');
            return;
        }

        this.statusFile = path.join(context.stateDir, 'tasktime', 'openclaw-agent-bridge.status.json');
        await mkdir(path.dirname(this.statusFile), { recursive: true, mode: 0o700 });

        try {
            await this.ensureBridge();
        } catch (error) {
            this.logger.error(`TaskTime bridge startup is unavailable: ${sanitizeErrorMessage(error)}`);
        }
    }

    async stop() {
        this.stopping = true;
        const child = this.child;
        this.child = null;
        this.rejectPending(new Error('TaskTime bridge stopped.'));

        if (!child || child.exitCode !== null || child.signalCode !== null) {
            disposeChildStreams(child);
            return;
        }

        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill('SIGKILL');
                }
                resolve();
            }, 2_000);
            timeout.unref?.();
            child.once('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
            child.kill('SIGTERM');
        });
        disposeChildStreams(child);
    }

    async callTool(name, args = {}) {
        if (this.conflict) {
            return createUnavailableToolResult(
                'legacy_mcp_conflict',
                'A legacy TaskTime MCP server is still enabled at mcp.servers.tasktime. Disable that entry and restart the OpenClaw Gateway before using the native TaskTime plugin.'
            );
        }

        try {
            await this.ensureBridge();
            const result = await this.request('tools/call', {
                name,
                arguments: args,
            });

            return normalizeMcpToolResult(result);
        } catch (error) {
            return createUnavailableToolResult(
                'UNAVAILABLE',
                `TaskTime bridge is unavailable: ${sanitizeErrorMessage(error)}`
            );
        }
    }

    async ensureBridge() {
        if (this.child && this.child.exitCode === null && this.child.signalCode === null) {
            return;
        }

        const maxLaunches = 1 + this.pluginConfig.childRestartLimit;
        if (this.launchCount >= maxLaunches) {
            throw new Error(`bounded restart limit reached after ${this.launchCount} launch attempts`);
        }

        this.launchCount += 1;
        const child = this.spawnProcess(process.execPath, this.buildBridgeArgs(), {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.child = child;
        this.attachChild(child);
        await this.request('initialize', {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: {
                name: '@tasktimepro/openclaw',
                version: '1.0.0',
            },
        });
    }

    buildBridgeArgs() {
        const args = [
            this.bridgePath,
            '--host',
            '127.0.0.1',
            '--port',
            '0',
            '--app-url',
            this.pluginConfig.appUrl,
            '--agent-id',
            'tasktime.agent.openclaw',
            '--agent-label',
            'OpenClaw on this device',
            '--scopes',
            this.pluginConfig.scopes.join(','),
            '--session-ttl-ms',
            String(this.pluginConfig.sessionTtlMs),
            '--command-timeout-ms',
            String(this.pluginConfig.commandTimeoutMs),
        ];

        if (this.statusFile) {
            args.push('--status-file', this.statusFile);
        }

        for (const origin of this.pluginConfig.allowedOrigins) {
            args.push('--origin', origin);
        }

        return args;
    }

    request(method, params) {
        const child = this.child;
        if (!child?.stdin || child.exitCode !== null || child.signalCode !== null) {
            return Promise.reject(new Error('bridge process is not running'));
        }

        const id = this.nextRequestId++;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`bridge request timed out: ${method}`));
            }, this.pluginConfig.commandTimeoutMs);
            timeout.unref?.();
            this.pending.set(id, { resolve, reject, timeout });
            child.stdin.write(`${JSON.stringify({
                jsonrpc: '2.0',
                id,
                method,
                params,
            })}\n`, (error) => {
                if (!error) {
                    return;
                }

                clearTimeout(timeout);
                this.pending.delete(id);
                reject(new Error('bridge request could not be written'));
            });
        });
    }

    attachChild(child) {
        let stdoutBuffer = '';

        child.stdout?.on('data', (chunk) => {
            stdoutBuffer += chunk.toString('utf8');

            while (stdoutBuffer.includes('\n')) {
                const newlineIndex = stdoutBuffer.indexOf('\n');
                const line = stdoutBuffer.slice(0, newlineIndex).trim();
                stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
                if (line) {
                    this.handleBridgeLine(line);
                }
            }
        });

        // Bridge stderr contains short-lived pairing credentials. Drain it so the
        // child cannot block, but never copy its raw content into Gateway logs.
        child.stderr?.on('data', () => {});
        child.once('error', (error) => {
            if (this.child === child) {
                this.child = null;
            }
            this.rejectPending(new Error(`bridge process error: ${sanitizeErrorMessage(error)}`));
        });
        child.once('exit', (code, signal) => {
            if (this.child === child) {
                this.child = null;
            }
            this.rejectPending(new Error(`bridge process exited (${signal ?? code ?? 'unknown'})`));
            if (!this.stopping) {
                this.logger.error('TaskTime bridge exited unexpectedly; the next TaskTime tool call will make a bounded restart attempt and require pairing with the new bridge instance.');
            }
        });
    }

    handleBridgeLine(line) {
        let response;

        try {
            response = JSON.parse(line);
        } catch {
            this.logger.error('TaskTime bridge returned malformed JSON-RPC output.');
            return;
        }

        const pending = this.pending.get(response.id);
        if (!pending) {
            return;
        }

        clearTimeout(pending.timeout);
        this.pending.delete(response.id);

        if (response.error) {
            pending.reject(new Error(typeof response.error.message === 'string'
                ? response.error.message
                : 'bridge JSON-RPC request failed'));
            return;
        }

        pending.resolve(response.result);
    }

    rejectPending(error) {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pending.clear();
    }
}

export function createTaskTimeOpenClawPlugin() {
    return {
        id: PLUGIN_ID,
        name: 'TaskTime Pro',
        description: 'Gateway-owned local TaskTime Pro bridge and native tools.',
        register(api) {
            const supervisor = new TaskTimeBridgeSupervisor({
                appConfig: api.config,
                pluginConfig: api.pluginConfig,
                logger: api.logger,
            });

            api.registerService({
                id: 'tasktime-agent-bridge',
                start: (context) => supervisor.start(context),
                stop: () => supervisor.stop(),
            });

            const configuredScopes = new Set(normalizePluginConfig(api.pluginConfig).scopes);
            for (const definition of OPENCLAW_TOOL_DEFINITIONS) {
                if (!definition.scopes.every((scope) => configuredScopes.has(scope))) {
                    continue;
                }

                api.registerTool({
                    name: definition.openClawName,
                    label: `TaskTime: ${definition.name}`,
                    description: definition.description,
                    parameters: definition.inputSchema,
                    execute: async (_toolCallId, params) => supervisor.callTool(definition.name, params ?? {}),
                });
            }
        },
    };
}

export function detectLegacyTaskTimeMcpConflict(config) {
    const server = config?.mcp?.servers?.tasktime ?? config?.mcpServers?.tasktime;

    if (!server || typeof server !== 'object') {
        return false;
    }

    const command = typeof server.command === 'string' ? server.command : '';
    const args = Array.isArray(server.args) ? server.args.filter((arg) => typeof arg === 'string') : [];
    const commandText = [command, ...args].join(' ').toLowerCase();

    return commandText.includes('tasktime-agent-bridge')
        || commandText.includes('@tasktimepro/agent-bridge')
        || commandText.includes('run-tasktime-agent-bridge');
}

function normalizePluginConfig(value) {
    const config = value && typeof value === 'object' ? value : {};
    const scopes = Array.isArray(config.scopes)
        ? VALID_SCOPES.filter((scope) => config.scopes.includes(scope))
        : DEFAULT_SCOPES;
    const allowedOrigins = Array.isArray(config.allowedOrigins)
        ? config.allowedOrigins.filter((origin) => typeof origin === 'string')
        : [];

    return {
        appUrl: typeof config.appUrl === 'string' ? config.appUrl : 'https://tasktime.pro',
        scopes: scopes.length > 0 ? scopes : DEFAULT_SCOPES,
        allowedOrigins,
        sessionTtlMs: readBoundedInteger(config.sessionTtlMs, 86_400_000, 60_000, 86_400_000),
        commandTimeoutMs: readBoundedInteger(config.commandTimeoutMs, 120_000, 1_000, 300_000),
        childRestartLimit: readBoundedInteger(config.childRestartLimit, 2, 0, 5),
    };
}

function readBoundedInteger(value, fallback, minimum, maximum) {
    return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function normalizeMcpToolResult(result) {
    if (!result || typeof result !== 'object') {
        return createUnavailableToolResult('UNAVAILABLE', 'TaskTime bridge returned an invalid tool result.');
    }

    return {
        content: Array.isArray(result.content)
            ? result.content
            : [{ type: 'text', text: JSON.stringify(result.structuredContent ?? result) }],
        details: result.structuredContent ?? null,
        isError: result.isError === true,
    };
}

function createUnavailableToolResult(code, message) {
    const details = {
        ok: false,
        command: 'tools/call',
        error: {
            code,
            message,
            details: {
                recovery: {
                    action: code === 'legacy_mcp_conflict' ? 'disable_legacy_mcp' : 'inspect_tasktime_plugin',
                },
            },
        },
    };

    return {
        content: [{ type: 'text', text: JSON.stringify(details) }],
        details,
        isError: true,
    };
}

function sanitizeErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error);

    return message
        .replaceAll(/agentBridgePairing(?:Id|Code)=[^&\s]+/gi, 'agentBridgePairingCredential=[redacted]')
        .replaceAll(/\b\d{6}\b/g, '[redacted]')
        .slice(0, 300);
}

function createNoopLogger() {
    return {
        debug() {},
        info() {},
        warn() {},
        error() {},
    };
}

function disposeChildStreams(child) {
    child?.stdin?.destroy?.();
    child?.stdout?.destroy?.();
    child?.stderr?.destroy?.();
}

function resolveBundledBridgePath() {
    const bridgeUrl = new URL('../vendor/tasktime-agent-bridge.mjs', import.meta.url);

    if (bridgeUrl.protocol === 'file:') {
        return fileURLToPath(bridgeUrl);
    }

    return path.resolve(process.cwd(), 'integrations/openclaw/tasktime/vendor/tasktime-agent-bridge.mjs');
}

export default createTaskTimeOpenClawPlugin();
