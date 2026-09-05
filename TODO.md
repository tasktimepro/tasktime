# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

[x] Keep private payment and infrastructure identifiers, credentials, and operator procedures out of the public core repository

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
    [ ] Program Phase 3 — Complete the homepage and UX/UI adjustments
        [ ] Promote the approved public product page to the `tasktime.pro` homepage
        [ ] Point every app CTA and app-launch flow to `https://app.tasktime.pro`
        [ ] Reconcile migration guidance, billing/pricing, Privacy/Terms, support, SEO/discovery, PWA install, and agent setup copy
        [ ] Complete responsive, accessibility, and cross-origin UX review without publishing
    [ ] Program Phase 4 — Launch through controlled production changes
        [ ] Pre-entry external gate, requiring explicit owner authorization before any App Console action: obtain Dropbox App Console production access and complete the non-destructive post-approval sign-in/token/direct-file canary before purchaser-facing billing launch work
        [ ] Approve whether the `EUR 39/year` founding and `EUR 59/year` standard base prices are tax-inclusive or plus applicable tax, plus their exact immutable live Stripe Product/Price mappings, payment methods, and promotions
        [ ] Approve the live Trial/Pro hosted-email allowance and paid payment-failure grace
        [ ] Approve seller/tax/legal terms and payment/refund/dispute/cancellation/Portal behavior
        [ ] Approve support ownership, retention periods, repair policy, and Privacy wording
        [ ] Verify the live catalog contains both approved offers and that exhaustion/former-founder selection returns the `EUR 59/year` summary for explicit reconfirmation without mutating founding capacity
        [ ] Obtain explicit deployment/release approval and record exact Worker, app, site, and agent artifact versions
        [ ] Verify the public/private repository boundary and secret scan, record the live pre-cutover Cloudflare/OAuth/DNS/service inventory, reuse the existing root Pages project, create exactly one permanent app Pages project, retain the exact combined root rollback artifact, and prove one deployment authority per project
        [ ] Replace and review the pre-split combined Pages workflow with explicit app-only and site-only project/artifact targets before using it; keep combined `dist` available only through the approval-gated rollback path and classify every dev/preview deployment and origin
        [ ] Deploy one compatible shared Worker and the app-subdomain foundation with both exact origins/callbacks and billing/trial/Checkout/enforcement controls still at their approved disabled state; do not duplicate Worker, D1/KV, email, Push, or provider-data services
        [ ] Migrate and verify the known production users one at a time, including every active device, complete data, provider reconnect, PWA/Push state, billing status, email/metrics checks, and agent re-pairing while the old root app remains unchanged
        [ ] After a separate root-switch approval, retire the old root PWA/service worker on known profiles without clearing IndexedDB, deploy the public-site artifact to the existing root Pages project, and publish app/agent launch URLs only after clean-profile and migrated-profile verification
        [ ] Hold the documented rollback window, then separately approve removal of the old Worker origin, OAuth callbacks, temporary preview authority/canaries, and routine combined deployment path; capture a final inventory proving exactly two intended Pages projects, one shared Worker, and no orphan migration resources
        [ ] With general Checkout still off, complete separately approved live `EUR 39/year` founding and `EUR 59/year` standard canaries; verify the founding purchase consumes exactly one permanent allocation and the standard purchase consumes none
        [ ] Enable approved billing UI, trial, Checkout, active-client enforcement, advanced-Reports enforcement, and hosted-email enforcement as separate reversible steps with live canaries

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

---

## Blog Posts

- Always keep in mind trending words and most likely searched for words for better SEO reachability
[ ] ...


---

## Project updates

[ ] Task Templates - Create “global” tasks which are assigned a category/tag and these can be assigned to all projects for that category by default (or at a click of a button → import default tasks for this project category)
    [ ] This would be a button under projects page “Create task templates”, then when creating a new project, we can choose a task template to be added


---

## Invoice updates


---

## Ideas

[ ] Timed sessions with sound alerts - I want to work on this for 1hour
    - We must think were this should be placed, as a setting, or a global option in a project for example, and we choose which task we want to work on
    [ ] This can also be an alert reminder settings in account that when a time passes a certain amount, we ping with a sound, and when we have push notifications, also have that choice
