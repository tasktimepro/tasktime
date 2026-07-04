import { Buffer } from 'node:buffer';
import { Socket, type AddressInfo } from 'node:net';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
    LocalAgentBridge,
    McpBridgeJsonRpcServer,
    decodeWebSocketTextFrames,
    listMcpToolDefinitions,
    startMcpLineDelimitedStdioTransport,
} from './index';
import type { AgentAppSessionResponse } from '@/agent/transport/protocol';

function createBridge(response: AgentAppSessionResponse = {
    protocolVersion: 1,
    requestId: 'bridge-request',
    response: {
        ok: true,
        command: 'create_task',
        data: {
            id: 'task-1',
        },
    },
}) {
    const calls: Array<{
        requestId: string;
        command: string;
        input: unknown;
        timeoutMs?: number;
    }> = [];

    return {
        calls,
        bridge: {
            sendCommand: async (requestId: string, command: string, input?: unknown, timeoutMs?: number) => {
                calls.push({ requestId, command, input, timeoutMs });
                return {
                    ...response,
                    requestId,
                    response: {
                        ...response.response,
                        command,
                    },
                };
            },
        },
    };
}

function readOutput(stream: PassThrough): Promise<string> {
    return new Promise((resolve) => {
        stream.once('data', (chunk) => resolve(chunk.toString('utf8')));
    });
}

function encodeMaskedClientTextFrame(message: string): Buffer {
    const payload = Buffer.from(message);
    const mask = Buffer.from([5, 6, 7, 8]);
    const maskedPayload = Buffer.from(payload);
    let header: Buffer;

    for (let index = 0; index < maskedPayload.length; index += 1) {
        maskedPayload[index] ^= mask[index % 4];
    }

    if (payload.length < 126) {
        header = Buffer.from([0x81, 0x80 | payload.length]);
    } else {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(payload.length, 2);
    }

    return Buffer.concat([header, mask, maskedPayload]);
}

function parseAddress(address: AddressInfo | string | null): AddressInfo {
    if (!address || typeof address === 'string') {
        throw new Error('Expected TCP server address.');
    }

    return address;
}

function connectAppSession(port: number, path: string): Promise<{
    nextMessage: () => Promise<unknown>;
    sendJson: (value: unknown) => void;
    close: () => Promise<void>;
}> {
    return new Promise((resolve, reject) => {
        const socket = new Socket();
        const messages: unknown[] = [];
        const waiters: Array<(message: unknown) => void> = [];
        let buffer = Buffer.alloc(0);
        let open = false;
        let settled = false;

        const push = (message: unknown) => {
            const waiter = waiters.shift();

            if (waiter) {
                waiter(message);
                return;
            }

            messages.push(message);
        };

        const handleFrames = (chunk: Buffer) => {
            for (const message of decodeWebSocketTextFrames(chunk)) {
                push(JSON.parse(message));
            }
        };

        socket.on('error', (error) => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        });

        socket.on('data', (chunk) => {
            if (!open) {
                buffer = Buffer.concat([buffer, chunk]);
                const headerEnd = buffer.indexOf('\r\n\r\n');

                if (headerEnd === -1) {
                    return;
                }

                const header = buffer.subarray(0, headerEnd).toString('utf8');
                const remainder = buffer.subarray(headerEnd + 4);

                if (!header.startsWith('HTTP/1.1 101')) {
                    reject(new Error(header));
                    return;
                }

                open = true;
                settled = true;
                resolve({
                    nextMessage: () => {
                        if (messages.length > 0) {
                            return Promise.resolve(messages.shift());
                        }

                        return new Promise((nextResolve) => {
                            waiters.push(nextResolve);
                        });
                    },
                    sendJson: (value) => socket.write(encodeMaskedClientTextFrame(JSON.stringify(value))),
                    close: () => new Promise((closeResolve) => {
                        socket.once('close', () => closeResolve());
                        socket.end();
                        setTimeout(() => socket.destroy(), 25);
                    }),
                });

                if (remainder.length > 0) {
                    handleFrames(remainder);
                }

                return;
            }

            handleFrames(chunk);
        });

        socket.connect(port, '127.0.0.1', () => {
            socket.write([
                `GET ${path} HTTP/1.1`,
                `Host: 127.0.0.1:${port}`,
                'Upgrade: websocket',
                'Connection: Upgrade',
                'Origin: http://localhost:3101',
                'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
                'Sec-WebSocket-Version: 13',
                '',
                '',
            ].join('\r\n'));
        });
    });
}

describe('MCP bridge tool definitions', () => {
    it('lists tools deterministically according to granted scopes', () => {
        const readTools = listMcpToolDefinitions(new Set(['read']));
        const fullTools = listMcpToolDefinitions(new Set(['read', 'write', 'navigation']));
        const billingTools = listMcpToolDefinitions(new Set(['read', 'write', 'billing', 'navigation']));
        const exportTools = listMcpToolDefinitions(new Set(['read', 'export']));
        const accountTools = listMcpToolDefinitions(new Set(['read', 'write', 'export']));
        const emailTools = listMcpToolDefinitions(new Set(['read', 'write', 'email']));

        expect(readTools.map((tool) => tool.name)).toEqual([...readTools.map((tool) => tool.name)].sort());
        expect(readTools.map((tool) => tool.name)).toContain('get_dashboard_summary');
        expect(readTools.map((tool) => tool.name)).toContain('list_invoices');
        expect(readTools.map((tool) => tool.name)).toContain('list_business_brand_assets');
        expect(readTools.map((tool) => tool.name)).toContain('list_expense_categories');
        expect(readTools.map((tool) => tool.name)).toContain('list_expense_recurrences');
        expect(readTools.map((tool) => tool.name)).toContain('preview_backup_import_json');
        expect(readTools.map((tool) => tool.name)).toContain('get_sync_status');
        expect(readTools.map((tool) => tool.name)).toContain('preview_delete_task');
        expect(readTools.map((tool) => tool.name)).toContain('preview_delete_project');
        expect(readTools.map((tool) => tool.name)).toContain('preview_delete_client');
        expect(readTools.map((tool) => tool.name)).toContain('preview_project_quote');
        expect(readTools.map((tool) => tool.name)).toContain('preview_project_quote_email');
        expect(readTools.map((tool) => tool.name)).not.toContain('export_project_quote_pdf');
        expect(readTools.map((tool) => tool.name)).not.toContain('send_project_quote_email');
        expect(readTools.map((tool) => tool.name)).not.toContain('create_task');
        expect(fullTools.map((tool) => tool.name)).toContain('create_task');
        expect(fullTools.map((tool) => tool.name)).toContain('cascade_delete_task');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_task');
        expect(fullTools.map((tool) => tool.name)).toContain('cascade_delete_project');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_project');
        expect(fullTools.map((tool) => tool.name)).toContain('cascade_delete_client');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_client');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_business_info');
        expect(fullTools.map((tool) => tool.name)).toContain('create_business_brand_asset');
        expect(fullTools.map((tool) => tool.name)).toContain('archive_business_brand_asset');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_business_brand_asset');
        expect(fullTools.map((tool) => tool.name)).toContain('create_expense_category');
        expect(fullTools.map((tool) => tool.name)).toContain('archive_expense_category');
        expect(fullTools.map((tool) => tool.name)).toContain('unarchive_expense_category');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_expense_category');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_expense');
        expect(fullTools.map((tool) => tool.name)).toContain('create_expense_recurrence');
        expect(fullTools.map((tool) => tool.name)).toContain('pause_expense_recurrence');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_expense_recurrence');
        expect(fullTools.map((tool) => tool.name)).toContain('open_dashboard_view');
        expect(fullTools.map((tool) => tool.name)).toContain('open_project_view');
        expect(fullTools.map((tool) => tool.name)).toContain('open_reports_view');
        expect(fullTools.map((tool) => tool.name)).toContain('unarchive_task');
        expect(fullTools.map((tool) => tool.name)).toContain('update_time_entry');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_time_entry');
        expect(fullTools.map((tool) => tool.name)).toContain('mark_tax_return_period_filed');
        expect(fullTools.map((tool) => tool.name)).toContain('mark_tax_return_period_paid');
        expect(fullTools.map((tool) => tool.name)).toContain('update_invoice_draft');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_payment_method');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_invoice_template');
        expect(fullTools.map((tool) => tool.name)).toContain('delete_email_template');
        expect(fullTools.map((tool) => tool.name)).not.toContain('finalize_invoice');
        expect(fullTools.map((tool) => tool.name)).not.toContain('export_invoice_pdf');
        expect(fullTools.map((tool) => tool.name)).not.toContain('send_invoice_email');
        expect(billingTools.map((tool) => tool.name)).toContain('finalize_invoice');
        expect(exportTools.map((tool) => tool.name)).toContain('create_drive_backup');
        expect(exportTools.map((tool) => tool.name)).toContain('download_drive_backup_json');
        expect(exportTools.map((tool) => tool.name)).toContain('export_accountant_pack');
        expect(exportTools.map((tool) => tool.name)).toContain('export_backup_json');
        expect(exportTools.map((tool) => tool.name)).toContain('export_invoice_pdf');
        expect(exportTools.map((tool) => tool.name)).toContain('export_report_csv');
        expect(exportTools.map((tool) => tool.name)).toContain('export_report_pdf');
        expect(exportTools.map((tool) => tool.name)).toContain('list_drive_backups');
        expect(exportTools.map((tool) => tool.name)).not.toContain('restore_backup_json');
        expect(exportTools.map((tool) => tool.name)).not.toContain('restore_drive_backup');
        expect(accountTools.map((tool) => tool.name)).toContain('restore_backup_json');
        expect(accountTools.map((tool) => tool.name)).toContain('restore_drive_backup');
        expect(accountTools.map((tool) => tool.name)).toContain('update_sync_settings');
        expect(accountTools.map((tool) => tool.name)).toContain('delete_all_account_data');
        expect(exportTools.map((tool) => tool.name)).toContain('export_project_quote_pdf');
        expect(emailTools.map((tool) => tool.name)).toContain('send_invoice_email');
        expect(emailTools.map((tool) => tool.name)).toContain('send_project_quote_email');
    });
});

describe('McpBridgeJsonRpcServer', () => {
    it('handles initialize and scoped tools/list requests', async () => {
        const { bridge } = createBridge();
        const server = new McpBridgeJsonRpcServer({
            bridge,
            scopes: ['read'],
        });

        await expect(server.handleMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {},
        })).resolves.toEqual({
            jsonrpc: '2.0',
            id: 1,
            result: {
                protocolVersion: '2025-11-25',
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: 'tasktime-local-bridge',
                    version: '0.1.0',
                },
            },
        });

        const response = await server.handleMessage({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
        });

        expect(response).toEqual(expect.objectContaining({
            jsonrpc: '2.0',
            id: 2,
            result: expect.objectContaining({
                tools: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'get_dashboard_summary',
                        inputSchema: expect.objectContaining({
                            type: 'object',
                        }),
                    }),
                ]),
            }),
        }));
        expect((response?.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name)).not.toContain('create_task');
    });

    it('forwards tools/call requests to the paired bridge and returns structured content', async () => {
        const { bridge, calls } = createBridge();
        const server = new McpBridgeJsonRpcServer({
            bridge,
            scopes: ['read', 'write'],
            requestIdFactory: () => 'mcp-call-1',
            commandTimeoutMs: 1000,
        });

        const response = await server.handleMessage({
            jsonrpc: '2.0',
            id: 'call-1',
            method: 'tools/call',
            params: {
                name: 'create_task',
                arguments: {
                    title: 'From MCP',
                },
            },
        });

        expect(calls).toEqual([
            {
                requestId: 'mcp-call-1',
                command: 'create_task',
                input: {
                    title: 'From MCP',
                },
                timeoutMs: 1000,
            },
        ]);
        expect(response).toEqual({
            jsonrpc: '2.0',
            id: 'call-1',
            result: {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            ok: true,
                            command: 'create_task',
                            data: {
                                id: 'task-1',
                            },
                        }),
                    },
                ],
                structuredContent: {
                    ok: true,
                    command: 'create_task',
                    data: {
                        id: 'task-1',
                    },
                },
                isError: false,
            },
        });
    });

    it('rate-limits MCP tool calls before they reach the app session', async () => {
        const { bridge, calls } = createBridge();
        let now = 1000;
        let nextRequestNumber = 0;
        const server = new McpBridgeJsonRpcServer({
            bridge,
            scopes: ['read'],
            requestIdFactory: () => `mcp-rate-${nextRequestNumber++}`,
            toolCallRateLimit: 2,
            toolCallRateWindowMs: 1000,
            now: () => now,
        });

        const callDashboardSummary = (id: string) => server.handleMessage({
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: {
                name: 'get_dashboard_summary',
                arguments: {},
            },
        });

        await expect(callDashboardSummary('call-1')).resolves.toEqual(expect.objectContaining({
            result: expect.objectContaining({
                isError: false,
            }),
        }));
        await expect(callDashboardSummary('call-2')).resolves.toEqual(expect.objectContaining({
            result: expect.objectContaining({
                isError: false,
            }),
        }));

        const limited = await callDashboardSummary('call-3');

        expect(calls).toHaveLength(2);
        expect(limited?.result).toEqual(expect.objectContaining({
            isError: true,
            structuredContent: expect.objectContaining({
                ok: false,
                error: expect.objectContaining({
                    code: 'RATE_LIMITED',
                    details: {
                        tool: 'get_dashboard_summary',
                        limit: 2,
                        windowMs: 1000,
                        retryAfterMs: 1000,
                    },
                }),
            }),
        }));

        now = 2000;

        await expect(callDashboardSummary('call-4')).resolves.toEqual(expect.objectContaining({
            result: expect.objectContaining({
                isError: false,
            }),
        }));
        expect(calls).toHaveLength(3);
    });

    it('allows MCP tool-call rate limiting to be disabled explicitly', async () => {
        const { bridge, calls } = createBridge();
        const server = new McpBridgeJsonRpcServer({
            bridge,
            scopes: ['read'],
            toolCallRateLimit: 0,
            toolCallRateWindowMs: 1,
            now: () => 1000,
        });

        for (let index = 0; index < 3; index += 1) {
            await expect(server.handleMessage({
                jsonrpc: '2.0',
                id: `disabled-${index}`,
                method: 'tools/call',
                params: {
                    name: 'get_dashboard_summary',
                    arguments: {},
                },
            })).resolves.toEqual(expect.objectContaining({
                result: expect.objectContaining({
                    isError: false,
                }),
            }));
        }

        expect(calls).toHaveLength(3);
    });

    it('returns structured tool errors for denied scopes and unsupported tools', async () => {
        const { bridge, calls } = createBridge();
        const server = new McpBridgeJsonRpcServer({
            bridge,
            scopes: ['read'],
        });

        const denied = await server.handleMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'create_task',
                arguments: {
                    title: 'Denied',
                },
            },
        });
        const unsupported = await server.handleMessage({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'delete_all_data',
                arguments: {},
            },
        });

        expect(calls).toEqual([]);
        expect(denied?.result).toEqual(expect.objectContaining({
            isError: true,
            structuredContent: expect.objectContaining({
                ok: false,
                error: expect.objectContaining({
                    code: 'PERMISSION_DENIED',
                }),
            }),
        }));
        expect(unsupported?.result).toEqual(expect.objectContaining({
            isError: true,
            structuredContent: expect.objectContaining({
                ok: false,
                error: expect.objectContaining({
                    code: 'INVALID_INPUT',
                }),
            }),
        }));
    });

    it('returns structured tool errors when no app session is connected', async () => {
        const bridge = new LocalAgentBridge({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
        });

        try {
            await bridge.start();
            const server = new McpBridgeJsonRpcServer({
                bridge,
                scopes: ['read'],
            });

            const response = await server.handleMessage({
                jsonrpc: '2.0',
                id: 'unavailable',
                method: 'tools/call',
                params: {
                    name: 'get_dashboard_summary',
                    arguments: {},
                },
            });

            expect(response?.result).toEqual(expect.objectContaining({
                isError: true,
                structuredContent: expect.objectContaining({
                    ok: false,
                    error: expect.objectContaining({
                        code: 'UNAVAILABLE',
                        message: 'No TaskTime app session is connected.',
                    }),
                }),
            }));
        } finally {
            await bridge.stop();
        }
    });

    it('ignores notifications and rejects unsupported JSON-RPC methods', async () => {
        const { bridge } = createBridge();
        const server = new McpBridgeJsonRpcServer({
            bridge,
            scopes: ['read'],
        });

        await expect(server.handleMessage({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
        })).resolves.toBeNull();
        await expect(server.handleMessage({
            jsonrpc: '2.0',
            id: 3,
            method: 'unknown/method',
        })).resolves.toEqual({
            jsonrpc: '2.0',
            id: 3,
            error: {
                code: -32601,
                message: 'Unsupported MCP method: unknown/method',
            },
        });
    });

    it('handles newline-delimited stdio JSON-RPC messages', async () => {
        const { bridge } = createBridge();
        const input = new PassThrough();
        const output = new PassThrough();
        const server = new McpBridgeJsonRpcServer({
            bridge,
            scopes: ['read'],
        });
        const stop = startMcpLineDelimitedStdioTransport({
            input,
            output,
            server,
        });
        const pending = readOutput(output);

        input.write(`${JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
        })}\n`);

        await expect(pending).resolves.toContain('"tools"');
        stop();
    });

    it('sends a tool call through LocalAgentBridge to a paired app session', async () => {
        const bridge = new LocalAgentBridge({
            host: '127.0.0.1',
            port: 0,
            allowedOrigins: ['http://localhost:3101'],
            now: () => 1000,
            tokenFactory: () => 'mcp-local-session',
        });
        let appSession: Awaited<ReturnType<typeof connectAppSession>> | null = null;

        try {
            await bridge.start();
            const challenge = bridge.createPairingChallenge({
                scopes: ['read', 'write'],
                idFactory: () => 'mcp-pairing',
                codeFactory: () => '777888',
            });
            const endpoint = new URL(challenge.endpoint);
            appSession = await connectAppSession(
                parseAddress(bridge.server.getAddress()).port,
                `${endpoint.pathname}?pairingId=${challenge.id}&pairingCode=${challenge.code}`
            );

            await expect(appSession.nextMessage()).resolves.toEqual(expect.objectContaining({
                type: 'agent_bridge_session',
                sessionToken: 'mcp-local-session',
            }));

            const mcp = new McpBridgeJsonRpcServer({
                bridge,
                scopes: ['read', 'write'],
                requestIdFactory: () => 'mcp-local-request',
            });
            const pendingMcpResponse = mcp.handleMessage({
                jsonrpc: '2.0',
                id: 'tool-call',
                method: 'tools/call',
                params: {
                    name: 'create_task',
                    arguments: {
                        title: 'From MCP integration',
                    },
                },
            });

            await expect(appSession.nextMessage()).resolves.toEqual({
                protocolVersion: 1,
                requestId: 'mcp-local-request',
                sessionToken: 'mcp-local-session',
                command: 'create_task',
                input: {
                    title: 'From MCP integration',
                },
            });

            appSession.sendJson({
                protocolVersion: 1,
                requestId: 'mcp-local-request',
                response: {
                    ok: true,
                    command: 'create_task',
                    data: {
                        id: 'task-mcp',
                    },
                },
            });

            await expect(pendingMcpResponse).resolves.toEqual(expect.objectContaining({
                jsonrpc: '2.0',
                id: 'tool-call',
                result: expect.objectContaining({
                    structuredContent: {
                        ok: true,
                        command: 'create_task',
                        data: {
                            id: 'task-mcp',
                        },
                    },
                }),
            }));
        } finally {
            await appSession?.close();
            await bridge.stop();
        }
    });
});
