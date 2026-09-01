import { useEffect } from 'react';
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
    onReadyChange,
    onOpenBilling,
    onBackToOverview,
}: {
    section: string;
    resolution: EntitlementResolution;
    onReadyChange?: ((ready: boolean) => void) | null;
    onOpenBilling: () => void;
    onBackToOverview: () => void;
}) {
    useEffect(() => onReadyChange?.(true), [onReadyChange]);
    const copy = COPY[section] ?? COPY.monthly;
    const unavailable = resolution.kind !== 'canonical';
    const suspended = resolution.kind === 'canonical'
        && resolution.snapshot.accessStatus === 'suspended';
    return (
        <section className="rounded-xl border bg-card p-6 shadow-sm" aria-labelledby="reports-pro-preview-title">
            <p className="text-sm font-medium text-primary">TaskTime Pro report</p>
            <h2 id="reports-pro-preview-title" className="mt-2 text-2xl font-semibold">{copy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.description}</p>
            <div className="mt-5 rounded-lg border border-dashed bg-muted/30 p-5">
                <p className="font-medium">
                    {unavailable
                        ? 'Confirm your TaskTime cloud account to check access.'
                        : suspended
                            ? 'Resolve billing before starting a new Pro report action.'
                            : 'Unlock advanced reports with a Pro trial or subscription.'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                    Your projects, clients, invoices, expenses, and time remain local and fully available.
                    This preview does not load protected report history or calculations.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onOpenBilling}
                        className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                        {unavailable ? 'Check account' : suspended ? 'Manage billing' : 'View Pro options'}
                    </button>
                    <button
                        type="button"
                        onClick={onBackToOverview}
                        className="inline-flex min-h-10 items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
                    >
                        Back to free overview
                    </button>
                </div>
            </div>
        </section>
    );
}
