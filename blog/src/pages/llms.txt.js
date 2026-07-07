import { AGENT_DOCS_LAST_UPDATED } from '../config/agents.js';
import { SITE_URL } from '../config/site.js';

export function GET() {
    const body = [
        '# TaskTime Pro',
        '',
        '> Local-first task management, time tracking, expenses, reports, and invoicing for freelancers and solo professionals.',
        '',
        `Updated: ${AGENT_DOCS_LAST_UPDATED}`,
        `Canonical site: ${SITE_URL}`,
        '',
        '## AI Agent Entry Points',
        '',
        '- Agent docs: https://tasktime.pro/agents/',
        '- MCP quickstart: https://tasktime.pro/agents/quickstart/',
        '- Security model: https://tasktime.pro/agents/security/',
        '- MCP tool reference: https://tasktime.pro/agents/tools/',
        '- MCP tools JSON: https://tasktime.pro/agents/mcp-tools.json',
        '- Skill instructions: https://tasktime.pro/agents/skill.md',
        '- Claude Code plugin: https://tasktime.pro/agents/claude/',
        '- OpenClaw integration: https://tasktime.pro/agents/openclaw/',
        '- Public bridge manifest: https://tasktime.pro/.well-known/tasktime-agent.json',
        '- Bridge manifest copy: https://tasktime.pro/agents/tasktime-agent-bridge.json',
        '- Debugging guide: https://tasktime.pro/agents/debugging/',
        '',
        '## Agent Integration Summary',
        '',
        'TaskTime Pro supports same-device AI agent workflows through the packaged `tasktime-agent-bridge` MCP stdio server.',
        'The bridge is local-first: it requires a running paired TaskTime Pro browser app session, does not write IndexedDB or Yjs directly, and does not create a remote control channel.',
        'The browser app remains the mutation owner for tasks, timers, expenses, invoices, reports, exports, sync settings, account data, and navigation.',
        'Claude Code users can install the TaskTime Pro plugin with `/plugin marketplace add tasktimepro/tasktime` and `/plugin install tasktime@tasktimepro`.',
        '',
        '## Preferred Agent Behavior',
        '',
        '- Use MCP tools before UI automation.',
        '- Launch `tasktime-agent-bridge --app-url <TaskTime Pro URL>` when a local bridge is needed.',
        '- Ask the user to approve Account > Agent Access before reading or mutating local data.',
        '- Respect scopes: `read`, `write`, `navigation`, `billing`, `export`, and `email`.',
        '- Preserve TaskTime Pro approval for destructive, billing, email, export, sync, restore, and account-data actions; use exact-input approval tokens only when a trusted local grant exists.',
        '- Use the `launch_tasktime` recovery hint when no authoritative app session is paired.',
        '- In Claude Code, plugin MCP tools use the scoped `mcp__plugin_tasktime_tasktime__<tool-name>` form.',
        '',
        '## Public Pages',
        '',
        '- Blog: https://tasktime.pro/blog/',
        '- Privacy: https://tasktime.pro/privacy/',
        '- Terms: https://tasktime.pro/terms/',
        '- Contact: https://tasktime.pro/contact/',
        '',
    ].join('\n');

    return new Response(body, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
}
