import { lazy, Suspense } from 'react';
import { BILLING_FEATURES } from '@/config/billingFeatures';
import { useBilling } from '@/contexts/BillingContext';
import { ReportsShell } from '@/components/reports/ReportsShell';

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
    return (
        <ReportsShell
            resolution={resolution}
            onReadyChange={onReadyChange}
            renderAdvanced={() => <AdvancedReportsLoader onReadyChange={onReadyChange} />}
        />
    );
}

export default Reports;
