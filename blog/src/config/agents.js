export const AGENT_DOCS_LAST_UPDATED = '2026-07-07';

export const AGENT_DOCS_DESCRIPTION = 'Use TaskTime Pro with same-device AI agents through the local MCP agent bridge for private task management, time tracking, expenses, invoicing, reports, and app navigation.';

export const AGENT_DOCS_KEYWORDS = [
    'TaskTime Pro AI agent',
    'TaskTime Pro MCP',
    'TaskTime Pro local agent bridge',
    'MCP time tracking',
    'local-first invoicing agent',
    'AI agent task manager',
    'OpenClaw TaskTime Pro',
    'Claude Code TaskTime Pro',
    'TaskTime Pro Claude plugin',
    'TaskTime Pro agent tools',
];

export const AGENT_DOCS_NAV_ITEMS = [
    {
        href: '/agents/',
        key: 'overview',
        label: 'Overview',
        summary: 'How TaskTime Pro exposes a local-first agent interface.',
    },
    {
        href: '/agents/quickstart/',
        key: 'quickstart',
        label: 'Quickstart',
        summary: 'Launch the bridge, pair TaskTime Pro, and make the first MCP call.',
    },
    {
        href: '/agents/security/',
        key: 'security',
        label: 'Security',
        summary: 'Pairing, scopes, approvals, local-only access, and revocation.',
    },
    {
        href: '/agents/tools/',
        key: 'tools',
        label: 'MCP Tools',
        summary: 'Generated catalog of agent bridge tools and schemas.',
    },
    {
        href: '/agents/openclaw/',
        key: 'openclaw',
        label: 'OpenClaw',
        summary: 'Discovery and publishing notes for OpenClaw-style agents.',
    },
    {
        href: '/agents/claude/',
        key: 'claude',
        label: 'Claude Code',
        summary: 'Claude Code plugin and marketplace install instructions.',
    },
    {
        href: '/agents/debugging/',
        key: 'debugging',
        label: 'Debugging',
        summary: 'Recovery hints, smoke tests, and DebugBundle guidance.',
    },
];

export const AGENT_DISCOVERY_LINKS = [
    {
        href: '/llms.txt',
        label: 'llms.txt',
        summary: 'Short index for agents discovering TaskTime Pro documentation.',
    },
    {
        href: '/.well-known/tasktime-agent.json',
        label: 'Site manifest',
        summary: 'Public TaskTime Pro local agent bridge discovery metadata.',
    },
    {
        href: '/agents/tasktime-agent-bridge.json',
        label: 'Bridge manifest copy',
        summary: 'Stable docs-adjacent copy of the bridge discovery metadata.',
    },
    {
        href: '/agents/mcp-tools.json',
        label: 'MCP tools JSON',
        summary: 'Generated machine-readable catalog of supported MCP tools.',
    },
    {
        href: '/agents/skill.md',
        label: 'Skill instructions',
        summary: 'Fetchable Skill-style instructions for agent platforms.',
    },
    {
        href: 'https://github.com/tasktimepro/tasktime/tree/main/integrations/claude/tasktime',
        label: 'Claude Code plugin',
        summary: 'GitHub-hosted TaskTime Pro Claude Code plugin bundle.',
    },
];
