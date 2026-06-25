import type { AgentCommandContext, AgentCommandHandler, AgentCommandResponse, AgentPermissionScope } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import {
    archiveTaskCommand,
    completeTaskCommand,
    createTaskCommand,
    listProjectsCommand,
    listTasksCommand,
    updateTaskCommand,
} from './tasks';
import {
    addManualTimeEntryCommand,
    getActiveTimersCommand,
    pauseTimerCommand,
    startTimerCommand,
    stopTimerCommand,
} from './timers';
import {
    createExpenseCommand,
    listExpensesCommand,
    markExpensePaidCommand,
    markExpenseUnpaidCommand,
} from './expenses';
import {
    createInvoiceDraftFromUnbilledWorkCommand,
    finalizeInvoiceCommand,
    listInvoicesCommand,
    markInvoicePaidCommand,
    markInvoiceUnpaidCommand,
    previewInvoiceFromUnbilledWorkCommand,
} from './invoices';
import {
    focusRunningTimerCommand,
    openClientViewCommand,
    openExpensesViewCommand,
    openInvoiceViewCommand,
    openProjectViewCommand,
} from './navigation';
import {
    findUnbilledTimeCommand,
    getClientOverviewCommand,
    getDashboardSummaryCommand,
    getProjectOverviewCommand,
    listRecentEntriesCommand,
} from './queries';

export type AgentCommandName =
    | 'list_projects'
    | 'list_tasks'
    | 'create_task'
    | 'update_task'
    | 'complete_task'
    | 'archive_task'
    | 'get_active_timers'
    | 'start_timer'
    | 'pause_timer'
    | 'stop_timer'
    | 'add_manual_time_entry'
    | 'list_expenses'
    | 'create_expense'
    | 'mark_expense_paid'
    | 'mark_expense_unpaid'
    | 'list_invoices'
    | 'preview_invoice_from_unbilled_work'
    | 'create_invoice_draft'
    | 'finalize_invoice'
    | 'mark_invoice_paid'
    | 'mark_invoice_unpaid'
    | 'get_dashboard_summary'
    | 'get_project_overview'
    | 'get_client_overview'
    | 'find_unbilled_time'
    | 'list_recent_entries'
    | 'open_project_view'
    | 'open_client_view'
    | 'open_invoice_view'
    | 'open_expenses_view'
    | 'focus_running_timer';

export interface AgentCommandDefinition<Input = unknown, Output = unknown> {
    name: AgentCommandName;
    description: string;
    scopes: AgentPermissionScope[];
    requiresApproval?: boolean;
    handler: AgentCommandHandler<Input, Output>;
}

type Registry = Record<AgentCommandName, AgentCommandDefinition<any, any>>;

export const AGENT_COMMAND_REGISTRY: Registry = {
    list_projects: {
        name: 'list_projects',
        description: 'List active projects visible to the current TaskTime app session.',
        scopes: ['read'],
        handler: (context) => listProjectsCommand(context),
    },
    list_tasks: {
        name: 'list_tasks',
        description: 'List tasks, optionally scoped to a project.',
        scopes: ['read'],
        handler: listTasksCommand,
    },
    create_task: {
        name: 'create_task',
        description: 'Create a task or subtask through the TaskTime command layer.',
        scopes: ['write'],
        handler: createTaskCommand,
    },
    update_task: {
        name: 'update_task',
        description: 'Update a task through the TaskTime command layer.',
        scopes: ['write'],
        handler: updateTaskCommand,
    },
    complete_task: {
        name: 'complete_task',
        description: 'Mark a non-recurring task or specific recurring occurrence complete.',
        scopes: ['write'],
        handler: completeTaskCommand,
    },
    archive_task: {
        name: 'archive_task',
        description: 'Archive a task using existing TaskTime archive behavior.',
        scopes: ['write'],
        handler: archiveTaskCommand,
    },
    get_active_timers: {
        name: 'get_active_timers',
        description: 'List active TaskTime timers with resolved timer keys.',
        scopes: ['read'],
        handler: (context) => getActiveTimersCommand(context),
    },
    start_timer: {
        name: 'start_timer',
        description: 'Start a timer for a task without replacing an existing timer.',
        scopes: ['write'],
        handler: startTimerCommand,
    },
    pause_timer: {
        name: 'pause_timer',
        description: 'Pause a timer by timer key or task context.',
        scopes: ['write'],
        handler: pauseTimerCommand,
    },
    stop_timer: {
        name: 'stop_timer',
        description: 'Stop a timer and create the corresponding time entry.',
        scopes: ['write'],
        handler: stopTimerCommand,
    },
    add_manual_time_entry: {
        name: 'add_manual_time_entry',
        description: 'Create a manual time entry after validating billing cutoffs and overlap rules.',
        scopes: ['write'],
        handler: addManualTimeEntryCommand,
    },
    list_expenses: {
        name: 'list_expenses',
        description: 'List active expenses, optionally scoped by client or project.',
        scopes: ['read'],
        handler: listExpensesCommand,
    },
    create_expense: {
        name: 'create_expense',
        description: 'Create an expense through the TaskTime command layer.',
        scopes: ['write'],
        handler: createExpenseCommand,
    },
    mark_expense_paid: {
        name: 'mark_expense_paid',
        description: 'Mark an expense paid using existing payment snapshot behavior.',
        scopes: ['write'],
        handler: markExpensePaidCommand,
    },
    mark_expense_unpaid: {
        name: 'mark_expense_unpaid',
        description: 'Mark an expense unpaid.',
        scopes: ['write'],
        handler: markExpenseUnpaidCommand,
    },
    list_invoices: {
        name: 'list_invoices',
        description: 'List invoices with bounded summary fields, optionally scoped by client, project, or status.',
        scopes: ['read'],
        handler: listInvoicesCommand,
    },
    preview_invoice_from_unbilled_work: {
        name: 'preview_invoice_from_unbilled_work',
        description: 'Calculate a read-only invoice preview from unbilled project work without creating billing side effects.',
        scopes: ['read'],
        handler: previewInvoiceFromUnbilledWorkCommand,
    },
    create_invoice_draft: {
        name: 'create_invoice_draft',
        description: 'Create a draft invoice from unbilled project work without marking entries or expenses billed.',
        scopes: ['read', 'write'],
        handler: createInvoiceDraftFromUnbilledWorkCommand,
    },
    finalize_invoice: {
        name: 'finalize_invoice',
        description: 'Finalize a draft invoice and apply billing side effects after explicit confirmation.',
        scopes: ['read', 'write', 'billing'],
        requiresApproval: true,
        handler: finalizeInvoiceCommand,
    },
    mark_invoice_paid: {
        name: 'mark_invoice_paid',
        description: 'Mark an invoice paid after explicit confirmation, preserving payment currency snapshot behavior.',
        scopes: ['read', 'write', 'billing'],
        requiresApproval: true,
        handler: markInvoicePaidCommand,
    },
    mark_invoice_unpaid: {
        name: 'mark_invoice_unpaid',
        description: 'Mark an invoice unpaid after explicit confirmation, preserving the UI status fallback behavior.',
        scopes: ['read', 'write', 'billing'],
        requiresApproval: true,
        handler: markInvoiceUnpaidCommand,
    },
    get_dashboard_summary: {
        name: 'get_dashboard_summary',
        description: 'Return a bounded summary of current TaskTime work, timers, unbilled time, expenses, and draft invoices.',
        scopes: ['read'],
        handler: (context) => getDashboardSummaryCommand(context),
    },
    get_project_overview: {
        name: 'get_project_overview',
        description: 'Return a bounded project summary with task, timer, unbilled time, expense, and invoice counts.',
        scopes: ['read'],
        handler: getProjectOverviewCommand,
    },
    get_client_overview: {
        name: 'get_client_overview',
        description: 'Return a bounded client summary with project, expense, and invoice totals.',
        scopes: ['read'],
        handler: getClientOverviewCommand,
    },
    find_unbilled_time: {
        name: 'find_unbilled_time',
        description: 'Find recent unbilled time entries, optionally scoped by project or task.',
        scopes: ['read'],
        handler: findUnbilledTimeCommand,
    },
    list_recent_entries: {
        name: 'list_recent_entries',
        description: 'List recent time entries with bounded results and summarized fields.',
        scopes: ['read'],
        handler: listRecentEntriesCommand,
    },
    open_project_view: {
        name: 'open_project_view',
        description: 'Open a validated project route in the paired TaskTime app session.',
        scopes: ['navigation'],
        handler: openProjectViewCommand,
    },
    open_client_view: {
        name: 'open_client_view',
        description: 'Open a validated client route in the paired TaskTime app session.',
        scopes: ['navigation'],
        handler: openClientViewCommand,
    },
    open_invoice_view: {
        name: 'open_invoice_view',
        description: 'Open the invoices route after validating an optional invoice ID.',
        scopes: ['navigation'],
        handler: openInvoiceViewCommand,
    },
    open_expenses_view: {
        name: 'open_expenses_view',
        description: 'Open the expenses route, optionally scoped by client or project.',
        scopes: ['navigation'],
        handler: openExpensesViewCommand,
    },
    focus_running_timer: {
        name: 'focus_running_timer',
        description: 'Focus the app on a validated running timer.',
        scopes: ['navigation'],
        handler: focusRunningTimerCommand,
    },
};

export function listAgentCommandDefinitions(context: AgentCommandContext): Array<Omit<AgentCommandDefinition, 'handler'>> {
    return Object.values(AGENT_COMMAND_REGISTRY)
        .filter((definition) => definition.scopes.every((scope) => !context.permissions || context.permissions.has(scope)))
        .map((definition) => ({
            name: definition.name,
            description: definition.description,
            scopes: definition.scopes,
            requiresApproval: definition.requiresApproval,
        }));
}

export function agentCommandRequiresApproval(command: string): boolean {
    return AGENT_COMMAND_REGISTRY[command as AgentCommandName]?.requiresApproval === true;
}

function normalizeError(command: string, error: unknown): AgentCommandResponse {
    if (error instanceof AgentCommandError) {
        return {
            ok: false,
            command,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        };
    }

    return {
        ok: false,
        command,
        error: {
            code: 'INVALID_INPUT',
            message: error instanceof Error ? error.message : 'Command failed.',
        },
    };
}

export async function executeAgentCommand(
    context: AgentCommandContext,
    command: string,
    input: unknown = {}
): Promise<AgentCommandResponse> {
    const definition = AGENT_COMMAND_REGISTRY[command as AgentCommandName];

    if (!definition) {
        return {
            ok: false,
            command,
            error: {
                code: 'INVALID_INPUT',
                message: `Unsupported agent command: ${command}`,
            },
        };
    }

    const missingScope = definition.scopes.find((scope) => context.permissions && !context.permissions.has(scope));

    if (missingScope) {
        return {
            ok: false,
            command,
            error: {
                code: 'PERMISSION_DENIED',
                message: `Missing ${missingScope} permission.`,
                details: { scope: missingScope },
            },
        };
    }

    try {
        const data = await definition.handler(context, input);
        return {
            ok: true,
            command,
            data,
        };
    } catch (error) {
        return normalizeError(command, error);
    }
}
