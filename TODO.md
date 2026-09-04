# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

[ ] Double check that the current telemetry data/analysis that we have includes the latest dropbox integration as well

[ ] When I import data I should see a success toast notification

[ ] Please be careful and make sure that important infra data about payments and stripe and other details are not made publically available in the core repo

[ ] Coordinated license, app-origin migration, homepage, and production-launch program
    - Dependency rule: complete and locally verify Program Phase 1 before implementing Program Phase 2. Phase 1 may prepare origin-neutral contracts and configuration seams, but neither phase publishes or changes production by itself.
    - Source plans: `tasktime-infra/docs/todo/client_edge_license_flow.md` and `tasktime-infra/docs/todo/app_subdomain_migration_implementation_plan.md`
    [x] Program Phase 1 — Complete and test the license flow locally
        [x] Freeze the complete implementation/security contract: Free supports one active client and the current-local-month Reports Overview; Trial/Pro unlock unlimited active clients, advanced Reports/exports, and hosted email; all advanced tabs, including To Invoice, remain visible as lazy section-specific previews; founding Pro is `EUR 39/year` for the first 250 paid canonical principals; and new acquisition then uses the `EUR 59/year` standard offer
        [x] Assign an owner, required evidence, approval deadline, and fail-closed live behavior for each launch-only tax presentation/live Stripe mapping for both approved offers, allowance, grace, seller/tax/legal, support, retention, and payment/refund/Portal decision; final approval belongs to Program Phase 4, and synthetic open-policy fixtures must not leak into live mode
        [x] Implement the provider-neutral Worker, client, UI, and agent entitlement flow with production billing/trial/Checkout/enforcement controls disabled
        [x] Pass Worker tests/typecheck, the core release gate, and the synthetic/local license acceptance matrix
        [x] Reconcile specifications, contracts, status, public-copy requirements, and rollback evidence without deploying
        [x] Record the formal Program Phase 1 local Definition of Done: the real Stripe test-mode Product/Price, Checkout/webhook/test-clock/Portal lifecycle passed and is recorded in `tasktime-infra/docs/todo/subscription-phase-1-local-evidence.md`. All production controls remain off, and no live migration/deployment/domain/homepage/payment action occurred.
    [ ] Program Phase 2 — Prepare and test the `app.tasktime.pro` migration locally
        [ ] Split the app and public-site build/deployment outputs without changing live domains
        [ ] Implement a verified old-origin workspace transfer with portable-backup fallback; never copy OAuth sessions, tokens, licenses, Push subscriptions, or agent pairing credentials
        [ ] Support both Google Drive and Dropbox reconnect/bootstrap paths through the same provider-neutral lifecycle
        [ ] Prepare exact Worker/OAuth origin configuration, PWA/service-worker transition, Push, metrics, and agent-origin/default-URL compatibility
        [ ] Pass the two-origin local rehearsal and produce the production cutover/rollback checklist
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
        [ ] Deploy compatible Worker and app-subdomain foundations with billing/trial/Checkout/enforcement controls still disabled
        [ ] Migrate and verify the known production users, including complete data, provider reconnect, PWA/Push state, billing status, and agent re-pairing
        [ ] Publish the homepage and app/agent launch URLs only after migration verification and rollback proof
        [ ] With general Checkout still off, complete separately approved live `EUR 39/year` founding and `EUR 59/year` standard canaries; verify the founding purchase consumes exactly one permanent allocation and the standard purchase consumes none
        [ ] Enable approved billing UI, trial, Checkout, active-client enforcement, advanced-Reports enforcement, and hosted-email enforcement as separate reversible steps with live canaries

[ ] I think time entries widget is filtering with last 30 days? Because I would leave it that it always shows the most recent time entries no matter when they were last added

[x] Actually validate the skill/MCP with our own OpenClaw - RE-TEST
    - Test one use-case where the agent creates a task, starts the timer, go work on the actual task, stop the timer when it finished
    - We might need to make this flow part of the skill for people that want to use tasktime pro for task & time management
    [x] Fix: tasktime-infra/docs/todo/openclaw-agent-bridge-lifecycle-and-pairing-ux-plan.md
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
