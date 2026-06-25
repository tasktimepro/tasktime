import type { Readable, Writable } from 'node:stream';
import { AgentCommandError, type AgentPermissionScope } from '@/agent/types';
import type { AgentAppSessionResponse } from '@/agent/transport/protocol';
import { getMcpToolDefinition, listMcpToolDefinitions } from './mcpTools';

const MCP_PROTOCOL_VERSION = '2025-11-25';
const JSON_RPC_VERSION = '2.0';

export interface McpBridgeCommandSender {
    sendCommand: (
        requestId: string,
        command: string,
        input?: unknown,
        timeoutMs?: number
    ) => Promise<AgentAppSessionResponse>;
}

export interface McpBridgeServerOptions {
    bridge: McpBridgeCommandSender;
    scopes: Iterable<AgentPermissionScope>;
    requestIdFactory?: () => string;
    commandTimeoutMs?: number;
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
    private nextRequestId = 0;

    constructor(options: McpBridgeServerOptions) {
        this.bridge = options.bridge;
        this.scopes = new Set(options.scopes);
        this.commandTimeoutMs = options.commandTimeoutMs;
        this.requestIdFactory = options.requestIdFactory ?? (() => `mcp-request-${this.nextRequestId++}`);
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
            return createToolError('INVALID_INPUT', `Unsupported TaskTime tool: ${callParams.name}`);
        }

        const missingScope = tool.scopes.find((scope) => !this.scopes.has(scope));

        if (missingScope) {
            return createToolError('PERMISSION_DENIED', `Missing ${missingScope} permission.`, {
                scope: missingScope,
            });
        }

        let response: AgentAppSessionResponse;

        try {
            response = await this.bridge.sendCommand(
                this.requestIdFactory(),
                tool.name,
                callParams.arguments ?? {},
                this.commandTimeoutMs
            );
        } catch (error) {
            if (error instanceof AgentCommandError) {
                return createToolError(error.code, error.message, error.details);
            }

            return createToolError('UNAVAILABLE', error instanceof Error ? error.message : 'TaskTime app session is unavailable.');
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
