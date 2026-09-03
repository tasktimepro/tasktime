import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Cloud, CreditCard, RefreshCw, Rocket } from 'lucide-react';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { useBilling } from '@/contexts/BillingContext';
import { BillingClientError } from '@/services/billingClient';
import { formatBillingOffer, billingTaxQualifier } from '@/utils/billingOfferFormatter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function billingActionErrorMessage(error: unknown): string {
    if (error instanceof BillingClientError) {
        if (error.code === 'CHECKOUT_EXPIRED') {
            return 'The previous Checkout link expired. Please try Get Pro again.';
        }
        if (error.code === 'CHECKOUT_COMPLETED' || error.code === 'ACTIVE_SUBSCRIPTION') {
            return 'TaskTime found an existing Checkout or subscription. Refresh your plan status to continue.';
        }
        if (error.code === 'FOUNDING_OFFER_BUSY') {
            return 'The founding offer is temporarily busy. Refresh your plan status and try again shortly.';
        }
        if (error.retryable) {
            return 'TaskTime could not reach billing. Check your connection and try again.';
        }
    }
    if (error instanceof Error
        && error.message === 'The Pro offer changed. Review the updated order summary and confirm again.') {
        return error.message;
    }
    return 'TaskTime could not complete this billing action. Refresh your plan status and try again.';
}

export function BillingPanel({
    onOpenSync,
    cloudSyncNeedsReconnect = false,
    connectedAccountEmail = null,
}: {
    onOpenSync: () => void;
    cloudSyncNeedsReconnect?: boolean;
    connectedAccountEmail?: string | null;
}) {
    const billing = useBilling();
    const { handleCheckoutReturn } = billing;
    const { clients } = useClients();
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [deferredAction, setDeferredAction] = useState<DeferredBillingAction | null>(null);
    const checkoutReturnHandled = useRef<string | null>(null);
    const status = billing.status;
    const snapshot = billing.resolution.kind === 'canonical'
        ? billing.resolution.snapshot
        : null;
    const proPlan = billing.catalog?.plans[1] ?? null;
    const freePlan = billing.catalog?.plans[0] ?? null;
    const foundingOffer = proPlan?.offers.find(offer => offer.offerKind === 'founding') ?? null;
    const standardOffer = proPlan?.offers.find(offer => offer.offerKind === 'standard') ?? null;
    const foundingMemberLimit = foundingOffer?.founding?.memberLimit ?? null;
    const currentOffer = status?.actions.checkoutOffer ?? null;
    const trialTime = trialRemaining(snapshot?.trialEndsAt ?? null);
    const activeClientCount = countActiveClients(clients);
    const activeClientLimit = snapshot?.limits?.activeClients;
    const currentPlan = snapshot
        ? (snapshot.accessStatus === 'free' ? 'free' : 'pro')
        : null;

    const run = useCallback(async (name: string, action: () => Promise<void>) => {
        setBusyAction(name);
        setActionError(null);
        try {
            await action();
        } catch (error) {
            setActionError(billingActionErrorMessage(error));
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

    const actionPhrase = deferredAction ? deferredActionPhrase(deferredAction) : null;
    const foundingAvailability = foundingOffer?.founding?.availability ?? null;
    const cloudActionLabel = billing.hasActiveCloudAccount
        ? 'Refresh billing status'
        : cloudSyncNeedsReconnect
            ? 'Reconnect Cloud Sync'
            : 'Set up Cloud Sync';
    const canRenderPlans = Boolean((freePlan && proPlan) || status);
    const freePlanName = freePlan?.displayName ?? 'Free';
    const proPlanName = proPlan?.displayName ?? 'Pro';
    const subscriptionPrice = currentPlan === 'pro' && snapshot?.source === 'subscription'
        ? status?.subscription.price ?? null
        : null;
    const displayedOffer = subscriptionPrice
        ? {
            price: subscriptionPrice,
            offerKind: status?.subscription.offerKind ?? null,
            source: 'subscription' as const,
        }
        : currentOffer
            ? {
                price: currentOffer.price,
                offerKind: currentOffer.offerKind,
                source: 'checkout' as const,
            }
            : foundingOffer && foundingAvailability !== 'exhausted'
                ? {
                    price: foundingOffer,
                    offerKind: foundingOffer.offerKind,
                    source: 'catalog' as const,
                }
                : standardOffer
                    ? {
                        price: standardOffer,
                        offerKind: standardOffer.offerKind,
                        source: 'catalog' as const,
                    }
                    : null;
    const trialEligible = status
        && snapshot?.accessStatus === 'free'
        && snapshot.trialStatus === 'eligible';
    const checkoutAvailable = Boolean(status && currentOffer);
    const canManageBilling = Boolean(
        status?.actions.portalAvailable
        && currentPlan === 'pro'
        && snapshot?.source === 'subscription',
    );
    const accountEmail = connectedAccountEmail?.trim() || null;
    const connectedProviderLabel = status?.account.provider === 'dropbox' ? 'Dropbox' : 'Google Drive';
    const accountDisplayLabel = status
        ? `${connectedProviderLabel} · ${accountEmail ?? 'Connected account'}`
        : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Plan &amp; Billing</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {status
                            ? accountDisplayLabel
                            : 'Compare plans without connecting. TaskTime checks your cloud account only when you start a trial, subscribe, or manage existing billing.'}
                    </p>
                </div>
                {billing.hasActiveCloudAccount ? (
                    <Button
                        variant="secondary"
                        leadingIcon={RefreshCw}
                        disabled={billing.isLoading || busyAction !== null}
                        onClick={() => void run('refresh', billing.refresh)}
                    >
                        {billing.isLoading || busyAction === 'refresh' ? 'Refreshing…' : 'Refresh status'}
                    </Button>
                ) : null}
            </div>

            {billing.offline ? (
                <Notice title="You are offline" variant="warning">
                    The last verified plan remains bounded by its signed expiry. Trial, Checkout, Portal, and hosted Send
                    require an online confirmation and never run automatically when the connection returns.
                </Notice>
            ) : null}

            {canRenderPlans ? (
                <section className="space-y-4" aria-labelledby="plan-options-title">
                    <div>
                        <h3 id="plan-options-title" className="text-lg font-semibold text-foreground">Plan options</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Free keeps the complete local-first core. Pro adds client scale, advanced reporting, and hosted sending.
                        </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card role="region" aria-labelledby="free-plan-title">
                            <CardHeader>
                                <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle><h4 id="free-plan-title">{freePlanName}</h4></CardTitle>
                                    {currentPlan === 'free' ? (
                                        <Badge variant="secondary" className="">Current plan</Badge>
                                    ) : null}
                                </div>
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

                                {status && currentPlan === 'free' ? (
                                    <div className="space-y-3 border-t pt-4">
                                        <p className="text-sm text-muted-foreground">
                                            {activeClientCount} active client{activeClientCount === 1 ? '' : 's'} on this device.
                                        </p>
                                        {activeClientLimit === 1 && activeClientCount > activeClientLimit ? (
                                            <Notice title="Active clients are above the Free forward-action limit" variant="warning" compact>
                                                Existing over-limit clients remain fully usable. Archive to one active client before creating
                                                or restoring another, or unlock unlimited active clients.
                                            </Notice>
                                        ) : null}
                                        {snapshot?.trialStatus === 'used' ? (
                                            <p className="text-sm text-muted-foreground">
                                                This TaskTime cloud account has already used its one-time Pro trial. Starting a subscription still requires an explicit Checkout confirmation.
                                            </p>
                                        ) : null}
                                        {status.subscription.billingStatus === 'canceled'
                                            || status.subscription.billingStatus === 'incomplete_expired' ? (
                                            <Notice title="Subscription ended" compact>
                                                Core tools and all existing data remain available. A new purchase never mutates or hides your records.
                                            </Notice>
                                        ) : null}
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>

                        <Card role="region" aria-labelledby="pro-plan-title" className="border-foreground/30">
                            <CardHeader>
                                <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle><h4 id="pro-plan-title">{proPlanName}</h4></CardTitle>
                                    {currentPlan === 'pro' ? (
                                        <Badge variant="secondary" className="">Current plan</Badge>
                                    ) : null}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {displayedOffer ? (
                                    <div>
                                        <p className="text-3xl font-semibold">
                                            {formatBillingOffer(displayedOffer.price)}
                                            {displayedOffer.offerKind === 'founding' ? '*' : ''}
                                        </p>
                                        {displayedOffer.source === 'catalog' && displayedOffer.offerKind === 'standard' ? (
                                            <p className="mt-1 text-sm text-muted-foreground">Current standard annual offer.</p>
                                        ) : null}
                                        {displayedOffer.offerKind === 'founding' ? (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                * Founding pricing is limited {foundingMemberLimit !== null
                                                    ? `to the first ${foundingMemberLimit.toLocaleString()} paid members`
                                                    : 'while founding places remain'}
                                                {displayedOffer.source === 'catalog'
                                                    ? (standardOffer ? `; new subscriptions are ${formatBillingOffer(standardOffer)} afterward.` : '.')
                                                    : ' and is retained while the same subscription continues or remains recoverable.'}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Pro pricing is not currently available.</p>
                                )}

                                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                                    <li>Unlimited active clients</li>
                                    <li>Advanced professional reports and exports</li>
                                    <li>TaskTime-hosted invoice, quote, and reminder sending</li>
                                    <li>Everything included in Free</li>
                                </ul>

                                {!status ? (
                                    <>
                                        {currentPlan === 'pro' ? (
                                            <>
                                                <p className="text-sm text-muted-foreground">
                                                    This device has a last verified Pro plan. Refresh the connected account before managing billing;
                                                    TaskTime will not invite you to purchase Pro again while status is being confirmed.
                                                </p>
                                                <Button
                                                    variant="secondary"
                                                    leadingIcon={RefreshCw}
                                                    disabled={busyAction !== null}
                                                    onClick={() => void run('refresh', billing.refresh)}
                                                >
                                                    {busyAction === 'refresh' ? 'Refreshing…' : 'Refresh billing status'}
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-sm text-muted-foreground">
                                                    Trial eligibility and the exact offer are confirmed for your connected TaskTime cloud account when you continue.
                                                </p>
                                                <div
                                                    className="flex w-full flex-wrap items-center gap-2"
                                                    data-testid="pro-plan-actions"
                                                >
                                                    <Button
                                                        variant="secondary"
                                                        leadingIcon={Check}
                                                        onClick={() => setDeferredAction('trial')}
                                                    >
                                                        Start free trial
                                                    </Button>
                                                    <div
                                                        className="ml-auto flex flex-wrap justify-end gap-2"
                                                        data-testid="pro-plan-actions-right"
                                                    >
                                                        {billing.catalog?.purchaseEnabled && (proPlan?.offers.length ?? 0) > 0 ? (
                                                            <Button
                                                                leadingIcon={Rocket}
                                                                onClick={() => setDeferredAction('checkout')}
                                                            >
                                                                Get Pro
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                {deferredAction && actionPhrase ? (
                                                    <Notice
                                                        title={`${cloudActionLabel} to ${actionPhrase}`}
                                                        icon={Cloud}
                                                        variant={billing.hasActiveCloudAccount ? 'warning' : 'default'}
                                                        aria-live="polite"
                                                    >
                                                        <div className="space-y-3">
                                                            <p>
                                                                {billing.hasActiveCloudAccount
                                                                    ? 'Cloud Sync is connected, but TaskTime could not confirm the current plan. Nothing has started yet. Refresh billing status, then try again.'
                                                                    : cloudSyncNeedsReconnect
                                                                        ? 'Cloud Sync is already set up. Reconnect it to confirm your TaskTime account for trials and subscriptions. Nothing has started yet, and your chosen sync mode stays unchanged.'
                                                                        : 'TaskTime uses your selected Google Drive or Dropbox connection to identify the account for trials and subscriptions. Nothing has started yet. Set up Cloud Sync, then return here; your chosen sync mode stays unchanged.'}
                                                            </p>
                                                            <Button
                                                                variant={billing.hasActiveCloudAccount ? 'secondary' : 'default'}
                                                                leadingIcon={billing.hasActiveCloudAccount || cloudSyncNeedsReconnect
                                                                    ? RefreshCw
                                                                    : Cloud}
                                                                disabled={busyAction !== null}
                                                                onClick={billing.hasActiveCloudAccount
                                                                    ? () => void run('refresh', billing.refresh)
                                                                    : onOpenSync}
                                                            >
                                                                {billing.hasActiveCloudAccount
                                                                    ? (busyAction === 'refresh' ? 'Refreshing…' : 'Refresh billing status')
                                                                    : cloudActionLabel}
                                                            </Button>
                                                        </div>
                                                    </Notice>
                                                ) : null}
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {currentPlan === 'pro' ? (
                                            <div className="space-y-3 border-t pt-4">
                                                <p className="text-sm font-medium text-foreground">
                                                    {snapshot?.accessStatus === 'trial'
                                                        ? 'Pro trial'
                                                        : snapshot?.accessStatus === 'grace'
                                                            ? 'Pro · payment grace'
                                                            : snapshot?.accessStatus === 'suspended'
                                                                ? 'Pro · action required'
                                                                : 'Pro subscription'}
                                                </p>
                                                {trialTime ? <p className="text-sm text-muted-foreground">{trialTime}</p> : null}
                                                <p className="text-sm text-muted-foreground">
                                                    {activeClientCount} active client{activeClientCount === 1 ? '' : 's'} on this device.
                                                    {activeClientLimit === null ? ' Your plan includes unlimited active clients.' : ''}
                                                </p>
                                            </div>
                                        ) : null}

                                        {trialEligible ? (
                                            <div className="space-y-3 border-t pt-4">
                                                <p className="text-sm text-muted-foreground">
                                                    Start your one-time {billing.catalog?.trial.durationHours
                                                        ? `${billing.catalog.trial.durationHours / 24}-day `
                                                        : ''}Pro trial for{' '}
                                                    {accountEmail ? (
                                                        <strong className="text-foreground">{accountEmail}</strong>
                                                    ) : (
                                                        <>your connected {connectedProviderLabel} account</>
                                                    )}.
                                                    {' '}This trial stays with your TaskTime cloud account if you reconnect it or transfer cloud providers.
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    No payment method is required, and you won't be charged automatically. The trial does not
                                                    reserve a founding place.
                                                </p>
                                            </div>
                                        ) : null}

                                        {status.actions.checkoutOfferReason === 'temporarily_reserved' ? (
                                            <Notice title="Founding offer is temporarily busy" compact>
                                                A bounded Checkout reservation is still in progress. This does not switch you to standard pricing;
                                                refresh and explicitly try again after capacity is released.
                                            </Notice>
                                        ) : null}
                                        {status.subscription.repairRequired ? (
                                            <Notice title="Billing state needs review" variant="warning" compact>
                                                New acquisition is paused while TaskTime support reconciles the canonical subscription state.
                                            </Notice>
                                        ) : null}
                                        {snapshot?.cancelAtPeriodEnd ? (
                                            <Notice title="Cancellation scheduled" variant="warning" compact>
                                                Pro remains available through {snapshot.subscriptionCurrentPeriodEnd
                                                    ? new Date(snapshot.subscriptionCurrentPeriodEnd).toLocaleDateString()
                                                    : 'the current billing period'}.
                                            </Notice>
                                        ) : null}
                                        {snapshot?.accessStatus === 'grace' ? (
                                            <Notice title="Payment needs attention" variant="warning" compact>
                                                Pro access is temporarily available during the approved payment grace period.
                                            </Notice>
                                        ) : null}
                                        {snapshot?.accessStatus === 'suspended' ? (
                                            <Notice title="Resolve billing before new Pro actions" variant="warning" compact>
                                                Existing data remains available. Use billing management or support to resolve the account state.
                                            </Notice>
                                        ) : null}

                                        <div
                                            className="flex w-full flex-wrap items-center gap-2"
                                            data-testid="pro-plan-actions"
                                        >
                                            {trialEligible ? (
                                                <Button
                                                    variant="secondary"
                                                    leadingIcon={Check}
                                                    disabled={!BILLING_FEATURES.trialActivation
                                                        || !status.actions.trialActivationEnabled
                                                        || busyAction !== null}
                                                    onClick={() => void run('trial', billing.startTrial)}
                                                >
                                                    {busyAction === 'trial' ? 'Starting…' : 'Start free trial'}
                                                </Button>
                                            ) : null}
                                            <div
                                                className="ml-auto flex flex-wrap justify-end gap-2"
                                                data-testid="pro-plan-actions-right"
                                            >
                                                {canManageBilling ? (
                                                    <Button
                                                        variant="secondary"
                                                        leadingIcon={CreditCard}
                                                        disabled={busyAction !== null}
                                                        onClick={() => void run('portal', async () => {
                                                            const url = await billing.openPortal();
                                                            window.location.assign(url);
                                                        })}
                                                    >
                                                        Manage billing
                                                    </Button>
                                                ) : null}
                                                {checkoutAvailable && currentOffer ? (
                                                    <Button
                                                        leadingIcon={Rocket}
                                                        loading={busyAction === 'checkout'}
                                                        loadingText="Opening Checkout…"
                                                        disabled={!BILLING_FEATURES.checkout
                                                            || !status.actions.checkoutEnabled
                                                            || busyAction !== null}
                                                        onClick={() => void run('checkout', async () => {
                                                            const checkout = await billing.createCheckout(
                                                                currentOffer.offerId,
                                                                status.planConfigVersion,
                                                            );
                                                            window.location.assign(checkout.url);
                                                        })}
                                                    >
                                                        Get Pro
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                        {displayedOffer?.source !== 'catalog' ? (
                                            <p className="w-full text-right text-sm text-muted-foreground">
                                                {billingTaxQualifier(displayedOffer.price.taxPresentation)}
                                            </p>
                                        ) : null}
                                    </>
                                )}
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
            {actionError ? (
                <Notice title="Billing action was not completed" variant="warning">
                    {actionError}
                </Notice>
            ) : null}
        </div>
    );
}
