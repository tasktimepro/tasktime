# Public Site Status

## Current focus

- [x] Complete the local homepage capture/layout audit (2026-09-14). The supplied
  light/dark Dashboard, Planner and mobile images are integrated in the separate
  site repository. Invoice captures were refreshed from this fictional fixture
  through an isolated UI import so they show Drafts and Continue Draft instead
  of the old draft/payment actions. Both themes, desktop hero containment and
  narrow mobile layouts pass the site gate. The site's own `STATUS.md` records
  capture dimensions, final validation and the reviewed clean core-contract pin.
  This user-authorized local checkpoint prepares Phase 4; publication and live
  content/policy review remain separate. Earlier capture-pending notes below
  describe the original fixture handoff.

- [x] Prepare the fictional Paperplane Studio screenshot import (2026-09-12,
  local/uncommitted) in `test-data/screenshots/`, with dated tasks, coordinated
  client/project/category colors, planner items, expenses, time history and
  invoice previews. A disposable Chromium UI import/export preserves all 133
  entity IDs; Dashboard, Planner, Expenses and the paid invoice preview were
  checked without changing existing browser/provider data. The capture guide
  records the date anchor and replacement-import behavior. Owner captures and
  homepage asset replacement remain open; no app runtime or site assets changed.
  Follow-up (2026-09-13): corrected the fixture's saved auto-sync mode from
  backup to recommended sync, keeping auto-sync disabled. The old fixture
  overrode the app's already-correct sync default and caused the backup warning
  on first enable. Both provider regressions reproduced that warning before
  correction; all 61 sync-settings/preferences/fixture/foreground tests and
  lint pass. Intentionally saved backup preferences retain their confirmation;
  already-imported browser/cloud data was not rewritten.

- [x] Retain site source privately under `tasktimepro/tasktime-site` through the
  user-approved transfer (2026-09-11); existing history, branches and PRs are
  preserved and local `origin` is updated. Core remains public and independent.
  Site `STATUS.md` records verification; Phase 4 retains protection/CI access,
  clean provenance, main promotion and deployment approval.
- [x] Reconcile historical Free/Pro, reports, hosted-email and legal/pricing
  claims locally (2026-09-11, uncommitted). Free-first copy preserves invoices,
  PDFs/manual delivery and workspace ownership; optional Pro and Stripe billing
  are disclosed without inventing live quotas or legal policy. Root Privacy
  and README agree with site; article URLs and the old email section anchor
  remain stable. The independent site gate passes: zero audit findings,
  7 native tests, 52 HTML pages and 6 Chromium tests. Core security remediation
  also passes; remaining program work is UI plus Phase 4 review/promotion and
  commercial/legal/operational approval. Details: `tasktime-site/STATUS.md` and
  `docs/subscription-claim-inventory.md`.
- [x] Complete the local final migration sweep (2026-09-11, uncommitted): static
  404, all-page metadata/assets/sitemap checks, app-only PWA ownership and install
  guidance, preserved canonicals and matching square-image cards. Site gate:
  zero audit findings, 4 native tests, 52 HTML pages, 6 Chromium checks. Detailed
  evidence and unresolved content/SEO/publication gates live in the site's
  `STATUS.md`. The follow-up above resolves the core security and historical
  copy blockers; real screenshots/UI and Phase 4 approvals remain open.
- [x] Include the optional site's own Compose service in the core `tasktime`
  local group on port 3102 beside app 3101 (2026-09-11, uncommitted). Builds and
  releases remain independent. Site `STATUS.md` and core `app-status.md` record
  isolated generated-state validation and the data-preserving group restart.
- [x] Remediate the extracted site's inherited Astro advisories locally
  (2026-09-11, uncommitted): Astro 7.3.2, zero known audit findings, independent
  release gate and 51-page upgrade parity verified. No core dependency/runtime
  changes. `tasktime-site/STATUS.md` owns detailed evidence; Phase 4 still requires
  a fresh candidate audit, remote monitoring/CI activation and content approvals.
- [x] Extract the site into the independent ignored `tasktime-site/` repository
  (2026-09-11, uncommitted). The active site work register is now that checkout's
  `STATUS.md`; core retains this coordination pointer and historical evidence.
  Ownership and snapshot compatibility are defined in
  `contracts/site-distribution.md`. Core/site gates pass independently; initial
  source retention is complete. Main promotion, security/content approval and
  live launch remain in Program Phase 4. Entries below predate extraction;
  their references to shared icons and core-owned `blog/` describe that history.

## Historical local checkpoints before repository extraction

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
- [x] Refine the static root homepage around “Run your freelance business. From task to invoice.” while preserving its centered hero, single primary app action, trust chips, and responsive screenshot placeholders. Move “You’re solo. Your workload isn’t.” directly after the product visual and promote optional personal-AI help after billing, with unbilled-time and invoice-draft examples linked to the existing AI invoicing guide. Shorten capability copy and explain optional own-provider sync alongside privacy. Copy advertises current assistant access, not future delegation/review states or on-device AI processing. Final product captures remain pending.
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
