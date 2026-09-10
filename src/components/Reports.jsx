import { lazy, Suspense } from 'react';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { useBilling } from '@/contexts/BillingContext';
import { ReportsShell } from '@/components/reports/ReportsShell';
import { evaluateGetProAction } from '@/domain/entitlements/entitlementPolicy';

const AdvancedReportsWorkspace = lazy(() => import('@/components/reports/AdvancedReportsWorkspace'));

function AdvancedReportsLoader({ onReadyChange = null }) {
    return (
        <Suspense fallback={null}>
            <AdvancedReportsWorkspace onReadyChange={onReadyChange} />
        </Suspense>
    );
}

function Reports({
    onReadyChange = null,
    enforcementEnabled = BILLING_FEATURES.advancedReportsEnforcement,
    entitlementResolution = null,
}) {
    const billing = useBilling();
    const resolution = entitlementResolution ?? billing.resolution;
    if (!enforcementEnabled) {
        return <AdvancedReportsLoader onReadyChange={onReadyChange} />;
    }
    const proPlan = billing.catalog?.plans.find(plan => plan.plan === 'pro') ?? null;
    const getProAction = evaluateGetProAction({
        entitlementState: billing.entitlementState,
        hasCanonicalStatus: Boolean(billing.status),
        hasCheckoutOffer: Boolean(billing.status?.actions.checkoutOffer),
        catalogPurchaseEnabled: billing.catalog?.purchaseEnabled === true,
        proOfferCount: proPlan?.offers.length ?? 0,
        isPermanentComplimentaryPro: resolution.kind === 'canonical'
            && resolution.snapshot.source === 'grant'
            && resolution.snapshot.sourceExpiresAt === null,
    });
    return (
        <ReportsShell
            resolution={resolution}
            entitlementState={billing.entitlementState}
            showGetPro={getProAction.visible}
            onReadyChange={onReadyChange}
            renderAdvanced={() => <AdvancedReportsLoader onReadyChange={onReadyChange} />}
        />
    );
}

export default Reports;
