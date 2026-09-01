import { FlaskConical } from 'lucide-react';
import { BILLING_FEATURES } from '@/config/billingFeatures';

/**
 * Persistent local-only warning for the real Stripe test-mode billing flow.
 * The guarded mode is accepted only by a Vite development build on loopback.
 */
export function LocalBillingSandboxBanner() {
    if (!BILLING_FEATURES.sandbox) return null;

    return (
        <div
            className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-foreground"
        >
            <div role="status" className="flex min-w-0 items-start gap-3">
                <FlaskConical aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold">Stripe sandbox</p>
                    <p className="text-xs text-muted-foreground">
                        Real Stripe test-mode purchases and local billing data only. Never use a real card or customer identity.
                        Production billing remains disabled.
                    </p>
                </div>
            </div>
        </div>
    );
}
