# Ambiguities And Open Decisions

Unknowns are recorded here rather than silently resolved by an agent.

## Architecture and operations

### Historical compatibility support window

The repository validates tolerant historical shapes, but there is no single documented minimum supported backup/app version. Do not remove compatibility code until a support policy and migration evidence exist.

### Dedicated agent evals

Agent commands are deterministic and currently use tests/smoke flows. If future integrations add model-authored planning or interpretation inside this repository, define eval fixtures and thresholds before shipping that behavior.

## Subscription billing and entitlements

The recurring-subscription architecture has been reconciled against the current direct-Drive, local-agent, account-deletion, Reports/tax, and public-copy baseline. The detailed private plan owns the dependency order, contracts, tests, deployment, and rollback. Disabled foundation work may begin, but Checkout, trial activation, and Pro enforcement remain blocked while any item below is marked open.

### Approved August 19, 2026

- **BILL-DEC-1 — Free versus Pro boundary:** The main Reports workspace, report-specific CSV/PDF/accountant-pack outputs, equivalent agent report tools, and TaskTime-hosted invoice/quote/reminder email sending are Pro. Core local records/workflows, invoices/quotes and PDF download, the current Dashboard metrics widget, portable import/export, Drive sync/backups, Web Push, and equivalent core agent workflows remain free.
- **BILL-DEC-2 — Email boundary, partial:** Free has no TaskTime-hosted email sends. Trial and paid Pro share one configured monthly allowance; each delivered primary or forwarded message consumes one unit. The exact Pro allowance remains open.
- **BILL-DEC-3 — Drive:** Manual, Backup, and Sync modes and all Drive backup/recovery/privacy controls remain free.
- **BILL-DEC-4 — Existing/new users:** There is no permanent grandfathered Pro access. Every eligible existing or new account may explicitly start the same one-time 30-day Pro trial; launch does not automatically start it.
- **BILL-DEC-5 — Provider-neutral OAuth identity:** TaskTime does not add a separate identity-only Google login. The one selected cloud provider (Google Drive or Dropbox) authenticates storage and TaskTime-hosted services. The Worker maps its domain-separated provider subject to one opaque hosted principal used by email, metrics, and future trial/subscription state. Explicit provider transfer links the two authenticated subjects before activation so allowances and entitlements follow the user without requiring Google.
- **BILL-DEC-7 — Trial portion:** The initial trial is a TaskTime-owned, account-bound 30 x 24-hour entitlement with no card, Stripe subscription, automatic charge, renewal, reset, or payment-failure grace. It begins only after an explicit account-specific confirmation.
- **BILL-DEC-10 — Web Push:** Web Push remains free for the initial Pro release.
- **BILL-DEC-11 — Local limits:** No local entity or usage limits are included in the initial release. Any future limit is a separately approved compatibility project.
- **Public wording:** TaskTime Pro remains truthfully free, open source, local-first, and usable without a TaskTime account for core use. Launch copy preserves those claims and introduces Pro as an optional Reports/email upgrade; it corrects only conflicting claims that those two features are ungated.

### Still open before launch

- **BILL-DEC-2 — Pro email allowance:** Approve the exact monthly Trial/Pro send allowance.
- **BILL-DEC-6 — Offline and payment grace:** Approve signed-assertion lifetime, clock tolerance, paid payment-failure grace, and immediate-revocation exceptions. Trial assertions can never extend beyond the trial end.
- **BILL-DEC-7 — Paid commercial lifecycle:** Approve price/currency, monthly/annual discount, promotions, refunds/disputes, cancellation timing, and Portal proration/plan switching.
- **BILL-DEC-8 — Seller and tax model:** Confirm seller identity, merchant-of-record choice, tax registrations/product code, price tax behavior, tax-ID collection, receipts, filing/remittance, and refund terms with appropriate professional review.
- **BILL-DEC-9 — Support, retention, and repair:** Approve founder/beta/goodwill grants, trial-extension exceptions, audit/expiry rules, the minimal retained trial-eligibility marker after billing-profile deletion, and authenticated hosted-principal/Stripe link repair.

Before enforcement, every approved answer must be reflected in product requirements, acceptance criteria, public interface contracts, Privacy/Terms, active public claims, tests, and the release plan without claiming unimplemented behavior is already live.

## Cloud storage provider expansion

The Dropbox direction below was approved on August 19, 2026. These are implementation constraints, not claims that Dropbox is already available. Current Google-only requirements, contracts, and public copy remain authoritative until the corresponding implementation and rollout slices ship.

### Approved August 19, 2026

- **DROPBOX-DEC-1 — Provider model:** A browser profile has exactly one active cloud-sync provider. Google and Dropbox are not mirrored simultaneously. A second provider connection may exist only as staged state inside an explicit transfer.
- **DROPBOX-DEC-2 — Transfer:** Google-to-Dropbox and Dropbox-to-Google transfer must fully reconcile/materialize the source, stage every live document, commit the target manifest last, read back and verify the target, recheck the source, and only then activate the target. Failure keeps the source active and preserves local dirty evidence. Source files and historical backups remain unless the user separately removes them; the target receives the live workspace plus one handoff backup rather than an automatic copy of all historical backups.
- **DROPBOX-DEC-3 — Cross-device boundary:** One active provider is strictly enforceable in the current browser profile and its same-origin tabs. Without a central TaskTime account, an offline device or legacy PWA cannot be switched atomically. Other devices do not need to disconnect before transfer, but TaskTime should remain closed on them until it finishes; they must connect to the new provider before editing again. Upgraded clients honor a non-sensitive migration marker, and provider revocation remains the dependable way to stop a legacy client from using the former grant. Public/UI wording may not claim a global atomic switch.
- **DROPBOX-DEC-4 — Dropbox access:** Use Dropbox App Folder with only `files.metadata.read`, `files.metadata.write`, `files.content.read`, and `files.content.write`. Do not request Full Dropbox, sharing/team/contact, permanent-delete, or account-info access unless a later approved need requires it.
- **DROPBOX-DEC-5 — Privacy and tokens:** Routine sync/backup/restore/wipe/transfer bodies go directly browser-to-provider and never through the Worker. The Worker keeps encrypted refresh credentials and issues short-lived tokens; browser tokens remain tab-memory-only. Describe this as a server-blind routine data path, not end-to-end encryption or strict zero knowledge.
- **DROPBOX-DEC-6 — Cloudflare capacity:** Preserve zero-request cooldown paths, one direct metadata request for a stale unchanged check with a warm token, and Worker request counts independent of file bytes/document count. Replace KV-backed abuse counters before Dropbox rollout and require doubled-peak capacity headroom; use paid KV or a compatible D1 session migration before launch if necessary.
- **DROPBOX-DEC-7 — Feature and identity parity:** The selected Google Drive or Dropbox session authorizes the same TaskTime storage, hosted-email, privacy-safe metrics, agent, and future Pro feature set. Dropbox never requires a parallel Google session. The Worker derives provider-separated hashes and maps them to one opaque hosted principal; an explicit authenticated transfer links ownership before activation, preserves existing Google hashes/quota history, and makes the target session authoritative.
- **DROPBOX-DEC-8 — Destructive actions and compatibility:** Local disconnect, OAuth revocation, provider-data removal, and transfer remain distinct. Dropbox removal uses honest provider-recoverability wording. Existing Google sessions, manifests, files, browser state, modes, UI APIs, and Drive-named agent commands keep their current meaning; no Drive-named command silently operates on Dropbox.
- **DROPBOX-DEC-9 — Product boundary and release:** Supported cloud sync/backups remain in the approved free product boundary. With only the two known production users, the release uses a coordinated Worker-first promotion followed by one Dropbox-enabled client deployment rather than separate hidden-client and bounded-connection stages. Worker connection/transfer controls remain fail-closed and may be used for rollback. After a user has Dropbox data, rollback may stop acquisition/transfer but must retain existing Dropbox access and may never silently switch them to Google.

Dropbox App Console production approval, exact redirect/branding review, authenticated credential canaries, Cloudflare capacity evidence, and explicit release/deployment approval remain delivery gates rather than unresolved product decisions.
