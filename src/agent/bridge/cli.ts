import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Readable, Writable } from 'node:stream';
import { LocalAgentBridge } from './localBridge';
import { McpBridgeJsonRpcServer, startMcpLineDelimitedStdioTransport } from './mcpServer';
import type { BridgePairingChallenge } from './pairing';
import type { AgentPermissionScope } from '@/agent/types';
import type { BridgeAuditEvent } from './auditLog';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 0;
const DEFAULT_PATH = '/tasktime-agent';
const DEFAULT_SCOPES: AgentPermissionScope[] = ['read', 'write', 'navigation'];
const DEFAULT_PAIRING_TTL_MS = 5 * 60 * 1000;
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;
const DEFAULT_TOOL_CALL_RATE_LIMIT = 120;
const DEFAULT_TOOL_CALL_RATE_WINDOW_MS = 60_000;
const DEFAULT_AGENT_ID = 'tasktime.agent.local-bridge';
const DEFAULT_AGENT_LABEL = 'Local agent bridge';
const VALID_SCOPES: AgentPermissionScope[] = ['read', 'write', 'billing', 'export', 'email', 'navigation'];

export interface TaskTimeAgentBridgeCliOptions {
    host: string;
    port: number;
    path: string;
    scopes: AgentPermissionScope[];
    allowedOrigins?: string[];
    agentId: string;
    agentLabel: string;
    pairingTtlMs: number;
    sessionTtlMs?: number;
    commandTimeoutMs: number;
    toolCallRateLimit: number;
    toolCallRateWindowMs: number;
    appUrl?: string;
    statusFile?: string;
    help: boolean;
    manifest: boolean;
}

export interface TaskTimeAgentBridgeCliIo {
    stdin: Readable;
    stdout: Writable;
    stderr: Writable;
}

export interface StartedTaskTimeAgentBridgeCli {
    bridge: LocalAgentBridge;
    challenge: BridgePairingChallenge;
    getStatus: () => TaskTimeAgentBridgeStatus;
    refreshPairing: () => TaskTimeAgentBridgeStatus;
    stop: () => Promise<void>;
}

export interface TaskTimeAgentBridgeStatus {
    schemaVersion: 1;
    pid: number;
    startedAt: string;
    updatedAt: string;
    agent: {
        id: string;
        label: string;
    };
    endpoint: string;
    appUrl?: string;
    launchUrl?: string;
    scopes: AgentPermissionScope[];
    pairing: {
        id: string;
        code: string;
        expiresAt: string;
        expired: boolean;
    };
    session: {
        paired: boolean;
        clientCount: number;
        authoritativeClientId: string | null;
        expiresAt?: string;
    };
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
        agentId: parseRequiredString(env.TASKTIME_AGENT_ID, DEFAULT_AGENT_ID, 'TASKTIME_AGENT_ID'),
        agentLabel: parseRequiredString(env.TASKTIME_AGENT_LABEL, DEFAULT_AGENT_LABEL, 'TASKTIME_AGENT_LABEL'),
        pairingTtlMs: parseIntegerOption(env.TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS, DEFAULT_PAIRING_TTL_MS, 'TASKTIME_AGENT_BRIDGE_PAIRING_TTL_MS'),
        sessionTtlMs: parseOptionalIntegerOption(env.TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS, 'TASKTIME_AGENT_BRIDGE_SESSION_TTL_MS'),
        commandTimeoutMs: parseIntegerOption(env.TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS, DEFAULT_COMMAND_TIMEOUT_MS, 'TASKTIME_AGENT_BRIDGE_COMMAND_TIMEOUT_MS'),
        toolCallRateLimit: parseIntegerOption(env.TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT, DEFAULT_TOOL_CALL_RATE_LIMIT, 'TASKTIME_AGENT_BRIDGE_TOOL_RATE_LIMIT'),
        toolCallRateWindowMs: parsePositiveIntegerOption(env.TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS, DEFAULT_TOOL_CALL_RATE_WINDOW_MS, 'TASKTIME_AGENT_BRIDGE_TOOL_RATE_WINDOW_MS'),
        appUrl: parseOptionalAppUrl(env.TASKTIME_APP_URL, 'TASKTIME_APP_URL'),
        statusFile: parseOptionalString(env.TASKTIME_AGENT_BRIDGE_STATUS_FILE, 'TASKTIME_AGENT_BRIDGE_STATUS_FILE'),
        help: false,
        manifest: false,
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

            case '--manifest':
                options.manifest = true;
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

            case '--agent-id':
                options.agentId = parseRequiredString(readOptionValue(args, ++index, arg), DEFAULT_AGENT_ID, arg);
                break;

            case '--agent-label':
                options.agentLabel = parseRequiredString(readOptionValue(args, ++index, arg), DEFAULT_AGENT_LABEL, arg);
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

            case '--tool-rate-limit':
                options.toolCallRateLimit = parseIntegerOption(readOptionValue(args, ++index, arg), DEFAULT_TOOL_CALL_RATE_LIMIT, arg);
                break;

            case '--tool-rate-window-ms':
                options.toolCallRateWindowMs = parsePositiveIntegerOption(readOptionValue(args, ++index, arg), DEFAULT_TOOL_CALL_RATE_WINDOW_MS, arg);
                break;

            case '--app-url':
                options.appUrl = parseAppUrl(readOptionValue(args, ++index, arg), arg);
                break;

            case '--status-file':
                options.statusFile = parseRequiredString(readOptionValue(args, ++index, arg), '', arg);
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
        'TaskTime Pro local agent bridge',
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
        '  --origin <origin>             Allowed TaskTime Pro browser origin. Can be repeated.',
        '  --agent-id <id>               Stable local agent identity. Default: tasktime.agent.local-bridge',
        '  --agent-label <label>         User-facing local agent label. Default: Local agent bridge',
        '  --pairing-ttl-ms <ms>         Pairing code lifetime. Default: 300000',
        '  --session-ttl-ms <ms>         App-session token lifetime.',
        '  --command-timeout-ms <ms>     App command timeout. Default: 120000',
        '  --tool-rate-limit <count>     Max MCP tools/call requests per window. Default: 120. Use 0 to disable.',
        '  --tool-rate-window-ms <ms>    MCP tools/call rate-limit window. Default: 60000',
        '  --app-url <url>               Print a TaskTime Pro launch URL with pairing details.',
        '  --status-file <path>          Write machine-readable bridge pairing/status JSON.',
        '  --manifest                    Print local agent discovery metadata as JSON and exit.',
        '  --help                        Show this help.',
        '',
        'MCP JSON-RPC messages are read from stdin and written to stdout.',
        'Bridge status and pairing details are written to stderr.',
    ].join('\n');
}

export function getTaskTimeAgentBridgeManifest(): Record<string, unknown> {
    return {
        schemaVersion: 1,
        app: {
            id: 'pro.tasktime',
            name: 'TaskTime Pro',
            category: 'task-time-invoicing',
            localFirst: true,
        },
        docs: {
            llmsTxt: 'https://tasktime.pro/llms.txt',
            agentDocs: 'https://tasktime.pro/agents/',
            quickstart: 'https://tasktime.pro/agents/quickstart/',
            security: 'https://tasktime.pro/agents/security/',
            tools: 'https://tasktime.pro/agents/tools/',
            mcpToolsJson: 'https://tasktime.pro/agents/mcp-tools.json',
            skill: 'https://tasktime.pro/agents/skill.md',
            claude: 'https://tasktime.pro/agents/claude/',
            openClaw: 'https://tasktime.pro/agents/openclaw/',
            debugging: 'https://tasktime.pro/agents/debugging/',
        },
        bridge: {
            packageName: '@tasktimepro/agent-bridge',
            binary: 'tasktime-agent-bridge',
            transport: 'mcp-stdio-json-rpc',
            install: {
                npmPackage: '@tasktimepro/agent-bridge',
                officialMcpRegistryName: 'pro.tasktime/agent-bridge',
                openClawBundlePackage: '@tasktimepro/openclaw',
                claudeCodeMarketplace: 'tasktimepro',
                claudeCodeMarketplaceRepository: 'https://github.com/tasktimepro/tasktime',
                claudeCodePlugin: 'tasktime',
            },
            appSession: {
                protocol: 'websocket',
                defaultPath: DEFAULT_PATH,
                allowedHosts: ['127.0.0.1', 'localhost', '::1'],
                pairingRequired: true,
                defaultSessionTtlMs: 24 * 60 * 60 * 1000,
                resume: {
                    queryParam: 'sessionToken',
                    memoryOnly: true,
                    until: ['session_expiry', 'access_revocation', 'bridge_process_exit'],
                },
            },
            statusFile: {
                argument: '--status-file',
                environment: 'TASKTIME_AGENT_BRIDGE_STATUS_FILE',
                schemaVersion: 1,
            },
            identity: {
                argument: '--agent-id',
                labelArgument: '--agent-label',
                defaultAgentId: DEFAULT_AGENT_ID,
            },
            defaultScopes: DEFAULT_SCOPES,
            optionalScopes: VALID_SCOPES.filter((scope) => !DEFAULT_SCOPES.includes(scope)),
            methods: {
                mcp: ['initialize', 'ping', 'tools/list', 'tools/call'],
                tasktime: ['tasktime/create_approval_token'],
            },
            approvalTokens: {
                format: 'tasktime-hmac-sha256-v1',
                requiresTrustedGrant: true,
                trustedGrantDurations: ['until_revoked', 'today', '30_days'],
                defaultTrustedGrantDuration: 'until_revoked',
                maxTtlMs: 300000,
                singleUse: true,
            },
            launch: {
                accountPath: '/account',
                sectionParam: {
                    name: 'section',
                    value: 'agent',
                },
                pairingParams: {
                    endpoint: 'agentBridgeEndpoint',
                    pairingId: 'agentBridgePairingId',
                    pairingCode: 'agentBridgePairingCode',
                    agentId: 'agentBridgeAgentId',
                    agentLabel: 'agentBridgeAgentLabel',
                },
            },
            recovery: {
                unavailableAction: 'launch_tasktime',
                reason: 'authoritative_app_session_required',
                setupTools: ['get_pairing_status', 'refresh_pairing'],
            },
        },
    };
}

export function buildTaskTimeAgentBridgeLaunchUrl(challenge: BridgePairingChallenge, appUrl: string): string {
    const url = new URL(parseAppUrl(appUrl, 'app URL'));

    url.pathname = '/account';
    url.search = '';
    url.hash = '';
    url.searchParams.set('section', 'agent');
    url.searchParams.set('agentBridgeEndpoint', challenge.endpoint);
    url.searchParams.set('agentBridgePairingId', challenge.id);
    url.searchParams.set('agentBridgePairingCode', challenge.code);
    if (challenge.agentId) {
        url.searchParams.set('agentBridgeAgentId', challenge.agentId);
    }
    if (challenge.agentLabel) {
        url.searchParams.set('agentBridgeAgentLabel', challenge.agentLabel);
    }

    return url.toString();
}

export function formatPairingInstructions(challenge: BridgePairingChallenge, appUrl?: string): string {
    const lines = [
        'TaskTime Pro local agent bridge is running.',
        `App endpoint: ${challenge.endpoint}`,
        `Pairing ID: ${challenge.id}`,
        `Pairing code: ${challenge.code}`,
        `Agent: ${challenge.agentLabel || DEFAULT_AGENT_LABEL} (${challenge.agentId || DEFAULT_AGENT_ID})`,
        `Scopes: ${challenge.scopes.join(',')}`,
        `Pairing expires at: ${new Date(challenge.expiresAt).toISOString()}`,
    ];

    if (appUrl) {
        lines.push(`TaskTime Pro launch URL: ${buildTaskTimeAgentBridgeLaunchUrl(challenge, appUrl)}`);
    }

    lines.push(
        '',
        'Open TaskTime Pro and connect the agent bridge using the endpoint, pairing ID, and pairing code above.'
    );

    return lines.join('\n');
}

export async function startTaskTimeAgentBridgeCli(
    options: TaskTimeAgentBridgeCliOptions,
    io: TaskTimeAgentBridgeCliIo
): Promise<StartedTaskTimeAgentBridgeCli> {
    let activeSessionExpiresAt: number | null = null;
    let currentChallenge: BridgePairingChallenge | null = null;
    let bridge: LocalAgentBridge | null = null;
    const startedAt = new Date().toISOString();
    const statusFile = options.statusFile ? resolve(options.statusFile) : undefined;
    const writeStatus = () => {
        if (!statusFile || !currentChallenge || !bridge) {
            return;
        }

        try {
            mkdirSync(dirname(statusFile), { recursive: true });
            writeFileSync(statusFile, `${JSON.stringify(buildTaskTimeAgentBridgeStatus({
                bridge,
                challenge: currentChallenge,
                appUrl: options.appUrl,
                agentId: options.agentId,
                agentLabel: options.agentLabel,
                startedAt,
                activeSessionExpiresAt,
            }), null, 2)}\n`);
        } catch (error) {
            io.stderr.write(`TaskTime Pro bridge status file write failed: ${error instanceof Error ? error.message : String(error)}\n`);
        }
    };
    const handleAudit = (event: BridgeAuditEvent) => {
        if (event.action === 'pairing_succeeded') {
            activeSessionExpiresAt = typeof event.details?.expiresAt === 'number'
                ? event.details.expiresAt
                : null;
        }

        if (event.action === 'session_disconnected' && bridge?.getClientCount() === 0) {
            activeSessionExpiresAt = null;
        }

        writeStatus();
    };
    bridge = new LocalAgentBridge({
        host: options.host,
        port: options.port,
        path: options.path,
        allowedOrigins: options.allowedOrigins,
        sessionTtlMs: options.sessionTtlMs,
        onAudit: handleAudit,
    });

    await bridge.start();
    const runningBridge = bridge;

    const refreshPairingChallenge = () => {
        currentChallenge = runningBridge.createPairingChallenge({
            scopes: options.scopes,
            ttlMs: options.pairingTtlMs,
            agentId: options.agentId,
            agentLabel: options.agentLabel,
        });
        writeStatus();
        return currentChallenge;
    };
    const getStatus = () => buildTaskTimeAgentBridgeStatus({
        bridge: runningBridge,
        challenge: currentChallenge ?? refreshPairingChallenge(),
        appUrl: options.appUrl,
        agentId: options.agentId,
        agentLabel: options.agentLabel,
        startedAt,
        activeSessionExpiresAt,
    });
    const refreshPairing = () => {
        refreshPairingChallenge();
        return getStatus();
    };

    const initialChallenge = refreshPairingChallenge();

    const mcp = new McpBridgeJsonRpcServer({
        bridge: {
            sendCommand: runningBridge.sendCommand.bind(runningBridge),
            createApprovalToken: runningBridge.createApprovalToken.bind(runningBridge),
            getPairingStatus: getStatus,
            refreshPairing,
        },
        scopes: options.scopes,
        commandTimeoutMs: options.commandTimeoutMs,
        toolCallRateLimit: options.toolCallRateLimit,
        toolCallRateWindowMs: options.toolCallRateWindowMs,
    });
    const stopTransport = startMcpLineDelimitedStdioTransport({
        input: io.stdin,
        output: io.stdout,
        server: mcp,
        onError: (error) => {
            io.stderr.write(`TaskTime Pro MCP bridge error: ${error.message}\n`);
        },
    });

    io.stderr.write(`${formatPairingInstructions(initialChallenge, options.appUrl)}\n`);

    return {
        bridge: runningBridge,
        challenge: initialChallenge,
        getStatus,
        refreshPairing,
        stop: async () => {
            stopTransport();
            await runningBridge.stop();
        },
    };
}

function buildTaskTimeAgentBridgeStatus(options: {
    bridge: LocalAgentBridge;
    challenge: BridgePairingChallenge;
    appUrl?: string;
    agentId: string;
    agentLabel: string;
    startedAt: string;
    activeSessionExpiresAt: number | null;
}): TaskTimeAgentBridgeStatus {
    const now = Date.now();

    return {
        schemaVersion: 1,
        pid: process.pid,
        startedAt: options.startedAt,
        updatedAt: new Date(now).toISOString(),
        agent: {
            id: options.agentId,
            label: options.agentLabel,
        },
        endpoint: options.challenge.endpoint,
        appUrl: options.appUrl,
        launchUrl: options.appUrl ? buildTaskTimeAgentBridgeLaunchUrl(options.challenge, options.appUrl) : undefined,
        scopes: [...options.challenge.scopes],
        pairing: {
            id: options.challenge.id,
            code: options.challenge.code,
            expiresAt: new Date(options.challenge.expiresAt).toISOString(),
            expired: options.challenge.expiresAt <= now,
        },
        session: {
            paired: options.bridge.getClientCount() > 0,
            clientCount: options.bridge.getClientCount(),
            authoritativeClientId: options.bridge.getAuthoritativeClientId(),
            expiresAt: options.activeSessionExpiresAt ? new Date(options.activeSessionExpiresAt).toISOString() : undefined,
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

    if (options.manifest) {
        io.stdout.write(`${JSON.stringify(getTaskTimeAgentBridgeManifest(), null, 2)}\n`);
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

function parsePositiveIntegerOption(value: string | undefined, fallback: number, label: string): number {
    const parsed = parseIntegerOption(value, fallback, label);

    if (parsed <= 0) {
        throw new Error(`${label} must be a positive integer.`);
    }

    return parsed;
}

function parseOptionalAppUrl(value: string | undefined, label: string): string | undefined {
    if (!value) {
        return undefined;
    }

    return parseAppUrl(value, label);
}

function parseOptionalString(value: string | undefined, label: string): string | undefined {
    if (value === undefined || value === '') {
        return undefined;
    }

    return parseRequiredString(value, '', label);
}

function parseRequiredString(value: string | undefined, fallback: string, label: string): string {
    const normalized = value === undefined ? fallback : value;

    if (!normalized.trim()) {
        throw new Error(`${label} must be a non-empty string.`);
    }

    return normalized.trim();
}

function parseAppUrl(value: string, label: string): string {
    let url: URL;

    try {
        url = new URL(value);
    } catch {
        throw new Error(`${label} must be a valid http:// or https:// URL.`);
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`${label} must be a valid http:// or https:// URL.`);
    }

    return url.toString();
}

function isCliEntrypoint(): boolean {
    const entry = process.argv[1];

    if (!entry) {
        return false;
    }

    try {
        return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return import.meta.url === pathToFileURL(entry).href;
    }
}

if (isCliEntrypoint()) {
    runTaskTimeAgentBridgeCli().catch((error) => {
        process.stderr.write(`TaskTime Pro local agent bridge failed: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
