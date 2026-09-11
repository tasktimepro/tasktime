# Core and Public Site Distribution

## Ownership

| Repository | Owns | Release output |
|---|---|---|
| `tasktime` | React app, Yjs data/sync contracts, agent runtime/packages, public tool definitions | `dist-app/` |
| `tasktime-site` | Astro homepage, product/pricing/blog/legal/agent docs, site styles/brand assets, SEO, domain verification | `dist/` within its own checkout |
| Private infrastructure | Worker/services, deployment credentials, target selection, promotion and rollback evidence | Explicitly selected app or site artifact |

The optional local checkouts `tasktime-site/` and `tasktime-infra/` are ignored
independent Git repositories, not submodules or workspace packages. Neither is
needed to install, test, or build core. Site has its own lockfile, Docker image,
tests, and CI; it must build without the core checkout. Do not import parent
source, share node_modules, or require a synchronized app release for site copy.
Small static icon/token/brand assets are owned copies; changing shared branding
requires an intentional review in each repository, not a shared UI framework.

Local orchestration is separate from build/release ownership. Core's optional
`docker-compose.site.yml` includes the site's own Compose definition; `make dev`
materializes a detached `tasktime` group with app (3101), site (3102), and private
local services when available. Docker Desktop Stop/Play controls those prepared
containers; `make stop` does not remove them or their volumes. `TASKTIME_SITE_PORT`
may override the site's host port and grouped app links together. Core tooling
uses the base app definition in `tasktime-tools`, without either optional repo.

## Public documentation snapshot (schema 1)

Core exports `artifacts/site-contract.json` with `make site-contract`. Site pins
one reviewed copy at `vendor/core-contract.json`. Normal site builds never fetch
core or resolve a moving branch. Core CI publishes the export as a review input;
it does not push it to site or deploy either product.

The wrapper contains `schemaVersion`, source repository/full commit,
`source.inputsSha256`, `source.dirty`, a payload SHA-256, and the public payload:
app version, exact production origins, discovery manifest, MCP tool definitions
with approval metadata, and explicitly **review-only** pricing constants. No
Worker implementation, secrets, browser stores, user records, or command
handlers are exported. Core retains `agent-bridge/discovery/tasktime-agent.json`;
site serves its pinned copy and owns the public domain-verification proof.

Consumers reject unsupported schema versions, invalid checksums, and incomplete
tool metadata. A checksum detects accidental drift; it is not a signature or
approval. Promotion must verify the snapshot against its exact committed core
source and require `source.dirty=false`. An unrelated core commit does not make
the pinned public contract stale. A tool, package version, discovery, origin, or
pricing-fixture change requires a deliberate site snapshot review before docs
claim that release. A breaking wrapper change needs a new schema and coordinated
consumer support; do not silently reinterpret schema 1.

Core `check:site-contract -- <path>` compares payload semantics to the checkout
being inspected. It is an explicit cross-repo review check, not a dependency of
ordinary core CI. Review-only prices must never be treated as a live catalog;
the Phase 4 commercial/legal/claims review remains mandatory.

## Routing and artifact isolation

App owns the service worker, manifest, SPA fallback and non-indexable HTML
metadata. Its robots file permits crawling so crawlers can observe `noindex`;
blocking all crawling is not a reliable de-indexing rule. Marketing structured
data belongs to site, not the app shell.
Public routes on the app origin redirect to the exact configured site origin
with their paths and query strings preserved. The service worker never caches
those navigations as the offline app shell. OAuth and app routes remain app-owned.

Site owns `/` and retains `/product/`, `/pricing/`, blog URLs, legal/contact,
agent docs/discovery aliases, RSS, sitemap, and indexable robots. App actions use
the exact app origin; site has no SPA fallback, service worker, or persisted
workspace. A top-level non-indexable `404.html` prevents the host's implicit SPA
fallback. Site favicon/touch/social icons are static branding, not installation
metadata. Public links inside core use the configured marketing origin.

## Independent release policy

Site-only content/layout changes use site CI and site deployment only; no core
SemVer bump or agent republish is implied. App-only changes use the core train;
publish agent artifacts only when their shipped contents/metadata change.
Cross-boundary changes carry explicit compatible source revisions and a reviewed
snapshot. Build/test each artifact once per candidate and deploy those exact
bytes to the named project. Retain source identity, checksums, and rollback bytes.
Both repository release gates require a fresh full dependency audit and stop on
high/critical findings, including build/test dependencies. Functional checks and
site-only security evidence cannot waive an app release blocker.

Phase 4 must approve the three repository promotions independently, retire the
old combined automation before use, reuse the existing root Pages project for
site, and create only the one permanent app Pages project. Deployment authority
and credentials stay private. The actual pre-cutover combined root artifact is
the rollback source; rebuilding old source or assembling new app/site artifacts
does not recreate it. No live change is authorized by this local extraction.

This follows [GitHub's build supply-chain guidance](https://docs.github.com/en/code-security/tutorials/implement-supply-chain-best-practices/securing-builds)
and [Cloudflare's external-CI direct-upload model](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
without adding a package registry, monorepo orchestrator, or shared runtime.
