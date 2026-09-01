import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cloud, CreditCard, RefreshCw } from 'lucide-react';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { useBilling } from '@/contexts/BillingContext';
import { formatBillingOffer, billingTaxQualifier } from '@/utils/billingOfferFormatter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { useClients } from '@/hooks/useClients';
import { countActiveClients } from '@/domain/entitlements/activeClientPolicy';

function trialRemaining(endsAt: string | null): string | null {
    if (!endsAt) return null;
    const remaining = Date.parse(endsAt) - Date.now();
    if (remaining <= 0) return 'Trial ended';
    const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    return `${days} day${days === 1 ? '' : 's'} remaining`;
}

type DeferredBillingAction = 'trial' | 'checkout';

function deferredActionPhrase(action: DeferredBillingAction): string {
    return action === 'trial' ? 'start your Pro trial' : 'continue with Pro';
}

export function BillingPanel({ onOpenSync }: { onOpenSync: () => void }) {
    const billing = useBilling();
    const { handleCheckoutReturn } = billing;
    const { clients } = useClients();
    const [accountConfirmed, setAccountConfirmed] = useState(false);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [deferredAction, setDeferredAction] = useState<DeferredBillingAction | null>(null);
    const checkoutReturnHandled = useRef<string | null>(null);
    const snapshot = billing.resolution.kind === 'canonical'
        ? billing.resolution.snapshot
        : null;
    const proPlan = billing.catalog?.plans[1] ?? null;
    const freePlan = billing.catalog?.plans[0] ?? null;
    const foundingOffer = proPlan?.offers.find(offer => offer.offerKind === 'founding') ?? null;
    const standardOffer = proPlan?.offers.find(offer => offer.offerKind === 'standard') ?? null;
    const foundingMemberLimit = foundingOffer?.founding?.memberLimit ?? null;
    const currentOffer = billing.status?.actions.checkoutOffer ?? null;
    const trialTime = trialRemaining(snapshot?.trialEndsAt ?? null);
    const activeClientCount = countActiveClients(clients);
    const activeClientLimit = snapshot?.limits?.activeClients;
    const statusLabel = useMemo(() => {
        if (!snapshot) return 'Status unavailable';
        if (snapshot.accessStatus === 'trial') return 'Pro trial';
        if (snapshot.accessStatus === 'active') return 'Pro';
        if (snapshot.accessStatus === 'grace') return 'Pro — payment grace';
        if (snapshot.accessStatus === 'suspended') return 'Pro — action required';
        return 'Free';
    }, [snapshot]);

    const run = useCallback(async (name: string, action: () => Promise<void>) => {
        setBusyAction(name);
        setActionError(null);
        try {
            await action();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'The billing action could not be completed.');
        } finally {
            setBusyAction(null);
        }
    }, []);

    useEffect(() => {
        if (!BILLING_FEATURES.ui
            || !billing.hasActiveCloudAccount
            || typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const outcome = params.get('checkout');
        if ((outcome !== 'success' && outcome !== 'cancel')
            || checkoutReturnHandled.current === outcome) return;
        checkoutReturnHandled.current = outcome;
        void run('checkout-return', async () => {
            await handleCheckoutReturn(outcome);
            params.delete('checkout');
            const nextSearch = params.toString();
            window.history.replaceState(
                {},
                '',
                `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`,
            );
        });
    }, [billing.hasActiveCloudAccount, handleCheckoutReturn, run]);

    useEffect(() => {
        if (billing.status) setDeferredAction(null);
    }, [billing.status]);

    if (!billing.status) {
        const actionPhrase = deferredAction ? deferredActionPhrase(deferredAction) : null;
        const foundingAvailability = foundingOffer?.founding?.availability ?? null;

        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Plan &amp; Billing</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Compare plans without connecting. TaskTime checks your cloud account only when you start a trial,
                        subscribe, or manage existing billing.
                    </p>
                </div>

                {freePlan && proPlan ? (
                    <section className="space-y-4" aria-labelledby="plan-options-title">
                        <div>
                            <h3 id="plan-options-title" className="text-lg font-semibold text-foreground">Plan options</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Free keeps the complete local-first core. Pro adds client scale, advanced reporting, and hosted sending.
                            </p>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle><h4>{freePlan.displayName}</h4></CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-3xl font-semibold">€0</p>
                                    <p className="text-sm text-muted-foreground">Free forever. No TaskTime account is required for core use.</p>
                                    <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                                        <li>One active client at a time, with all client history preserved</li>
                                        <li>Unlimited projects, tasks, timers, expenses, quotes, and invoices</li>
                                        <li>Current-month Reports Overview and manual document delivery</li>
                                        <li>Optional Google Drive or Dropbox sync and backups</li>
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="border-foreground/30">
                                <CardHeader>
                                    <CardTitle><h4>{proPlan.displayName}</h4></CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {foundingOffer && foundingMemberLimit !== null && foundingAvailability !== 'exhausted' ? (
                                        <div>
                                            <p className="text-3xl font-semibold">{formatBillingOffer(foundingOffer)}*</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                * Founding pricing is limited to the first {foundingMemberLimit.toLocaleString()} paid members
                                                {standardOffer ? `; new subscriptions are ${formatBillingOffer(standardOffer)} afterward.` : '.'}
                                            </p>
                                        </div>
                                    ) : standardOffer ? (
                                        <div>
                                            <p className="text-3xl font-semibold">{formatBillingOffer(standardOffer)}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">Current standard annual offer.</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Pro pricing is not currently available.</p>
                                    )}
                                    {foundingAvailability === 'temporarily_reserved' ? (
                                        <Notice title="Founding offer is temporarily busy" compact>
                                            TaskTime will confirm availability for your account before Checkout. Standard pricing is never selected early.
                                        </Notice>
                                    ) : null}
                                    <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                                        <li>Unlimited active clients</li>
                                        <li>Advanced professional reports and exports</li>
                                        <li>TaskTime-hosted invoice, quote, and reminder sending</li>
                                        <li>Everything included in Free</li>
                                    </ul>
                                    <p className="text-sm text-muted-foreground">
                                        Trial eligibility and the exact offer for your account are confirmed only when you continue.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="secondary"
                                            leadingIcon={Check}
                                            onClick={() => setDeferredAction('trial')}
                                        >
                                            Start free trial
                                        </Button>
                                        {billing.catalog?.purchaseEnabled && proPlan.offers.length > 0 ? (
                                            <Button
                                                leadingIcon={CreditCard}
                                                onClick={() => setDeferredAction('checkout')}
                                            >
                                                Get Pro
                                            </Button>
                                        ) : null}
                                    </div>
                                    {deferredAction && actionPhrase ? (
                                        <Notice
                                            title={`${billing.hasActiveCloudAccount ? 'Refresh billing status' : 'Set up Cloud Sync'} to ${actionPhrase}`}
                                            icon={Cloud}
                                            variant={billing.hasActiveCloudAccount ? 'warning' : 'default'}
                                            aria-live="polite"
                                        >
                                            <div className="space-y-3">
                                                <p>
                                                    {billing.hasActiveCloudAccount
                                                        ? 'Cloud Sync is connected, but TaskTime could not confirm the current plan. Nothing has started yet. Refresh billing status, then try again.'
                                                        : 'TaskTime uses your selected Google Drive or Dropbox connection to identify the account for trials and subscriptions. Nothing has started yet. Set up Cloud Sync, then return here; your chosen sync mode stays unchanged.'}
                                                </p>
                                                <Button
                                                    variant="secondary"
                                                    disabled={busyAction !== null}
                                                    onClick={billing.hasActiveCloudAccount
                                                        ? () => void run('refresh', billing.refresh)
                                                        : onOpenSync}
                                                >
                                                    {billing.hasActiveCloudAccount
                                                        ? (busyAction === 'refresh' ? 'Refreshing…' : 'Refresh billing status')
                                                        : 'Set up Cloud Sync'}
                                                </Button>
                                            </div>
                                        </Notice>
                                    ) : null}
                                </CardContent>
                            </Card>
                        </div>
                    </section>
                ) : billing.catalogError ? (
                    <Notice title="Plan details are not available" variant="warning">
                        TaskTime could not load the public plan catalog. No trial or purchase action is available until the catalog can be verified.
                    </Notice>
                ) : (
                    <section
                        aria-label="Loading plan options"
                        aria-busy="true"
                        className="grid gap-4 lg:grid-cols-2"
                    >
                        {[0, 1].map(index => (
                            <Card key={index} aria-hidden="true">
                                <CardContent className="space-y-4 p-6">
                                    <div className="h-5 w-20 rounded bg-muted" />
                                    <div className="h-9 w-28 rounded bg-muted" />
                                    <div className="h-4 w-3/4 rounded bg-muted" />
                                    <div className="h-4 w-full rounded bg-muted" />
                                    <div className="h-4 w-5/6 rounded bg-muted" />
                                </CardContent>
                            </Card>
                        ))}
                    </section>
                )}

                {billing.clockUntrusted ? (
                    <Notice title="Device clock needs an online check" variant="warning">
                        Cached Pro access is paused because this device clock moved backwards. Reconnect and refresh billing status.
                    </Notice>
                ) : null}
                {billing.hasActiveCloudAccount && billing.error ? (
                    <Notice title="Billing status is not available" variant="warning">
                        Your data and existing core features remain available. Refresh the active cloud account before a billing action.
                    </Notice>
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Plan &amp; Billing</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {billing.status.account.displayLabel}
                    </p>
                </div>
                <Button
                    variant="secondary"
                    leadingIcon={RefreshCw}
                    disabled={billing.isLoading}
                    onClick={() => void run('refresh', billing.refresh)}
                >
                    {billing.isLoading ? 'Refreshing…' : 'Refresh status'}
                </Button>
            </div>

            {billing.offline ? (
                <Notice title="You are offline" variant="warning">
                    The last verified plan remains bounded by its signed expiry. Trial, Checkout, Portal, and hosted Send
                    require an online confirmation and never run automatically when the connection returns.
                </Notice>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-2xl font-semibold">{statusLabel}</p>
                        {trialTime ? <p className="text-sm text-muted-foreground">{trialTime}</p> : null}
                        {snapshot?.accessStatus === 'free' ? (
                            <p className="text-sm text-muted-foreground">
                                One active client, the current-month Reports Overview, and all shared core tools remain available.
                            </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                            {activeClientCount} active client{activeClientCount === 1 ? '' : 's'}.
                            {activeClientLimit === null ? ' Your plan includes unlimited active clients.' : ''}
                        </p>
                        {activeClientLimit === 1 && activeClientCount > activeClientLimit ? (
                            <Notice title="Active clients are above the Free forward-action limit" variant="warning">
                                Existing over-limit clients remain fully usable. Archive to one active client before creating
                                or restoring another, or unlock unlimited active clients.
                            </Notice>
                        ) : null}
                        {snapshot?.accessStatus === 'free' && snapshot.trialStatus === 'used' ? (
                            <p className="text-sm text-muted-foreground">
                                Your one-time Pro trial has already been used. Starting a subscription still requires an explicit Checkout confirmation.
                            </p>
                        ) : null}
                        {snapshot?.accessStatus === 'free'
                            && (billing.status.subscription.billingStatus === 'canceled'
                                || billing.status.subscription.billingStatus === 'incomplete_expired') ? (
                            <Notice title="Subscription ended">
                                Core tools and all existing data remain available. A new purchase never mutates or hides your records.
                            </Notice>
                        ) : null}
                        {billing.status.subscription.price && snapshot?.source === 'subscription' ? (
                            <p className="text-sm text-muted-foreground">
                                Current subscription base price: {formatBillingOffer(billing.status.subscription.price)}.
                                Founding pricing is retained only while this same subscription continues or remains recoverable.
                            </p>
                        ) : null}
                        {billing.status.subscription.repairRequired ? (
                            <Notice title="Billing state needs review" variant="warning">
                                New acquisition is paused while TaskTime support reconciles the canonical subscription state.
                            </Notice>
                        ) : null}
                        {snapshot?.cancelAtPeriodEnd ? (
                            <Notice title="Cancellation scheduled" variant="warning">
                                Pro remains available through {snapshot.subscriptionCurrentPeriodEnd
                                    ? new Date(snapshot.subscriptionCurrentPeriodEnd).toLocaleDateString()
                                    : 'the current billing period'}.
                            </Notice>
                        ) : null}
                        {snapshot?.accessStatus === 'grace' ? (
                            <Notice title="Payment needs attention" variant="warning">
                                Pro access is temporarily available during the approved payment grace period.
                            </Notice>
                        ) : null}
                        {snapshot?.accessStatus === 'suspended' ? (
                            <Notice title="Resolve billing before new Pro actions" variant="warning">
                                Existing data remains available. Use billing management or support to resolve the account state.
                            </Notice>
                        ) : null}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Hosted invoice email</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {billing.status.usage.invoiceEmail.available
                            && billing.status.usage.invoiceEmail.entitled ? (
                            <>
                                <p className="text-2xl font-semibold">
                                    {billing.status.usage.invoiceEmail.effectiveRemaining} remaining
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Resets {billing.status.usage.invoiceEmail.window?.periodEnd
                                        ? new Date(billing.status.usage.invoiceEmail.window.periodEnd).toLocaleDateString()
                                        : 'at the next UTC monthly boundary'}.
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Usage is temporarily unavailable. The Worker remains authoritative before any hosted send.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {billing.status.actions.checkoutOfferReason === 'temporarily_reserved' ? (
                <Notice title="Founding offer is temporarily busy">
                    A bounded Checkout reservation is still in progress. This does not switch you to standard pricing;
                    refresh and explicitly try again after capacity is released.
                </Notice>
            ) : null}

            {snapshot?.accessStatus === 'free' && snapshot.trialStatus === 'eligible' ? (
                <Card>
                    <CardHeader><CardTitle>Try Pro</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            The trial lasts {billing.catalog?.trial.durationHours
                                ? billing.catalog.trial.durationHours / 24
                                : 'the displayed number of'} days, requires no payment method, does not auto-charge,
                            and does not reserve a founding place.
                        </p>
                        <label className="flex items-start gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={accountConfirmed}
                                onChange={event => setAccountConfirmed(event.target.checked)}
                                className="mt-1"
                            />
                            <span>
                                Start the trial for TaskTime account <strong>{billing.status.account.accountReference}</strong>.
                            </span>
                        </label>
                        <Button
                            leadingIcon={Check}
                            disabled={!accountConfirmed
                                || !BILLING_FEATURES.trialActivation
                                || !billing.status.actions.trialActivationEnabled
                                || busyAction !== null}
                            onClick={() => void run('trial', billing.startTrial)}
                        >
                            {busyAction === 'trial' ? 'Starting…' : 'Start free trial'}
                        </Button>
                    </CardContent>
                </Card>
            ) : null}

            {currentOffer && proPlan ? (
                <Card>
                    <CardHeader><CardTitle>Get Pro</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-2xl font-semibold">
                                {formatBillingOffer(currentOffer.price)}{currentOffer.offerKind === 'founding' ? '*' : ''}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {billingTaxQualifier(currentOffer.price.taxPresentation)} · renews automatically
                            </p>
                        </div>
                        {currentOffer.offerKind === 'founding' ? (
                            <p className="text-sm text-muted-foreground">
                                * Founding pricing is limited {foundingMemberLimit !== null
                                    ? `to the first ${foundingMemberLimit.toLocaleString()} paid members `
                                    : 'while founding places remain '}
                                and is retained while the same subscription continues or remains recoverable.
                            </p>
                        ) : null}
                        <Button
                            leadingIcon={CreditCard}
                            disabled={!BILLING_FEATURES.checkout
                                || !billing.status.actions.checkoutEnabled
                                || busyAction !== null}
                            onClick={() => void run('checkout', async () => {
                                const checkout = await billing.createCheckout(
                                    currentOffer.offerId,
                                    billing.status!.planConfigVersion,
                                );
                                window.location.assign(checkout.url);
                            })}
                        >
                            Continue to secure checkout
                        </Button>
                    </CardContent>
                </Card>
            ) : null}

            {billing.status.actions.portalAvailable ? (
                <Button
                    variant="secondary"
                    disabled={busyAction !== null}
                    onClick={() => void run('portal', async () => {
                        const url = await billing.openPortal();
                        window.location.assign(url);
                    })}
                >
                    Manage billing
                </Button>
            ) : null}

            {actionError ? (
                <Notice title="Billing action was not completed" variant="warning">
                    No new action was started automatically. Refresh status before trying again. ({actionError})
                </Notice>
            ) : null}
        </div>
    );
}
