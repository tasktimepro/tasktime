# Ambiguities And Open Decisions

Unknowns are recorded here rather than silently resolved by an agent.

## Architecture and operations

### Historical compatibility support window

The repository validates tolerant historical shapes, but there is no single documented minimum supported backup/app version. Do not remove compatibility code until a support policy and migration evidence exist.

### Dedicated agent evals

Agent commands are deterministic and currently use tests/smoke flows. If future integrations add model-authored planning or interpretation inside this repository, define eval fixtures and thresholds before shipping that behavior.

## Subscription billing and entitlements

The recurring-subscription architecture has been reconciled against the current provider-neutral, local-agent, account-deletion, Reports/tax, and public-copy baseline. The detailed private plan owns the dependency order, contracts, tests, deployment, and rollback. Its implementation/security contracts are frozen so local Slices 0-8 may proceed with the exact test-mode `EUR 39/year` founding offer, `EUR 59/year` standard offer, automatic capacity transition, and synthetic values only for still-open policy. Live Checkout, trial activation, paid UI/copy, and Pro enforcement remain blocked until the launch-only decisions and gates below are approved.

### Approved August 19, 2026

- **BILL-DEC-2 — Email technical boundary:** Free has no TaskTime-hosted sends. Trial and paid Pro share one configured UTC calendar-month allowance. Each provider-accepted primary or forwarded message consumes one unit; definite pre-acceptance failure releases it and ambiguity stays reserved. Activation/purchase/provider transfer does not reset the window. Pre-enforcement legacy sends preserve duplicate safety but do not reduce the purchaser's first Trial/Pro allowance. The exact live allowance remains launch-open.
- **BILL-DEC-3 — Supported cloud providers:** Manual, Backup, and Sync modes and
  all Google Drive and Dropbox backup/recovery/privacy controls remain free.
- **BILL-DEC-4 — Existing/new users:** There is no permanent grandfathered Pro access. Every eligible existing or new canonical hosted principal may explicitly start the same one-time 30-day Pro trial; launch does not automatically start it. Reconnecting the same provider identity or completing verified provider transfer preserves trial history.
- **BILL-DEC-5 — Provider-neutral OAuth identity:** TaskTime does not add a separate identity-only Google login. The one selected cloud provider (Google Drive or Dropbox) authenticates storage and TaskTime-hosted services. The Worker maps its domain-separated provider subject to one opaque hosted principal used by email, metrics, and future trial/subscription state. Explicit provider transfer links the two authenticated subjects before activation so allowances and entitlements follow the user without requiring Google.
- **BILL-DEC-6 — Offline technical contract:** Signed assertions last at most seven days with five-minute skew and are additionally capped by trial, subscription-period/grace, grant, and key boundaries. A detected backward clock jump beyond skew disables cached Pro until online refresh. Already-issued offline assertions cannot be remotely revoked before expiry. The exact paid payment-failure grace remains launch-open and bounded to zero through seven days. V1 has no global entitlement-granting rollout source; rollout/canary controls govern exposure/readiness only.
- **BILL-DEC-7 — Trial portion:** The initial trial is a TaskTime-owned, account-bound 30 x 24-hour entitlement with no card, Stripe subscription, automatic charge, renewal, reset, or payment-failure grace. It begins only after an explicit account-specific confirmation.
- **BILL-DEC-10 — Web Push:** Web Push remains free for the initial Pro release.

### Approved August 30, 2026

- **BILL-DEC-1 — Free versus Pro boundary:** Free supports one active client and
  exactly the current-local-month **Received**, **Expenses**, and **Tracked time**
  Reports Overview. Trial/Pro unlock unlimited active clients, advanced Reports/
  exports, and TaskTime-hosted invoice/quote/reminder/forwarded-copy sending.
  Entitlement attaches to those semantic actions, not shared utilities. Dashboard,
  client/project/unbilled calculations, all seven tax-period/expense-claim
  commands, email preparation/manual PDF delivery, invoices/quotes/PDFs,
  portable import/export, provider sync/backups, Web Push, and core agents remain
  Free.
- **BILL-DEC-11/12 — Active-client policy:** Active means
  `client.archived !== true`. Free's limit is one; Trial/Pro use unlimited
  (`null`). One shared UI/agent policy gates only creating or restoring another
  active client at the limit. Existing, downgraded, imported, restored, synced,
  or concurrently merged over-limit clients and dependent records remain fully
  usable. Import/restore/sync never drops or auto-archives data, and successful
  upgrade/trial return never auto-replays the attempted mutation.
- **Reports discovery:** `/reports` and all tabs, including To Invoice, remain
  visible and navigable. Overview is genuinely Free and uses the exact metric
  contract in `spec/requirements.md`. A Free user selecting an advanced tab sees
  tailored static Pro copy before protected history, modules, calculations,
  exchange rates, rows, or export code load. Explicit
  `get_report_summary({scope:"basic-current-month"})` is Free; omitted/default
  advanced summary and all report exports require `reports.access`.
- **BILL-DEC-7/13 — Plans and Pro offers:** Launch has exactly Free and Pro.
  Trial is an entitlement source and Founding/Standard are Pro offers, not other plans.
  Founding Pro is annual `EUR 39` for the first 250 paid canonical hosted
  principals. Atomic bounded Checkout reservations prevent oversell; a paid
  allocation never recycles. The same continuous/recoverable Stripe subscription
  retains the founding base price, while terminal cancellation followed by a new
  purchase uses the annual `EUR 59` standard offer. Trials, grants, failed/
  expired unpaid Checkout, and test-mode objects do not count. Temporary
  reservation saturation remains retryable and does not switch pricing early.
  At 250 committed allocations, new purchases use standard; stale founding
  intents require explicit `EUR 59` reconfirmation and create no Stripe state.
  Standard Checkout never touches founding slots. No exact remaining count is public.
- **Public wording:** TaskTime Pro remains truthfully free, open source, local-
  first, and usable without an account for core use. Launch copy presents only
  Free and Pro, explains “one active client at a time” without implying lost
  history, and introduces Pro through scale, convenience, and administration.

### Still open before live launch

- **BILL-DEC-2 — Pro email allowance:** Approve the exact monthly Trial/Pro send allowance.
- **BILL-DEC-6 — Paid payment grace:** Approve the live value between zero and seven days. The assertion/clock/revocation implementation contract is already closed above.
- **BILL-DEC-7 — Remaining paid lifecycle:** Decide whether the approved
  `EUR 39/year` founding and `EUR 59/year` standard base prices are tax-inclusive
  or plus applicable tax; approve both exact immutable live Stripe Price/
  configuration mappings, payment methods,
  promotions, refund/dispute/immediate-cancellation remedies and terms, and
  remaining Portal behavior. Cancel-at-period-end is the default and reversal
  before period end preserves continuity. Both amounts, annual intervals,
  founding capacity/standard transition, and same-subscription continuity
  contract are closed.
- **BILL-DEC-8 — Seller and tax model:** Confirm seller identity, merchant-of-record choice, tax registrations/product code, price tax behavior, tax-ID collection, receipts, filing/remittance, and refund terms with appropriate professional review.
- **BILL-DEC-9 — Support, retention, and repair live policy:** The technical
  contract is closed: append-only audit, explicit actor/reason/expiry and trial-
  consumption policy, versioned keyed trial marker with no email/product data,
  canonical ownership proof, and state-machine repair/deletion. Approve the live
  marker retention duration, founder/beta/goodwill policy, trial-extension
  exceptions, support SLA/approvers, and Privacy wording before launch.

Before enforcement, every approved answer must be reflected in product requirements, acceptance criteria, public interface contracts, Privacy/Terms, active public claims, tests, and the release plan without claiming unimplemented behavior is already live.

## Cloud storage provider expansion

The Dropbox direction below was approved on August 19, 2026 and now governs the
deployed Google Drive/Dropbox connection lifecycle. Connections and explicit
user-initiated transfers are deployed/enabled for approved/current accounts with
independent fail-closed rollback controls; no transfer starts automatically.
Broad availability to new public Dropbox users remains gated on App Console
production access and a non-destructive post-approval canary.

### Approved August 19, 2026

- **DROPBOX-DEC-1 — Provider model:** A browser profile has exactly one active cloud-sync provider. Google and Dropbox are not mirrored simultaneously. A second provider connection may exist only as staged state inside an explicit transfer.
- **DROPBOX-DEC-2 — Transfer:** Google-to-Dropbox and Dropbox-to-Google transfer must fully reconcile/materialize the source, stage every live document, commit the target manifest last, read back and verify the target, recheck the source, and only then activate the target. Failure keeps the source active and preserves local dirty evidence. Source files and historical backups remain unless the user separately removes them; the target receives the live workspace plus one handoff backup rather than an automatic copy of all historical backups.
- **DROPBOX-DEC-3 — Cross-device boundary:** One active provider is strictly enforceable in the current browser profile and its same-origin tabs. Without a central TaskTime account, an offline device or legacy PWA cannot be switched atomically. Other devices do not need to disconnect before transfer, but TaskTime should remain closed on them until it finishes; they must connect to the new provider before editing again. Upgraded clients honor a non-sensitive migration marker, and provider revocation remains the dependable way to stop a legacy client from using the former grant. Public/UI wording may not claim a global atomic switch.
- **DROPBOX-DEC-4 — Dropbox access (updated September 3, 2026):** Use Dropbox App Folder with `files.metadata.read`, `files.metadata.write`, `files.content.read`, and `files.content.write`, plus `account_info.read` so the browser can display the connected account email consistently with Google Drive. The browser reads that profile directly and stores the verified email in its origin-local auth record; ordinary sync, identity, entitlement, metrics, and hosted-service requests keep only the TaskTime-scoped pseudonym. On an explicit paid Checkout action, the browser may additionally submit the locally verified email as the Stripe billing contact. It never becomes trial or entitlement identity. Do not request Full Dropbox, sharing/team/contact, permanent-delete, or broader account access.
- **DROPBOX-DEC-5 — Privacy and tokens:** Routine sync/backup/restore/wipe/transfer bodies go directly browser-to-provider and never through the Worker. The Worker keeps encrypted refresh credentials and issues short-lived tokens; browser tokens remain tab-memory-only. Describe this as a server-blind routine data path, not end-to-end encryption or strict zero knowledge.
- **DROPBOX-DEC-6 — Cloudflare capacity:** Preserve zero-request cooldown paths, one direct metadata request for a stale unchanged check with a warm token, and Worker request counts independent of file bytes/document count. Replace KV-backed abuse counters before Dropbox rollout and require doubled-peak capacity headroom; use paid KV or a compatible D1 session migration before launch if necessary.
- **DROPBOX-DEC-7 — Feature and identity parity:** The selected Google Drive or Dropbox session authorizes the same TaskTime storage, hosted-email, privacy-safe metrics, agent, and future Pro feature set. Dropbox never requires a parallel Google session. The Worker derives provider-separated hashes and maps them to one opaque hosted principal; an explicit authenticated transfer links ownership before activation, preserves existing Google hashes/quota history, and makes the target session authoritative.
- **DROPBOX-DEC-8 — Destructive actions and compatibility:** Local disconnect, OAuth revocation, provider-data removal, and transfer remain distinct. Dropbox removal uses honest provider-recoverability wording. Existing Google sessions, manifests, files, browser state, modes, UI APIs, and Drive-named agent commands keep their current meaning; no Drive-named command silently operates on Dropbox.
- **DROPBOX-DEC-9 — Product boundary and release:** Supported cloud sync/backups remain in the approved free product boundary. The coordinated Worker-first promotion and Dropbox-enabled client deployment are complete. Worker connection/transfer controls remain fail-closed and may be used for rollback. After a user has Dropbox data, rollback may stop acquisition/transfer but must retain existing Dropbox access and may never silently switch them to Google.

Dropbox App Console production access, its final redirect/branding review, a
post-approval sign-in/token/direct-file canary, and explicit broad-public-release
approval remain delivery gates rather than unresolved product decisions. Prior
capacity, existing-account credential, direct-data, transfer, and compatible
deployment evidence is complete and must not be described as still disabled.
