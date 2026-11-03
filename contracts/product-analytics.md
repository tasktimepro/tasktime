# Product analytics

App and public-site DebugBundle services/projects remain independent. Both pin
the published browser SDK explicitly. Analytics is optional and failures must
never interrupt startup, navigation, successful mutations or offline work.

The app opts in only in a production build on its configured exact app origin,
with the production environment and a project token. Local previews cannot count
as production visits. Hosted project settings can restrict capture further.
Use standard privacy mode, `consentRequired: false` and zero journey sampling.
The SDK stores one random first-party browser identifier per project in its own
`debugbundle.analytics.visitor.v1.<project-hash>` localStorage key. Only a
project-scoped SHA-256-derived visitor hash is sent. This explicit SDK-owned
analytics exception does not permit product records in localStorage. Do not set
a user hash or share the existing aggregate-metrics device ID or sync session.
No cross-site link decoration, replay, account identity or work records are added.
Keep the public privacy disclosure accurate about the stored identifier.

Automatic page and route capture are disabled because app paths can contain
private record IDs. `productAnalytics` explicitly sends only `/`, known top-level
sections, `/projects/:id`, `/clients/:id`, `/auth` or `/other`. Titles, full query
strings, fragments, planner dates and actual IDs are excluded. The SDK separately
includes referring domains and standard `utm_source`, `utm_medium` and
`utm_campaign` labels, limited to 128 characters each. Use public campaign names
in those labels, never personal information, work contents or identifiers. Other
query values (including auth codes, tokens and record selections) are excluded.
Campaign labels do not establish a visitor identity or link a site/app session.
Consecutive visits to the same category are coalesced. These are section page views, not
SDK `route_change` events; they do not populate the route-transition graph.

Successful mutations already call `markMeaningfulActivity`. An explicit allowlist
forwards only project/client/task/invoice creation, timer start/pause/resume/stop
and manual time-entry creation. Unknown action names and all caller-supplied dimensions are
excluded. This path is shared by UI and browser-executed agent commands; it
does not change commands, approvals, workspace persistence or old metrics.

The `app_activation` session funnel is `app_opened` -> `timer_started` ->
`time_recorded`. Only a successful timer stop records the last step and the
`tracked_time` conversion. This measures a timer workflow during one page session,
not first-ever activation, retention, a purchase or a website-to-app attribution.
The SDK still generates a new session ID after a full reload, while reusing the
visitor hash. Use distinct visitor hashes for browser-level reach and returning
visitors; do not interpret sessions as unique people or conventional visits.
Funnel steps remain page-session scoped; standard mode does not stitch a funnel
across reloads. Existing users can enter the funnel.

Public-site analytics uses its own standard configuration and three intent
funnels. An app-open click means interest, not app use. Full page loads reset the
SDK's in-memory session, while the project-scoped visitor hash survives navigation
and reloads. Site and app use separate tokens and origins, with no identity link.
Visitor counts estimate browsers, not people or cross-device users. Clearing
browser storage or changing profile/device creates another visitor; blocking
storage or unavailable crypto falls back to session-only capture. SDK storage
remains until browser storage is cleared or consent is withdrawn; no expiry is
implied. Historical strict data cannot be retrospectively deduplicated.
Empty transitions, zero exits or
zero returning visitors are measurement limitations, not proof of no navigation,
no exits or no returning users. Blockers, owner visits, bots and test traffic can
affect counts. Keep production, service and time-window filters explicit.

Report usage, routes, referrers, actions and funnel steps using read-only CLI
analytics commands against the intended project. Keep project IDs and measured
traffic in private operational evidence. Review source, privacy disclosure,
hosted settings and saved funnel definitions before an independent app/site
release; local payload verification is not production collection evidence.

`make npm CMD="run test:e2e:analytics"` builds with a synthetic token and runs an
isolated production-origin browser journey against a local preview. Every external
request is intercepted. The check verifies successful project/task creation,
timer completion, hashed visitor continuity, a new session after reload, and
saved-work survival after reload, including when analytics requests or SDK
visitor storage are blocked. Both the Makefile/CI release gate
and the npm release command include this check.
Its disposable app build is a test artifact; prepare release artifacts separately.
