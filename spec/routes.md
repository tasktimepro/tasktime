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

- `/product`
- `/pricing`
- `/blog`
- `/agents`
- `/llms.txt`
- `/privacy`
- `/terms`
- `/contact`

Generated discovery and public artifacts also include `/.well-known/tasktime-agent.json`, `/tasktime-agent.json`, both MCP registry-proof URLs, sitemap, RSS, and agent JSON/Markdown outputs. Route additions must update the shared public-route list, generated app redirects, PWA exclusion, standalone site build, tests, and documentation together.

Application paths belong to `app.tasktime.pro` after the approved cutover; `/`
on `tasktime.pro` is the standalone public homepage. `/product/` remains a
supported public URL. The app redirects known public routes to the configured
exact marketing origin with path/query preserved; it never proxies Astro or
caches public navigation as its offline shell. Site actions use the exact app
origin and keep application query parameters. No live routing changes occur
until the separately approved Phase 4 promotion.
