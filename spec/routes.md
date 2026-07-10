# Route Specification

## Application routes

| Path | View |
|---|---|
| `/` | Dashboard |
| `/planner` | Current/default planner week |
| `/planner/{year}/{week}` | Specific planner week using preference-aware week rules |
| `/projects` | Project list |
| `/projects/{projectId}` | Project dashboard/tasks/notes |
| `/clients` | Client list |
| `/clients/{clientId}` | Client dashboard |
| `/invoices` | Invoices, drafts, templates, and related sections |
| `/reports` | Reports and exports |
| `/expenses` | Expenses, recurrences, categories, and tax views |
| `/account` | Preferences, business/payment/template, sync, export/import, and agent settings |
| `/auth/callback` | Google auth callback handling |

Supported secondary state uses query parameters such as `section`, `tab`, `create`, `preselectedClientId`, `clientId`, and `projectId`. Query values must not replace stable primary paths.

Unknown application paths currently fall back to the dashboard. Changes to that behavior require an explicit UX/compatibility decision.

## Public/static routes

The SPA/service-worker fallback must not claim these Astro/static prefixes:

- `/blog`
- `/agents`
- `/llms.txt`
- `/privacy`
- `/terms`
- `/contact`

Generated discovery and public artifacts also include `/.well-known/tasktime-agent.json`, `/tasktime-agent.json`, sitemap, RSS, and agent JSON/Markdown outputs. Route additions must update the Vite proxy, PWA denylist, public build, tests, and documentation together.
