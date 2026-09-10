import { useEffect } from 'react';
import { Cloud, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEntitlementRecovery, type EntitlementState } from '@/domain/entitlements/entitlementPolicy';
import type { EntitlementResolution } from '@/domain/entitlements/entitlementTypes';

const COPY: Record<string, { title: string; description: string }> = {
    monthly: { title: 'Monthly Summary', description: 'Review a period summary and prepare the monthly accounting pack.' },
    statement: { title: 'Client Statement', description: 'Review opening balance, activity, payments, and closing balance.' },
    'work-summary': { title: 'Project Work Summary', description: 'Summarize worked time by task for a client-ready activity report.' },
    tax: { title: 'VAT / Tax Summary', description: 'Review sales tax, expense tax, claim state, and geography breakdowns.' },
    invoices: { title: 'Issued Invoices', description: 'Inspect invoice totals, statuses, and register summaries.' },
    outstanding: { title: 'Outstanding / Aging', description: 'Track open invoices, overdue balances, and aging buckets.' },
    expenses: { title: 'Expenses report', description: 'Review categorized expenses, tax treatment, and claim state.' },
    hours: { title: 'Hours Worked', description: 'Analyze logged time by project and client.' },
    'to-invoice': { title: 'To Invoice', description: 'Review uninvoiced time and billable expenses.' },
};

export function ReportsProPreview({
    section,
    resolution,
    entitlementState,
    showGetPro,
    onReadyChange,
    onOpenBilling,
    onOpenSync,
    onBackToOverview,
}: {
    section: string;
    resolution: EntitlementResolution;
    entitlementState: EntitlementState;
    showGetPro: boolean;
    onReadyChange?: ((ready: boolean) => void) | null;
    onOpenBilling: () => void;
    onOpenSync: () => void;
    onBackToOverview: () => void;
}) {
    useEffect(() => onReadyChange?.(true), [onReadyChange]);
    const copy = COPY[section] ?? COPY.monthly;
    const unavailable = resolution.kind !== 'canonical';
    const recovery = getEntitlementRecovery(entitlementState);
    const suspended = recovery.kind === 'billing';
    const reconnectRequired = recovery.kind === 'reconnect';
    const reconnecting = recovery.kind === 'reconnecting';
    const offline = recovery.kind === 'offline';
    const verifiedFree = entitlementState.verified && entitlementState.plan === 'free';
    const freshAccountFree = !entitlementState.verified
        && entitlementState.plan === 'unknown'
        && entitlementState.connection === 'disconnected';
    const message = suspended
        ? 'Resolve billing before starting a new Pro report action.'
        : showGetPro
            ? `Get Pro to unlock ${copy.title}.`
            : reconnectRequired
                ? verifiedFree
                    ? 'Reconnect Cloud Sync to view Pro options for your Free plan.'
                    : 'Reconnect Cloud Sync to confirm your existing plan.'
                : reconnecting
                    ? verifiedFree
                        ? 'Your Free plan is available while TaskTime reconnects. Pro options will return when the connection is ready.'
                        : 'Reconnecting to your TaskTime cloud account and checking Pro access.'
                    : offline
                        ? verifiedFree
                            ? 'Your Free plan is available. Go online to view Pro options.'
                            : "You're offline. Go online to check Pro access."
                        : freshAccountFree
                            ? 'Advanced reports are available with TaskTime Pro. View current options in Plan & Billing.'
                            : unavailable
                                ? 'TaskTime could not confirm the current plan. Open Plan & Billing to check its status.'
                                : 'Unlock advanced reports with a Pro trial or subscription.';
    const primaryAction = suspended
        ? { label: 'Manage billing', onClick: onOpenBilling }
        : showGetPro
            ? { label: 'Get Pro', onClick: onOpenBilling, icon: Rocket }
            : reconnectRequired
                ? { label: 'Reconnect Cloud Sync', onClick: onOpenSync, icon: Cloud }
                : reconnecting || offline
                    ? null
                    : freshAccountFree
                        ? { label: 'View Pro options', onClick: onOpenBilling }
                        : unavailable
                            ? { label: 'Check plan status', onClick: onOpenBilling }
                            : { label: 'View Pro options', onClick: onOpenBilling };

    return (
        <section className="rounded-xl border bg-card p-6 shadow-sm" aria-labelledby="reports-pro-preview-title">
            <p className="text-sm font-medium text-primary">TaskTime Pro report</p>
            <h2 id="reports-pro-preview-title" className="mt-2 text-2xl font-semibold">{copy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.description}</p>
            <div className="mt-5 rounded-lg border border-dashed bg-muted/30 p-5">
                <p className="font-medium">{message}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                    Your projects, clients, invoices, expenses, and time remain local and fully available.
                    This preview does not load protected report history or calculations.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {primaryAction ? (
                        <Button
                            leadingIcon={primaryAction.icon}
                            onClick={primaryAction.onClick}
                        >
                            {primaryAction.label}
                        </Button>
                    ) : null}
                    <Button
                        variant="outline"
                        onClick={onBackToOverview}
                    >
                        Back to free overview
                    </Button>
                </div>
            </div>
        </section>
    );
}
