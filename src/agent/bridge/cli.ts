import { pathToFileURL } from 'node:url';
import type { Readable, Writable } from 'node:stream';
import { LocalAgentBridge } from './localBridge';
import { McpBridgeJsonRpcServer, startMcpLineDelimitedStdioTransport } from './mcpServer';
import type { BridgePairingChallenge } from './pairing';
import type { AgentPermissionScope } from '@/agent/types';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 0;
const DEFAULT_PATH = '/tasktime-agent';
const DEFAULT_SCOPES: AgentPermissionScope[] = ['read', 'write', 'navigation'];
const DEFAULT_PAIRING_TTL_MS = 5 * 60 * 1000;
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;
const VALID_SCOPES: AgentPermissionScope[] = ['read', 'write', 'billing', 'navigation'];

export interface TaskTimeAgentBridgeCliOptions {
    host: string;
    port: number;
    path: string;
    scopes: AgentPermissionScope[];
    allowedOrigins?: string[];
    pairingTtlMs: number;
    sessionTtlMs?: number;
    commandTimeoutMs: number;
    help: boolean;
}

export interface TaskTimeAgentBridgeCliIo {
    stdin: Readable;
    stdout: Writable;
    stderr: Writable;
}

export interface StartedTaskTimeAgentBridgeCli {
    bridge: LocalAgentBridge;
    challenge: BridgePairingChallenge;
    stop: () => Promise<void>;
}

type EnvLike = Record<string, string | undefined>;

export function parseTaskTimeAgentBridgeCliOptions(
    args: string[],
    env: EnvLike = process.env
): TaskTimeAgentBridgeCliOptions {
    const options: TaskTimeAgentBridgeCliOptions = {
        host: env.TASKTIME_AGENT_BRIDGE_HOST || DEFAULT_HOST,
        port: parseIntegerOption(env.TASKTIME_AGENT_BRIDGE_PORT, DEFAULT_PORT, 'TASKTIME_AGENT_BRIDGE_PORT'),
        path: env.TASKTIME_AGENT_BRIDGE_PATH || DEFAULT_PATH,
        scopes: parseScopes(env.TASKTIME_AGENT_BRIDGE_SCOPES) ?? DEFAULT_SCOPES,
        allowedOrigins: parseList(env.TASKTIME_AGENT_BRIDGE_ORIGINS),
        pairingTtlMs: parseIntegerOption(env.TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS, DEFAULT_PAIRING_TTL_MS, 'TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS'),
        sessionTtlMs: parseOptionalIntegerOption(env.TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS, 'TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS'),
        commandTimeoutMs: parseIntegerOption(env.TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS, DEFAULT_COMMAND_TIMEOUT_MS, 'TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS'),
        help: false,
    };

    const cliScopes: AgentPermissionScope[] = [];
    const cliOrigins: string[] = [];

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];

        switch (arg) {
            case '--help':
            case '-h':
                options.help = true;
                break;

            case '--host':
                options.host = readOptionValue(args, ++index, arg);
                break;

            case '--port':
                options.port = parseIntegerOption(readOptionValue(args, ++index, arg), DEFAULT_PORT, arg);
                break;

            case '--path':
                options.path = normalizePath(readOptionValue(args, ++index, arg));
                break;

            case '--scopes':
                options.scopes = parseRequiredScopes(readOptionValue(args, ++index, arg), arg);
                break;

            case '--scope':
                cliScopes.push(parseScope(readOptionValue(args, ++index, arg), arg));
                break;

            case '--origin':
                cliOrigins.push(readOptionValue(args, ++index, arg));
                break;

            case '--pairing-ttl-ms':
                options.pairingTtlMs = parseIntegerOption(readOptionValue(args, ++index, arg), DEFAULT_PAIRING_TTL_MS, arg);
                break;

            case '--session-ttl-ms':
                options.sessionTtlMs = parseIntegerOption(readOptionValue(args, ++index, arg), DEFAULT_PAIRING_TTL_MS, arg);
                break;

            case '--command-timeout-ms':
                options.commandTimeoutMs = parseIntegerOption(readOptionValue(args, ++index, arg), DEFAULT_COMMAND_TIMEOUT_MS, arg);
                break;

            default:
                throw new Error(`Unsupported option: ${arg}`);
        }
    }

    if (cliScopes.length > 0) {
        options.scopes = dedupeScopes(cliScopes);
    }

    if (cliOrigins.length > 0) {
        options.allowedOrigins = cliOrigins;
    }

    options.path = normalizePath(options.path);
    options.scopes = dedupeScopes(options.scopes);

    return options;
}

export function getTaskTimeAgentBridgeCliUsage(): string {
    return [
        'TaskTime local agent bridge',
        '',
        'Usage:',
        '  tasktime-agent-bridge [options]',
        '',
        'Options:',
        '  --host <host>                 Loopback host to bind. Default: 127.0.0.1',
        '  --port <port>                 Loopback port to bind. Default: 0',
        '  --path <path>                 App-session WebSocket path. Default: /tasktime-agent',
        '  --scopes <list>               Comma-separated scopes. Default: read,write,navigation',
        '  --scope <scope>               Add one scope. Can be repeated.',
        '  --origin <origin>             Allowed TaskTime browser origin. Can be repeated.',
        '  --pairing-ttl-ms <ms>         Pairing code lifetime. Default: 300000',
        '  --session-ttl-ms <ms>         App-session token lifetime.',
        '  --command-timeout-ms <ms>     App command timeout. Default: 120000',
        '  --help                        Show this help.',
        '',
        'MCP JSON-RPC messages are read from stdin and written to stdout.',
        'Bridge status and pairing details are written to stderr.',
    ].join('\n');
}

export function formatPairingInstructions(challenge: BridgePairingChallenge): string {
    return [
        'TaskTime local agent bridge is running.',
        `App endpoint: ${challenge.endpoint}`,
        `Pairing ID: ${challenge.id}`,
        `Pairing code: ${challenge.code}`,
        `Scopes: ${challenge.scopes.join(',')}`,
        `Pairing expires at: ${new Date(challenge.expiresAt).toISOString()}`,
        '',
        'Open TaskTime and connect the agent bridge using the endpoint, pairing ID, and pairing code above.',
    ].join('\n');
}

export async function startTaskTimeAgentBridgeCli(
    options: TaskTimeAgentBridgeCliOptions,
    io: TaskTimeAgentBridgeCliIo
): Promise<StartedTaskTimeAgentBridgeCli> {
    const bridge = new LocalAgentBridge({
        host: options.host,
        port: options.port,
        path: options.path,
        allowedOrigins: options.allowedOrigins,
        sessionTtlMs: options.sessionTtlMs,
    });

    await bridge.start();

    const challenge = bridge.createPairingChallenge({
        scopes: options.scopes,
        ttlMs: options.pairingTtlMs,
    });
    const mcp = new McpBridgeJsonRpcServer({
        bridge,
        scopes: options.scopes,
        commandTimeoutMs: options.commandTimeoutMs,
    });
    const stopTransport = startMcpLineDelimitedStdioTransport({
        input: io.stdin,
        output: io.stdout,
        server: mcp,
        onError: (error) => {
            io.stderr.write(`TaskTime MCP bridge error: ${error.message}\n`);
        },
    });

    io.stderr.write(`${formatPairingInstructions(challenge)}\n`);

    return {
        bridge,
        challenge,
        stop: async () => {
            stopTransport();
            await bridge.stop();
        },
    };
}

export async function runTaskTimeAgentBridgeCli(
    args: string[] = process.argv.slice(2),
    io: TaskTimeAgentBridgeCliIo = {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
    },
    env: EnvLike = process.env
): Promise<StartedTaskTimeAgentBridgeCli | null> {
    const options = parseTaskTimeAgentBridgeCliOptions(args, env);

    if (options.help) {
        io.stderr.write(`${getTaskTimeAgentBridgeCliUsage()}\n`);
        return null;
    }

    const runtime = await startTaskTimeAgentBridgeCli(options, io);
    const shutdown = async () => {
        await runtime.stop();
        process.exit(0);
    };

    process.once('SIGINT', () => {
        void shutdown();
    });
    process.once('SIGTERM', () => {
        void shutdown();
    });

    return runtime;
}

function parseList(value?: string): string[] | undefined {
    if (!value) {
        return undefined;
    }

    const list = value.split(',').map((item) => item.trim()).filter(Boolean);

    return list.length > 0 ? list : undefined;
}

function parseRequiredScopes(value: string, label: string): AgentPermissionScope[] {
    const scopes = parseScopes(value);

    if (!scopes || scopes.length === 0) {
        throw new Error(`${label} must include at least one scope.`);
    }

    return scopes;
}

function parseScopes(value?: string): AgentPermissionScope[] | undefined {
    const list = parseList(value);

    if (!list) {
        return undefined;
    }

    return dedupeScopes(list.map((item) => parseScope(item, 'scope')));
}

function parseScope(value: string, label: string): AgentPermissionScope {
    if (VALID_SCOPES.includes(value as AgentPermissionScope)) {
        return value as AgentPermissionScope;
    }

    throw new Error(`${label} must be one of: ${VALID_SCOPES.join(', ')}`);
}

function dedupeScopes(scopes: AgentPermissionScope[]): AgentPermissionScope[] {
    return VALID_SCOPES.filter((scope) => scopes.includes(scope));
}

function normalizePath(path: string): string {
    if (!path.startsWith('/')) {
        return `/${path}`;
    }

    return path;
}

function readOptionValue(args: string[], index: number, option: string): string {
    const value = args[index];

    if (!value || value.startsWith('--')) {
        throw new Error(`${option} requires a value.`);
    }

    return value;
}

function parseIntegerOption(value: string | undefined, fallback: number, label: string): number {
    if (value === undefined || value === '') {
        return fallback;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${label} must be a non-negative integer.`);
    }

    return parsed;
}

function parseOptionalIntegerOption(value: string | undefined, label: string): number | undefined {
    if (value === undefined || value === '') {
        return undefined;
    }

    return parseIntegerOption(value, 0, label);
}

function isCliEntrypoint(): boolean {
    const entry = process.argv[1];

    return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isCliEntrypoint()) {
    runTaskTimeAgentBridgeCli().catch((error) => {
        process.stderr.write(`TaskTime local agent bridge failed: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
