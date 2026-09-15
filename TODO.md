# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

...


[ ] Coordinated license, app-origin migration, homepage, and production-launch program
    - Dependency rule: complete and locally verify Program Phase 1 before implementing Program Phase 2. Phase 1 may prepare origin-neutral contracts and configuration seams, but neither phase publishes or changes production by itself.
    - Detailed implementation and operations remain in the private infrastructure repository.
    [x] Program Phase 1 — Complete and test the license flow locally
        [x] Freeze the complete implementation/security contract: Free supports one active client and the current-local-month Reports Overview; Trial/Pro unlock unlimited active clients, advanced Reports/exports, and hosted email; all advanced tabs, including To Invoice, remain visible as lazy section-specific previews; founding Pro is `EUR 39/year` for the first 250 paid canonical principals; and new acquisition then uses the `EUR 59/year` standard offer
        [x] Assign an owner, required evidence, approval deadline, and fail-closed live behavior for each launch-only tax presentation/live Stripe mapping for both approved offers, allowance, grace, seller/tax/legal, support, retention, and payment/refund/Portal decision; final approval belongs to Program Phase 4, and synthetic open-policy fixtures must not leak into live mode
        [x] Implement the provider-neutral Worker, client, UI, and agent entitlement flow with production billing/trial/Checkout/enforcement controls disabled
        [x] Pass Worker tests/typecheck, the core release gate, and the synthetic/local license acceptance matrix
        [x] Reconcile specifications, contracts, status, public-copy requirements, and rollback evidence without deploying
        [x] Record the formal Program Phase 1 local Definition of Done in the private operational evidence. All production controls remain off, and no live migration/deployment/domain/homepage/payment action occurred.
    [x] Program Phase 2 — Prepare and test the `app.tasktime.pro` migration locally
        [x] Keep the two-user data move supervised: reconnect the same provider on a pristine new origin, with the existing complete portable backup/import as fallback; do not add a long-lived migrator
        [x] Centralize and locally verify exact marketing/app/Worker/agent origin roles across the browser, Google/Dropbox OAuth Worker paths, metrics eligibility, and agent bridge; production configuration remains unchanged
        [x] Split deterministic app-only and public-site-only build/deployment outputs while retaining the existing combined compatibility output and changing no live domain
        [x] Finish exact Worker/OAuth/email/Push/metrics/billing configuration tests, PWA transition guidance, and agent default-URL compatibility
        [x] Pass the local app/site and Worker gates and finalize the supervised production cutover/rollback checklist
    [x] Program Phase 3 — Complete the homepage and UX/UI adjustments locally (final audit evidence in status/app-status.md and tasktime-site/STATUS.md; launch approval remains Phase 4)
        [x] Extract the public site into the independent ignored `tasktime-site/` repository; verify standalone app/site builds, pinned public contracts, cross-origin links, and PWA isolation (locally validated, uncommitted; see contracts/site-distribution.md and status/app-status.md)
        [x] Dashboard readability — separate Today/Upcoming, add four glanceable stats, preset period reports, and billable/non-billable stacked hours; verify actions, historical/currency totals, mobile ordering, accessibility, offline charts, and bundle impact locally (Phase 3 local checkpoint; evidence in status/app-status.md)
        [x] Expenses overview — neutral summary cards, spending/category charts, and recorded activity; preserve the original list/tabs and verify payment/history/currency behavior, phones, and offline use locally (uncommitted; evidence in status/app-status.md)
        [x] Prepare the standalone site's root homepage as its only homepage route (local build/browser checks pass; actual root deployment remains Phase 4)
        [x] Point site app CTAs to `https://app.tasktime.pro` and core public links to the site; retain the existing exact-origin app/agent launch configuration (local tests pass; live launch remains Phase 4)
        [x] Reconcile local migration/install/agent guidance, SEO/discovery, billing/pricing and Privacy/Terms copy; preserve Free-first wording and remove historical no-paid-tier and fixed hosted-quota claims (2026-09-11; docs/subscription-claim-inventory.md). Final seller/legal/support/live-catalog approval remains Phase 4
        [x] Complete responsive, accessibility, and cross-origin UX review without publishing (core/site gates, both themes, 320px invoice actions, Firefox/WebKit journeys and screenshot review)
    [ ] Program Phase 4 — Launch through controlled production changes
        [x] Retain the extracted site source in its own user-approved local initial checkpoint before core commits the old blog removal; this does not replace approved remote retention or main/publication provenance
        [x] Retain site source privately at tasktimepro/tasktime-site before core main removes blog; user-approved transfer preserves the existing repository/history and updates local origin (2026-09-11). Both nested checkouts remain ignored by core
        [x] Update DebugBundle SDK packages to latest - also check if we need to include another one in site now since we'll have two different locations and if we should include it anywhere else in cloudflare if we can if that is possible
        [ ] Complete site provenance/license/maintainer review, main-branch protection, required CI and dependency/security monitoring verification; approve any plan/access changes needed for private-repository protections before main promotion
        [ ] Review and approve exact core/site/private-infra `update/launch` revisions and separate main promotions; a merge must not deploy automatically. Record each resulting main SHA, release scope, rollback owner, and checked artifact digest
        [ ] Export the site contract from the approved committed core revision, require clean source metadata, verify the pinned site snapshot against that revision, and review public tool/discovery/pricing semantics; unrelated future app commits must not force site releases
        [x] Remediate inherited site dependency advisories locally: Astro 7.3.2 and patched locked dependencies audit clean, the standalone site gate and before/after page comparisons pass, and high/critical audit enforcement plus weekly dependency-update configuration are prepared (evidence: tasktime-site/STATUS.md)
        [ ] Before site main promotion and again before publication, rerun the full site gate on the exact approved revision, retain fresh dependency-audit evidence, and activate required CI plus dependency/security monitoring in the approved remote; local remediation is not publication approval
        [x] Remediate core app dependency advisories locally: 2026-09-11 full audit goes from 57 findings to zero with coordinated same-major editor/PDF/build-test updates; clean install, historical notes, PDF, full core/coverage/browser/PWA and agent checks pass. Both core audit-first release gates remain enforced; no forced fix, peer bypass or advisory suppression (status/app-status.md)
        [ ] Rerun the full core gate and retain fresh full audit evidence on the exact approved core revision before main promotion and again before publication; verify the installed/built dependencies match the lockfile. Local zero-findings evidence is not a permanent waiver
        [x] Complete local site/PWA technical sweep: static 404, all-page metadata/assets/sitemap checks, Claude sitemap entry, truthful lastmod dates, square-logo social cards, explicit app-origin install/migration guidance, app manifest/icons/offline checks and crawlable app noindex (2026-09-11; evidence: tasktime-site/STATUS.md)
        [ ] Complete the site launch-content review against the live catalog and approved Privacy/Terms, historical blog claims, contact/support details, real screenshots, canonical URLs, sitemap/RSS, registry proof, and app links; review-only pricing is not a live offer source
        [x] Reconcile legacy no-paid-tier/no-feature-gates claims locally across articles, search/social metadata, agent discovery, pricing, Terms and both Privacy policies; retain Free core and identify optional Pro, Stripe and in-app hosted allowances without publishing test numbers (docs/subscription-claim-inventory.md). Final live-policy approval/publication remains separately gated above
        [ ] On the approved hosting candidate, verify true 404 responses (including missing /sw.js and /manifest.json), app install/worker MIME and scope, app noindex visibility, public canonical/social/JSON-LD assets, preview/custom-domain noindex, root/www/pages.dev canonical policy, sitemap/RSS and Search Console inspection/submission. Recheck after the separately approved root switch; local Astro preview is not edge or search-indexing evidence
        [x] Fix/review desktop homepage hero overflow: give the centered heading its available container width, retaining its two desktop lines and existing font size; both themes now remain within 1440px, with mobile and desktop browser/visual coverage
        [ ] Configure protected app/site deployment environments with distinct project targets, environment-scoped credentials, reviewed contract checksum, launch-readiness and split-deployment switches; authorize least-privilege read-only private-site checkout from infrastructure CI before artifact-only rehearsals, and prove app-only/site-only changes cannot deploy the other component
        [ ] Pre-entry external gate, requiring explicit owner authorization before any App Console action: obtain Dropbox App Console production access and complete the non-destructive post-approval sign-in/token/direct-file canary before purchaser-facing billing launch work
        [ ] Approve whether the `EUR 39/year` founding and `EUR 59/year` standard base prices are tax-inclusive or plus applicable tax, plus their exact immutable live Stripe Product/Price mappings, payment methods, and promotions
        [x] Approve the live Trial/Pro hosted-email allowance and paid payment-failure grace (owner selected 100 emails per UTC month and seven days on 2026-09-15; production activation remains separate)
        [ ] Approve seller/tax/legal terms and payment/refund/dispute/cancellation/Portal behavior
        [ ] Approve support ownership, retention periods, repair policy, and Privacy wording
        [ ] Verify the live catalog contains both approved offers and that exhaustion/former-founder selection returns the `EUR 59/year` summary for explicit reconfirmation without mutating founding capacity
        [ ] Obtain explicit deployment/release approval and record exact Worker, app, site, and agent artifact versions
        [ ] Verify the public/private repository boundary and secret scan, record the live pre-cutover Cloudflare/OAuth/DNS/service inventory, reuse the existing root Pages project, create exactly one permanent app Pages project, retain the exact combined root rollback artifact, and prove one deployment authority per project
        [ ] Replace and review the pre-split combined Pages workflow with explicit app-only and site-only project/artifact targets before using it; keep combined `dist` available only through the approval-gated rollback path and classify every dev/preview deployment and origin
        [x] Deploy one compatible shared Worker and the app-subdomain foundation with both exact origins/callbacks and billing/trial/Checkout/enforcement controls still at their approved disabled state; do not duplicate Worker, D1/KV, email, Push, or provider-data services (app-first launch verified 2026-09-15; root and paid activation remain separate)
        [ ] Migrate and verify the known production users one at a time, including every active device, complete data, provider reconnect, PWA/Push state, billing status, email/metrics checks, and agent re-pairing while the old root app remains unchanged
        [ ] After a separate root-switch approval, retire the old root PWA/service worker on known profiles without clearing IndexedDB, deploy the public-site artifact to the existing root Pages project, and publish app/agent launch URLs only after clean-profile and migrated-profile verification
        [ ] Hold the documented rollback window, then separately approve removal of the old Worker origin, OAuth callbacks, temporary preview authority/canaries, and routine combined deployment path; capture a final inventory proving exactly two intended Pages projects, one shared Worker, and no orphan migration resources
        [ ] With general Checkout still off, complete separately approved live `EUR 39/year` founding and `EUR 59/year` standard canaries; verify the founding purchase consumes exactly one permanent allocation and the standard purchase consumes none
        [ ] Enable approved billing UI, trial, Checkout, active-client enforcement, advanced-Reports enforcement, and hosted-email enforcement as separate reversible steps with live canaries
        [ ] Make sure to publish any packages such as MCP etc if they were modified in this launch update
        [x] Stripe VAT must be inclusive in the price so that we do not scare or shock customers
        [x] Don't forget to add a generic og-image for site

[x] Actually validate the skill/MCP with our own OpenClaw - RE-TEST
    - Test one use-case where the agent creates a task, starts the timer, go work on the actual task, stop the timer when it finished
    - We might need to make this flow part of the skill for people that want to use tasktime pro for task & time management
    [x] Fix and verify the private OpenClaw lifecycle plan
    [x] Then publish version 1 once we see that it's stable
    [ ] Perform one more manual test

[ ] Publish in more places:
    [ ] PulseMCP - VERIFY AUTO LISTING
    [ ] Smithery
        [ ] Skill
        [ ] MCP
    [ ] Glama
    [ ] MCP.so

[ ] Think about publishing an official supported chatGPT plugin

---

## Blog Posts

- Always keep in mind trending words and most likely searched for words for better SEO reachability
[ ] ...


---

## Project updates



---

## Invoice updates



---

## Ideas

[ ] Global search

[ ] Include theme color options in settings, default could be neutral

[ ] Timed sessions with sound alerts - I want to work on this for 1hour
    - We must think were this should be placed, as a setting, or a global option in a project for example, and we choose which task we want to work on
    [ ] This can also be an alert reminder settings in account that when a time passes a certain amount, we ping with a sound, and when we have push notifications, also have that choice

[ ] Task Templates - Create “global” tasks which are assigned a category/tag and these can be assigned to all projects for that category by default (or at a click of a button → import default tasks for this project category)
    [ ] This would be a button under projects page “Create task templates”, then when creating a new project, we can choose a task template to be added
