import { createHash } from 'node:crypto';
import type { Readable, Writable } from 'node:stream';
import { AgentCommandError, type AgentPermissionScope } from '@/agent/types';
import type { AgentAppSessionApprovalToken, AgentAppSessionResponse } from '@/agent/transport/protocol';
import { getMcpToolDefinition, listMcpToolDefinitions } from './mcpTools';

const MCP_PROTOCOL_VERSION = '2025-11-25';
const JSON_RPC_VERSION = '2.0';
const DEFAULT_TOOL_CALL_RATE_LIMIT = 120;
const DEFAULT_TOOL_CALL_RATE_WINDOW_MS = 60_000;
const MAX_APPROVAL_TOKEN_TTL_MS = 5 * 60_000;

export interface McpBridgeCommandSender {
    sendCommand: (
        requestId: string,
        command: string,
        input?: unknown,
        timeoutMs?: number,
        approval?: AgentAppSessionApprovalToken
    ) => Promise<AgentAppSessionResponse>;
    createApprovalToken?: (options: {
        grantId?: string;
        command: string;
        inputHash: string;
        scopes: AgentPermissionScope[];
        category?: string;
        ttlMs?: number;
        nonce?: string;
    }) => AgentAppSessionApprovalToken;
}

export interface McpBridgeServerOptions {
    bridge: McpBridgeCommandSender;
    scopes: Iterable<AgentPermissionScope>;
    requestIdFactory?: () => string;
    commandTimeoutMs?: number;
    toolCallRateLimit?: number;
    toolCallRateWindowMs?: number;
    now?: () => number;
}

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: string | number | null;
    method?: string;
    params?: unknown;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

interface McpToolCallParams {
    name?: unknown;
    arguments?: unknown;
    approval?: unknown;
}

interface McpApprovalTokenParams {
    grantId?: unknown;
    command?: unknown;
    arguments?: unknown;
    inputHash?: unknown;
    scopes?: unknown;
    category?: unknown;
    ttlMs?: unknown;
    nonce?: unknown;
}

interface McpStdioTransportOptions {
    input: Readable;
    output: Writable;
    server: McpBridgeJsonRpcServer;
    onError?: (error: Error) => void;
}

export class McpBridgeJsonRpcServer {

    private readonly bridge: McpBridgeCommandSender;
    private readonly scopes: Set<AgentPermissionScope>;
    private readonly commandTimeoutMs?: number;
    private readonly requestIdFactory: () => string;
    private readonly toolCallRateLimit: number;
    private readonly toolCallRateWindowMs: number;
    private readonly now: () => number;
    private toolCallWindowStartedAt: number;
    private toolCallCount = 0;
    private nextRequestId = 0;

    constructor(options: McpBridgeServerOptions) {
        this.bridge = options.bridge;
        this.scopes = new Set(options.scopes);
        this.commandTimeoutMs = options.commandTimeoutMs;
        this.requestIdFactory = options.requestIdFactory ?? (() => `mcp-request-${this.nextRequestId++}`);
        this.toolCallRateLimit = options.toolCallRateLimit ?? DEFAULT_TOOL_CALL_RATE_LIMIT;
        this.toolCallRateWindowMs = options.toolCallRateWindowMs ?? DEFAULT_TOOL_CALL_RATE_WINDOW_MS;
        this.now = options.now ?? (() => Date.now());

        if (!Number.isInteger(this.toolCallRateLimit) || this.toolCallRateLimit < 0) {
            throw new Error('toolCallRateLimit must be a non-negative integer.');
        }

        if (!Number.isInteger(this.toolCallRateWindowMs) || this.toolCallRateWindowMs <= 0) {
            throw new Error('toolCallRateWindowMs must be a positive integer.');
        }

        this.toolCallWindowStartedAt = this.now();
    }

    async handleMessage(message: unknown): Promise<JsonRpcResponse | null> {
        if (!isJsonRpcRequest(message)) {
            return this.error(null, -32600, 'Invalid JSON-RPC request.');
        }

        if (message.id === undefined) {
            return null;
        }

        switch (message.method) {
            case 'initialize':
                return this.result(message.id, {
                    protocolVersion: MCP_PROTOCOL_VERSION,
                    capabilities: {
                        tools: {},
                    },
                    serverInfo: {
                        name: 'tasktime-local-bridge',
                        version: '0.1.0',
                    },
                });

            case 'ping':
                return this.result(message.id, {});

            case 'tools/list':
                return this.result(message.id, {
                    tools: listMcpToolDefinitions(this.scopes).map((tool) => ({
                        name: tool.name,
                        description: tool.description,
                        inputSchema: tool.inputSchema,
                    })),
                });

            case 'tools/call':
                return this.result(message.id, await this.callTool(message.params));

            case 'tasktime/create_approval_token':
                return this.result(message.id, await this.createApprovalToken(message.params));

            default:
                return this.error(message.id, -32601, `Unsupported MCP method: ${message.method || 'unknown'}`);
        }
    }

    private async callTool(params: unknown): Promise<unknown> {
        const callParams = params as McpToolCallParams;

        if (!callParams || typeof callParams !== 'object' || typeof callParams.name !== 'string') {
            return createToolError('INVALID_INPUT', 'tools/call requires a string tool name.');
        }

        const tool = getMcpToolDefinition(callParams.name);

        if (!tool) {
            return createToolError('INVALID_INPUT', `Unsupported TaskTime Pro tool: ${callParams.name}`);
        }

        const missingScope = tool.scopes.find((scope) => !this.scopes.has(scope));

        if (missingScope) {
            return createToolError('PERMISSION_DENIED', `Missing ${missingScope} permission.`, {
                scope: missingScope,
            });
        }

        const rateLimitError = this.consumeToolCallBudget(tool.name);

        if (rateLimitError) {
            return rateLimitError;
        }

        let response: AgentAppSessionResponse;

        try {
            response = await this.bridge.sendCommand(
                this.requestIdFactory(),
                tool.name,
                callParams.arguments ?? {},
                this.commandTimeoutMs,
                getApprovalToken(callParams.approval)
            );
        } catch (error) {
            if (error instanceof AgentCommandError) {
                return createToolError(error.code, error.message, getToolErrorDetails(error));
            }

            return createToolError(
                'UNAVAILABLE',
                error instanceof Error ? error.message : 'TaskTime Pro app session is unavailable.',
                getUnavailableAppSessionRecoveryDetails()
            );
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response.response),
                },
            ],
            structuredContent: response.response,
            isError: !response.response.ok,
        };
    }

    private async createApprovalToken(params: unknown): Promise<unknown> {
        if (!this.bridge.createApprovalToken) {
            return createToolError('UNAVAILABLE', 'TaskTime Pro approval-token signing is unavailable.');
        }

        const tokenParams = params as McpApprovalTokenParams;

        if (!tokenParams || typeof tokenParams !== 'object' || typeof tokenParams.command !== 'string') {
            return createToolError('INVALID_INPUT', 'tasktime/create_approval_token requires a string command.');
        }

        const tool = getMcpToolDefinition(tokenParams.command);

        if (!tool) {
            return createToolError('INVALID_INPUT', `Unsupported TaskTime Pro tool: ${tokenParams.command}`);
        }

        const scopes = parseApprovalScopes(tokenParams.scopes, tool.scopes);

        if (!scopes) {
            return createToolError('INVALID_INPUT', 'Approval token scopes must be an array of strings.');
        }

        const missingScope = scopes.find((scope) => !this.scopes.has(scope));

        if (missingScope) {
            return createToolError('PERMISSION_DENIED', `Missing ${missingScope} permission.`, {
                scope: missingScope,
            });
        }

        const ttlMs = parseApprovalTokenTtl(tokenParams.ttlMs);

        if (ttlMs === null) {
            return createToolError('INVALID_INPUT', 'Approval token ttlMs must be a positive integer no greater than 300000.');
        }

        try {
            const inputHash = typeof tokenParams.inputHash === 'string'
                ? tokenParams.inputHash
                : createMcpCommandInputHash(tokenParams.arguments ?? {});
            const approval = this.bridge.createApprovalToken({
                grantId: typeof tokenParams.grantId === 'string' ? tokenParams.grantId : undefined,
                command: tokenParams.command,
                inputHash,
                scopes,
                category: typeof tokenParams.category === 'string' ? tokenParams.category : undefined,
                ttlMs,
                nonce: typeof tokenParams.nonce === 'string' ? tokenParams.nonce : undefined,
            });

            return {
                approval,
            };
        } catch (error) {
            if (error instanceof AgentCommandError) {
                return createToolError(error.code, error.message, getToolErrorDetails(error));
            }

            return createToolError('UNAVAILABLE', error instanceof Error ? error.message : 'TaskTime Pro approval-token signing failed.');
        }
    }

    private consumeToolCallBudget(toolName: string): unknown | null {
        if (this.toolCallRateLimit <= 0) {
            return null;
        }

        const currentTime = this.now();

        if (currentTime - this.toolCallWindowStartedAt >= this.toolCallRateWindowMs) {
            this.toolCallWindowStartedAt = currentTime;
            this.toolCallCount = 0;
        }

        if (this.toolCallCount >= this.toolCallRateLimit) {
            const retryAfterMs = Math.max(0, this.toolCallRateWindowMs - (currentTime - this.toolCallWindowStartedAt));

            return createToolError('RATE_LIMITED', 'TaskTime Pro MCP tool call rate limit exceeded.', {
                tool: toolName,
                limit: this.toolCallRateLimit,
                windowMs: this.toolCallRateWindowMs,
                retryAfterMs,
            });
        }

        this.toolCallCount += 1;
        return null;
    }

    private result(id: string | number | null, result: unknown): JsonRpcResponse {
        return {
            jsonrpc: JSON_RPC_VERSION,
            id,
            result,
        };
    }

    private error(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
        return {
            jsonrpc: JSON_RPC_VERSION,
            id,
            error: {
                code,
                message,
                data,
            },
        };
    }
}

function getApprovalToken(value: unknown): AgentAppSessionApprovalToken | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }

    const candidate = value as Partial<AgentAppSessionApprovalToken>;

    if (typeof candidate.token !== 'string' || candidate.token.trim().length === 0) {
        return undefined;
    }

    return candidate as AgentAppSessionApprovalToken;
}

function parseApprovalScopes(value: unknown, fallback: AgentPermissionScope[]): AgentPermissionScope[] | null {
    if (value === undefined) {
        return fallback;
    }

    if (!Array.isArray(value) || !value.every((scope) => typeof scope === 'string')) {
        return null;
    }

    return value as AgentPermissionScope[];
}

function canonicalizeJson(value: unknown): unknown {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
        return null;
    }

    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => canonicalizeJson(item));
    }

    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, item]) => item !== undefined && typeof item !== 'function' && typeof item !== 'symbol')
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, canonicalizeJson(item)])
        );
    }

    return null;
}

function createMcpCommandInputHash(input: unknown): string {
    const canonicalJson = JSON.stringify(canonicalizeJson(input ?? {}));

    return `sha256:${createHash('sha256').update(canonicalJson).digest('hex')}`;
}

function parseApprovalTokenTtl(value: unknown): number | undefined | null {
    if (value === undefined) {
        return undefined;
    }

    if (!Number.isInteger(value) || (value as number) <= 0 || (value as number) > MAX_APPROVAL_TOKEN_TTL_MS) {
        return null;
    }

    return value as number;
}

function getToolErrorDetails(error: AgentCommandError): Record<string, unknown> | undefined {
    if (error.code !== 'UNAVAILABLE') {
        return error.details;
    }

    return {
        ...error.details,
        ...getUnavailableAppSessionRecoveryDetails(),
    };
}

function getUnavailableAppSessionRecoveryDetails(): Record<string, unknown> {
    return {
        recovery: {
            action: 'launch_tasktime',
            reason: 'authoritative_app_session_required',
            message: 'Open TaskTime Pro and connect the local agent bridge, then retry the tool call.',
        },
    };
}

export function createToolError(code: string, message: string, details?: Record<string, unknown>): unknown {
    const error = {
        ok: false,
        command: 'tools/call',
        error: {
            code,
            message,
            details,
        },
    };

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(error),
            },
        ],
        structuredContent: error,
        isError: true,
    };
}

export function startMcpLineDelimitedStdioTransport(options: McpStdioTransportOptions): () => void {
    let buffer = '';

    const onData = (chunk: Buffer | string) => {
        buffer += chunk.toString();

        while (buffer.includes('\n')) {
            const newlineIndex = buffer.indexOf('\n');
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (!line) {
                continue;
            }

            void handleLine(line, options);
        }
    };

    options.input.on('data', onData);

    return () => {
        options.input.off('data', onData);
    };
}

async function handleLine(line: string, options: McpStdioTransportOptions): Promise<void> {
    try {
        const response = await options.server.handleMessage(JSON.parse(line));

        if (response) {
            options.output.write(`${JSON.stringify(response)}\n`);
        }
    } catch (error) {
        const normalized = error instanceof Error ? error : new Error('MCP stdio message handling failed.');
        options.onError?.(normalized);
        options.output.write(`${JSON.stringify({
            jsonrpc: JSON_RPC_VERSION,
            id: null,
            error: {
                code: -32700,
                message: normalized.message,
            },
        })}\n`);
    }
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<JsonRpcRequest>;

    return candidate.jsonrpc === JSON_RPC_VERSION
        && typeof candidate.method === 'string';
}
