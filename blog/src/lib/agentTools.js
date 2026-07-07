import { readFileSync } from 'node:fs';
import { MCP_TOOL_DEFINITIONS } from '../../../src/agent/bridge/mcpTools.ts';

const APPROVAL_COMMAND_NAMES = readApprovalCommandNames();

const TOOL_GROUPS = [
    {
        id: 'projects-tasks',
        title: 'Projects and Tasks',
        description: 'Create, update, archive, delete, and inspect projects, clients, tasks, and task relationships.',
    },
    {
        id: 'timers-time',
        title: 'Timers and Time Entries',
        description: 'Start, pause, resume, stop, clear, and edit timer and time-entry records.',
    },
    {
        id: 'planner-notes',
        title: 'Planner and Notes',
        description: 'Manage planner attachments, daily goals, and project notes.',
    },
    {
        id: 'expenses-tax',
        title: 'Expenses and Tax',
        description: 'Manage expenses, recurring expenses, tax return periods, and tax-claim status.',
    },
    {
        id: 'invoices-quotes',
        title: 'Invoices and Quotes',
        description: 'Preview, draft, finalize, email, export, and update invoices and project quotes.',
    },
    {
        id: 'settings',
        title: 'Settings and Templates',
        description: 'Manage preferences, business profiles, payment methods, brand assets, and templates.',
    },
    {
        id: 'reports-exports-backups',
        title: 'Reports, Exports, and Backups',
        description: 'Read reports, export files through the browser app, and manage local or Drive backups.',
    },
    {
        id: 'sync-account',
        title: 'Sync and Account',
        description: 'Inspect sync status, update explicit sync settings, and handle account-level data operations.',
    },
    {
        id: 'navigation',
        title: 'Navigation',
        description: 'Open TaskTime Pro screens in the paired browser session for human review.',
    },
    {
        id: 'queries',
        title: 'Queries and Summaries',
        description: 'Read dashboard, project, client, unbilled-work, and recent-entry summaries.',
    },
];

const GROUP_BY_ID = new Map(TOOL_GROUPS.map((group) => [group.id, group]));

/**
 * Returns a docs-friendly MCP tool catalog derived from bridge source definitions.
 */
export function getAgentToolCatalog() {
    const tools = getAgentTools();

    return {
        schemaVersion: 1,
        generatedFrom: [
            'src/agent/bridge/mcpTools.ts',
            'src/agent/commands/registry.ts',
        ],
        app: {
            id: 'pro.tasktime',
            name: 'TaskTime Pro',
            localFirst: true,
        },
        bridge: {
            binary: 'tasktime-agent-bridge',
            transport: 'mcp-stdio-json-rpc',
            appSessionRequired: true,
            defaultScopes: ['read', 'write', 'navigation'],
            optionalScopes: ['billing', 'export', 'email'],
        },
        toolCount: tools.length,
        scopes: getScopeTotals(tools),
        groups: getAgentToolGroups().map((group) => ({
            id: group.id,
            title: group.title,
            description: group.description,
            toolCount: group.tools.length,
        })),
        tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            scopes: tool.scopes,
            group: tool.group,
            requiresApproval: tool.requiresApproval,
            approvalMode: tool.approvalMode,
            inputSchema: tool.inputSchema,
        })),
    };
}

/**
 * Returns all MCP tools with docs grouping and approval metadata.
 */
export function getAgentTools() {
    return MCP_TOOL_DEFINITIONS.map((tool) => ({
        ...tool,
        group: getToolGroupId(tool.name),
        requiresApproval: APPROVAL_COMMAND_NAMES.has(tool.name),
        approvalMode: APPROVAL_COMMAND_NAMES.has(tool.name)
            ? 'tasktime_approval_token_or_visible_prompt'
            : 'none',
        inputFieldNames: Object.keys(tool.inputSchema.properties ?? {}),
    }));
}

/**
 * Returns groups with sorted tool lists.
 */
export function getAgentToolGroups() {
    const tools = getAgentTools();

    return TOOL_GROUPS.map((group) => ({
        ...group,
        tools: tools
            .filter((tool) => tool.group === group.id)
            .sort((left, right) => left.name.localeCompare(right.name)),
    })).filter((group) => group.tools.length > 0);
}

export function getToolGroupTitle(groupId) {
    return GROUP_BY_ID.get(groupId)?.title ?? 'Other';
}

export function formatInputFields(tool) {
    if (tool.inputFieldNames.length === 0) {
        return 'No input fields';
    }

    return tool.inputFieldNames.join(', ');
}

function getScopeTotals(tools) {
    const totals = new Map();

    for (const tool of tools) {
        for (const scope of tool.scopes) {
            totals.set(scope, (totals.get(scope) ?? 0) + 1);
        }
    }

    return Array.from(totals.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([scope, toolCount]) => ({
            scope,
            toolCount,
        }));
}

function getToolGroupId(name) {
    if (name.startsWith('open_') || name === 'focus_running_timer') {
        return 'navigation';
    }

    if (name.includes('invoice') || name.includes('quote')) {
        return 'invoices-quotes';
    }

    if (name.includes('expense') || name.includes('tax_return') || name.includes('tax_claim')) {
        return 'expenses-tax';
    }

    if (name.includes('timer') || name.includes('time_entry')) {
        return 'timers-time';
    }

    if (name.includes('planner') || name.includes('daily_goal') || name.includes('project_notes')) {
        return 'planner-notes';
    }

    if (name.includes('report') || name.includes('backup') || name.includes('accountant_pack')) {
        return 'reports-exports-backups';
    }

    if (name.includes('sync') || name.includes('account_data')) {
        return 'sync-account';
    }

    if (
        name.includes('business')
        || name.includes('payment_method')
        || name.includes('template')
        || name.includes('preferences')
        || name.includes('category')
    ) {
        return 'settings';
    }

    if (name.includes('project') || name.includes('task') || name.includes('client')) {
        return 'projects-tasks';
    }

    return 'queries';
}

function readApprovalCommandNames() {
    const source = readFileSync(
        new URL('../../../src/agent/commands/registry.ts', import.meta.url),
        'utf8'
    );
    const approvalNames = new Set();
    const commandBlockPattern = /\n\s{4}([a-z][a-z0-9_]*):\s*\{[\s\S]*?\n\s{4}\},/g;

    for (const match of source.matchAll(commandBlockPattern)) {
        const [, name] = match;
        const block = match[0];

        if (block.includes('requiresApproval: true')) {
            approvalNames.add(name);
        }
    }

    return approvalNames;
}
