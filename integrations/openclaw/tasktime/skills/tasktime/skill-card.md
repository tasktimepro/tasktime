## Description

TaskTime Pro lets agents use a paired local browser session to work with tasks, timers, expenses, reports, invoices, project quotes, planner notes, backups, sync settings, app navigation, and account data through a local MCP bridge.

## Publisher

[TaskTime Pro](https://clawhub.ai/tasktimepro)

## License/Terms of Use

MIT-0 for the skill instructions. The TaskTime Pro bridge package is AGPL-3.0-only.

## Use Case

Agents use this skill when a user asks to inspect or operate TaskTime Pro data, set up TaskTime Pro agent access, recover a bridge session, or select the correct TaskTime Pro MCP tool.

## Deployment Geography for Use

Global.

## Requirements

- Node.js
- TaskTime Pro running in a browser
- The `@tasktimepro/agent-bridge` npm package
- User-approved pairing in TaskTime Pro under Account > Agent Access

## Known Risks and Mitigations

Risk: The MCP bridge can expose write-capable tools after the user grants access.
Mitigation: The bridge is loopback-only, scope-based, and requires explicit TaskTime Pro pairing. Agents should preview before write, billing, export, email, or destructive actions.

Risk: TaskTime Pro contains local-first customer and business data.
Mitigation: Treat the paired browser app as authoritative, do not mutate Yjs or IndexedDB directly, and do not ask users to reset browser or Drive sync data as a normal recovery step.

Risk: Invoice finalization, email sending, exports, account data deletion, and cascade deletes can have lasting effects.
Mitigation: Keep the user in control and require TaskTime Pro approval tokens or visible browser approval where the tool requires it.

## References

- [TaskTime Pro agent docs](https://tasktime.pro/agents/)
- [Quickstart](https://tasktime.pro/agents/quickstart/)
- [Security model](https://tasktime.pro/agents/security/)
- [MCP tool reference](https://tasktime.pro/agents/tools/)
- [Official MCP Registry entry](https://registry.modelcontextprotocol.io/v0.1/servers?search=pro.tasktime%2Fagent-bridge)

## Skill Output

Output types: text, Markdown, MCP tool calls, app navigation guidance.

Output format: concise operational guidance, MCP tool selection, and explicit approval or recovery instructions.

## Skill Version

1.0.1

## Ethical Considerations

Agents should preserve user control, respect TaskTime Pro's local-first security boundary, avoid exposing bridge endpoints publicly, and avoid placing sensitive customer data into unrelated external systems.
