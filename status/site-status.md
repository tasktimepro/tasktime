# Public Site Status

## Current focus

- [x] Prepare the approval-gated Phase 4 hosting transition: keep the existing
  root Pages project on combined `dist` while one permanent `dist-app` project
  is canaried, then deploy `dist-site` to the existing root only after both users
  and active devices are verified. The private execution template also requires
  legacy root service-worker retirement, exact rollback artifacts, one
  deployment authority per project, and final no-orphan resource inventory. No
  live Pages, DNS, OAuth, Worker, or user action occurred.
- [x] Refine the static `/product/` overview around “From task to paid. Without an account.”, a single primary hero action, compact trust signals, explicit solo-professional positioning, and a later focused local-first section. Responsive screenshot placeholders remain pending owner review and final captures.
- [x] Prepare an unpublished `/pricing/` review candidate with exactly Free and Pro, the approved `EUR 39/year` founding and `EUR 59/year` standard offers, an accessible comparison, local-first/downgrade reassurance, FAQ copy, public navigation, sitemap output, and static-route/PWA protection. Publication remains launch-gated.
- [ ] Continue investigating blog indexing visibility.
- [ ] Keep SEO terminology useful without weakening product clarity or accuracy.
- [x] Add staggered, search-intent-focused posts for AI-agent task/time management, invoicing, expense management, and open-source task/time/invoice workflows.
- [ ] Deploy the release-gated OpenClaw native-plugin install, migration, lifecycle, and troubleshooting documentation only with the coordinated v1 publication approval.
- [x] Align homepage, README, `llms.txt`, agent docs, skill positioning, and public privacy content around explicit free, open-source, no-account, offline-capable, browser-local core use, aggregate metrics, and direct browser-to-Google Drive sync.
- [x] Reconcile OpenClaw, quickstart, debugging, security, Claude, generated skill, and release-runbook guidance with Gateway-owned bridge lifecycle, refresh/reopen continuity, secret-free discovery, and explicit legacy migration/rollback behavior; integrated app/blog and PWA gates pass.

## Production baseline

- [x] Astro blog and legal pages
- [x] Agent quickstart, security, tooling, OpenClaw, Claude, and debugging documentation
- [x] RSS, sitemap, `llms.txt`, tool JSON, skill output, and discovery manifests
- [x] Integrated app/blog production build and local preview paths

Public-site changes must preserve the Vite route denylist and service-worker navigation behavior.
