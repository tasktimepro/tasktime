# Public Site Status

## Current focus

- [x] Standardize homepage, pricing, shared site-description, and onboarding
  backup copy on the full TaskTime Pro product name. App-opening homepage/pricing
  CTAs read “Open TaskTime Pro”; pricing keeps Free and Pro as plan labels and
  distinguishes “the Pro plan” from the product name. Update the existing CTA
  assertion. Production build and generated-copy checks pass; browser review
  remains with the user.
- [x] Replace handwritten homepage UI icons with shared Lucide exports rendered
  through `ProductIcon.astro`: hero chips, repeated shield, screenshot placeholders,
  checklist checks, link arrows, and header theme controls. Local-first and app
  onboarding share `ShieldCheckIcon`; offline uses the app's `WifiOffIcon`.
  Brand artwork is unchanged. Build, lint, and typecheck pass. Generated HTML
  contains 25 decorative Lucide icons with standard strokes, matching hero/card
  shields, and no external scripts or hydrated islands. Browser review remains
  with the user; no browser tests were run for this refinement.
- [x] Replace the ownership section's flat grey fill with soft neutral corner
  gradients and a defined border, using existing semantic tokens. Keep the neutral
  cards and theme-aware text. The production build passes; browser review is
  left to the user as requested.
- [x] Refine homepage capability and ownership cards with the app's exact Lucide
  icon exports and the shared Local-first shield for “Start in your browser”,
  with consistent icon tiles, padding, and type sizes. Replace the
  aggregate-metrics card with “Take your work with you” export/restore copy;
  privacy policy and telemetry behavior are unchanged. Projects uses the shared
  closed-folder icon across app and site. Icons render as decorative static SVG
  without adding a browser React runtime. Ownership cards use readable rows at
  tablet widths, with three columns on desktop and stacked cards on mobile.
  Red/green card-icon accessibility checks pass with all four PWA tests, the
  50-page production build, lint, typecheck, and 63 focused app component tests.
  Browser review covered dark desktop cards, light mobile cards, the revised
  tablet rows, and the app's Projects navigation/empty-state icons. Built homepage
  HTML contains no external scripts or hydrated React islands. These changes
  are included in the local Phase 3 checkpoint with the dashboard and project
  icons; no publication or deployment is included. Final checkpoint validation
  is recorded in `app-status.md`.
- [x] Prepare the approval-gated Phase 4 hosting transition: keep the existing
  root Pages project on combined `dist` while one permanent `dist-app` project
  is canaried, then deploy `dist-site` to the existing root only after both users
  and active devices are verified. The private execution template also requires
  legacy root service-worker retirement, exact rollback artifacts, one
  deployment authority per project, and final no-orphan resource inventory. No
  live Pages, DNS, OAuth, Worker, or user action occurred.
- [x] Refine the static `/product/` homepage around “Run your freelance work. From task to invoice.” while preserving its centered hero, single primary app action, trust chips, and responsive screenshot placeholders. Move “You’re solo. Your workload isn’t.” directly after the product visual and promote optional personal-AI help after billing, with unbilled-time and invoice-draft examples linked to the existing AI invoicing guide. Shorten capability copy and explain optional own-provider sync alongside privacy. Copy advertises current assistant access, not future delegation/review states or on-device AI processing. Final product captures remain pending.
- [x] Validate the positioning update locally: red regressions reproduced the old headline/section order; `make test-e2e-pwa-smoke` rebuilt the 50-page site and passed all four tests, including 320px overflow, 1440px hero composition, keyboard navigation to the guide, offline app boot, and public-route separation. `make lint`, `make typecheck`, and `git diff --check` pass. Browser visual review covered desktop, tablet, and narrow mobile. Included in the local Phase 3 checkpoint; publication remains pending.
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
