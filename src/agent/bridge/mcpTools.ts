import type { AgentCommandName } from '@/agent/commands/registry';
import type { AgentPermissionScope } from '@/agent/types';

export type JsonSchema = {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
};

export interface McpToolDefinition {
    name: AgentCommandName;
    description: string;
    scopes: AgentPermissionScope[];
    inputSchema: JsonSchema;
}

const optionalString = { type: 'string' };
const optionalNumber = { type: 'number' };
const optionalBoolean = { type: 'boolean' };
const nullableString = { type: ['string', 'null'] };

const emptySchema: JsonSchema = {
    type: 'object',
    properties: {},
    additionalProperties: false,
};

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
    {
        name: 'list_projects',
        description: 'List active TaskTime projects visible to the paired app session.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'list_tasks',
        description: 'List TaskTime tasks, optionally scoped to a project ID.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: nullableString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_task',
        description: 'Create a TaskTime task or subtask. Subtasks cannot be recurring.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                title: optionalString,
                projectId: nullableString,
                parentTaskId: nullableString,
                note: nullableString,
                billable: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['title'],
            additionalProperties: true,
        },
    },
    {
        name: 'update_task',
        description: 'Update an existing TaskTime task.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                updates: { type: 'object' },
            },
            required: ['taskId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'complete_task',
        description: 'Complete a non-recurring task or a specific recurring occurrence.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                occurrenceDate: optionalString,
            },
            required: ['taskId'],
            additionalProperties: false,
        },
    },
    {
        name: 'archive_task',
        description: 'Archive a task using TaskTime archive behavior. This is not a destructive delete.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
            },
            required: ['taskId'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_active_timers',
        description: 'List active timers with resolved timer keys and elapsed time.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'start_timer',
        description: 'Start a timer for a task. Existing active timers for the same key are not overwritten.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                note: optionalString,
                idempotencyKey: optionalString,
            },
            required: ['taskId'],
            additionalProperties: false,
        },
    },
    {
        name: 'pause_timer',
        description: 'Pause a timer by timer key or task ID.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                timerKey: optionalString,
                taskId: optionalString,
                pausedAt: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'stop_timer',
        description: 'Stop a timer and create the matching time entry.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                timerKey: optionalString,
                taskId: optionalString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'add_manual_time_entry',
        description: 'Create a manual time entry after TaskTime validates billing cutoffs and overlaps.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                start: optionalNumber,
                end: optionalNumber,
                note: optionalString,
                idempotencyKey: optionalString,
            },
            required: ['taskId', 'start', 'end'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_expenses',
        description: 'List expenses, optionally scoped by client, project, or billable state.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: nullableString,
                projectId: nullableString,
                billableOnly: optionalBoolean,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_expense',
        description: 'Create an expense through the TaskTime command layer.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                title: optionalString,
                date: optionalString,
                amount: optionalNumber,
                currency: optionalString,
                isPersonal: optionalBoolean,
                billable: optionalBoolean,
                clientId: nullableString,
                projectId: nullableString,
                idempotencyKey: optionalString,
            },
            required: ['title', 'date', 'amount', 'currency', 'isPersonal', 'billable'],
            additionalProperties: true,
        },
    },
    {
        name: 'mark_expense_paid',
        description: 'Mark an expense paid using existing TaskTime payment snapshot behavior.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseId: optionalString,
                amount: optionalNumber,
                paidOn: nullableString,
                paidBy: nullableString,
            },
            required: ['expenseId'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_expense_unpaid',
        description: 'Mark an expense unpaid.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseId: optionalString,
            },
            required: ['expenseId'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_invoices',
        description: 'List invoices as bounded summary records, optionally scoped by client, project, or status.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: nullableString,
                projectId: nullableString,
                status: { enum: ['draft', 'sent', 'paid', 'overdue'] },
                limit: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'preview_invoice_from_unbilled_work',
        description: 'Calculate a read-only invoice preview from unbilled project work. This does not create invoices, mark billing state, or advance invoice numbering.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
                billingPeriodStart: optionalString,
                billingPeriodEnd: optionalString,
                includeClientLevelExpenses: optionalBoolean,
                exchangeRates: { type: ['object', 'null'] },
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'create_invoice_draft',
        description: 'Create a draft invoice from unbilled project work. This creates only a draft invoice record and does not mark entries or expenses billed, update task billing cutoffs, update project invoice references, or advance invoice numbering.',
        scopes: ['read', 'write'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
                clientId: optionalString,
                invoiceNumber: optionalString,
                invoiceDate: optionalString,
                dueDate: nullableString,
                templateId: nullableString,
                businessInfoId: nullableString,
                paymentMethodId: nullableString,
                notes: optionalString,
                billingPeriodStart: optionalString,
                billingPeriodEnd: optionalString,
                includeClientLevelExpenses: optionalBoolean,
                exchangeRates: { type: ['object', 'null'] },
                idempotencyKey: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'finalize_invoice',
        description: 'Finalize an agent-created draft invoice after explicit confirmation. This marks matching active time entries and expenses billed, updates task billing cutoffs, links the invoice to the project, advances invoice sequence state, and changes the invoice from draft to sent.',
        scopes: ['read', 'write', 'billing'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                confirmFinalize: optionalBoolean,
                finalizedAt: optionalNumber,
                idempotencyKey: optionalString,
            },
            required: ['invoiceId', 'confirmFinalize'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_invoice_paid',
        description: 'Mark an invoice paid after explicit confirmation. Cross-currency invoices require exchange rates so TaskTime can store the existing payment currency snapshot.',
        scopes: ['read', 'write', 'billing'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                confirmPaid: optionalBoolean,
                paidAt: optionalNumber,
                exchangeRates: { type: ['object', 'null'] },
                idempotencyKey: optionalString,
            },
            required: ['invoiceId', 'confirmPaid'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_invoice_unpaid',
        description: 'Mark an invoice unpaid after explicit confirmation, matching TaskTime UI status fallback behavior.',
        scopes: ['read', 'write', 'billing'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                confirmUnpaid: optionalBoolean,
                referenceAt: optionalNumber,
                idempotencyKey: optionalString,
            },
            required: ['invoiceId', 'confirmUnpaid'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_dashboard_summary',
        description: 'Get a bounded summary of current TaskTime work, timers, unbilled time, expenses, and draft invoices.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'get_project_overview',
        description: 'Get a bounded project summary with task, timer, unbilled time, expense, and invoice counts.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_client_overview',
        description: 'Get a bounded client summary with project, expense, and invoice totals.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
            },
            required: ['clientId'],
            additionalProperties: false,
        },
    },
    {
        name: 'find_unbilled_time',
        description: 'Find recent unbilled time entries, optionally scoped by project or task.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: nullableString,
                taskId: nullableString,
                limit: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'list_recent_entries',
        description: 'List recent time entries as bounded summary records.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: nullableString,
                taskId: nullableString,
                limit: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'open_project_view',
        description: 'Open a project view in the paired TaskTime app session after validating the project exists.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'open_client_view',
        description: 'Open a client view in the paired TaskTime app session after validating the client exists.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
            },
            required: ['clientId'],
            additionalProperties: false,
        },
    },
    {
        name: 'open_invoice_view',
        description: 'Open the invoices route, optionally focused on an existing invoice.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'open_expenses_view',
        description: 'Open the expenses route, optionally scoped by client or project.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
                projectId: optionalString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'focus_running_timer',
        description: 'Focus the TaskTime app on a running timer by timer key or task ID.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                timerKey: optionalString,
                taskId: optionalString,
            },
            additionalProperties: false,
        },
    },
];

export function listMcpToolDefinitions(scopes: Set<AgentPermissionScope>): McpToolDefinition[] {
    return MCP_TOOL_DEFINITIONS
        .filter((tool) => tool.scopes.every((scope) => scopes.has(scope)))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function getMcpToolDefinition(name: string): McpToolDefinition | null {
    return MCP_TOOL_DEFINITIONS.find((tool) => tool.name === name) ?? null;
}
