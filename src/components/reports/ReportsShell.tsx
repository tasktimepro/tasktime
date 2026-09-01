import { useEffect } from 'react';
import { ChartBarIcon, ClockIcon, DocumentTextIcon, HandCoinsIcon, ReceiptTextIcon, SheetIcon } from '@/components/ui/icons';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUrlState } from '@/hooks/useUrlState';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';
import type { EntitlementResolution } from '@/domain/entitlements/entitlementTypes';
import { evaluateEntitlementFeature } from '@/domain/entitlements/entitlementPolicy';
import { cn } from '@/lib/utils';
import { ReportsOverview } from './ReportsOverview';
import { ReportsProPreview } from '@/components/billing/ReportsProPreview';

export const REPORT_SECTIONS = [
    { value: 'overview', label: 'Overview', icon: ChartBarIcon },
    { value: 'monthly', label: 'Monthly', icon: ReceiptTextIcon },
    { value: 'statement', label: 'Statement', icon: ReceiptTextIcon },
    { value: 'work-summary', label: 'Work Summary', icon: ReceiptTextIcon },
    { value: 'tax', label: 'Tax', icon: SheetIcon },
    { value: 'invoices', label: 'Invoices', icon: DocumentTextIcon },
    { value: 'outstanding', label: 'Outstanding', icon: DocumentTextIcon },
    { value: 'expenses', label: 'Expenses', icon: HandCoinsIcon },
    { value: 'hours', label: 'Hours', icon: ClockIcon },
    { value: 'to-invoice', label: 'To Invoice', icon: DocumentTextIcon },
] as const;

const ALLOWED = new Set(REPORT_SECTIONS.map(section => section.value));

export function ReportsShell({
    resolution,
    onReadyChange,
    renderAdvanced,
}: {
    resolution: EntitlementResolution;
    onReadyChange?: ((ready: boolean) => void) | null;
    renderAdvanced: () => React.ReactNode;
}) {
    const { urlParams, updateUrl } = useUrlState();
    const isMobileLayout = useIsMobileLayout();
    const requested = urlParams.section ?? 'overview';
    const activeSection = ALLOWED.has(requested as typeof REPORT_SECTIONS[number]['value'])
        ? requested
        : 'overview';
    useEffect(() => {
        if (urlParams.section !== activeSection) {
            updateUrl({ section: activeSection, create: null, tab: null });
        }
    }, [activeSection, updateUrl, urlParams.section]);
    const access = evaluateEntitlementFeature(resolution, 'reports.access');

    if (access.allowed) {
        return renderAdvanced();
    }

    const advanced = activeSection !== 'overview';
    return (
        <div className="space-y-6">
            <Tabs value={activeSection} onValueChange={(section: string) => updateUrl({ section, create: null, tab: null })}>
                <div className={cn(
                    'overflow-x-auto pb-1 scrollbar-hide',
                    isMobileLayout ? '-mx-4 px-4' : ''
                )}>
                    <TabsList className={cn(
                        'bg-transparent rounded-none w-max min-w-full flex-nowrap',
                        isMobileLayout
                            ? 'h-auto justify-start gap-2 border-0 p-0'
                            : 'h-auto justify-start border-b border-border p-0'
                    )}>
                        {REPORT_SECTIONS.map(section => {
                            const Icon = section.icon;

                            return (
                                <TabsTrigger
                                    key={section.value}
                                    value={section.value}
                                    className={cn(
                                        'flex items-center font-medium text-sm whitespace-nowrap transition-colors',
                                        isMobileLayout
                                            ? 'shrink-0 rounded-full border border-border bg-transparent px-3 py-1.5 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none'
                                            : 'shrink-0 mr-8 border-b-2 border-transparent rounded-none bg-transparent px-1 py-2 text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none hover:text-foreground hover:border-border'
                                    )}
                                >
                                    <Icon className="mr-2 h-4 w-4" />
                                    {section.label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>
            </Tabs>
            <div>
                <h1 className="text-2xl font-bold text-foreground">Reports</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Review the current month or open an advanced Pro report.
                </p>
            </div>
            {!advanced ? <ReportsOverview onReadyChange={onReadyChange} /> : null}
            {advanced ? (
                <ReportsProPreview
                    section={activeSection}
                    resolution={resolution}
                    onReadyChange={onReadyChange}
                    onOpenBilling={() => updateUrl({ view: 'account', section: 'billing', create: null, tab: null })}
                    onBackToOverview={() => updateUrl({ section: 'overview', create: null, tab: null })}
                />
            ) : null}
        </div>
    );
}
