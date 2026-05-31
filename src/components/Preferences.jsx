import { useState } from 'react';
import { useToast } from '../hooks/useToast.ts';
import { DEFAULT_CURRENCY } from '../utils/currencyUtils.ts';
import {
    getPushSupportState,
    savePushSubscription,
    subscribeToTaskTimePush,
    unsubscribeFromTaskTimePush,
} from '@/utils/pushNotificationClient';
import CurrencySelect from '@/components/ui/currency-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import CustomCheckbox from './CustomCheckbox';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';

/**
 * Preferences component - Manages user preferences including preferred currency
 */
const Preferences = ({ preferences = {}, updatePreferences }) => {
    const isMobileLayout = useIsMobileLayout();
    const [preferredCurrency, setPreferredCurrency] = useState(preferences.currency || DEFAULT_CURRENCY);
    const [isSavingNotificationDevice, setIsSavingNotificationDevice] = useState(false);
    const { showSuccess, showError } = useToast();
    const weekStartsOnSunday = (preferences.weekStartsOn ?? 1) === 0;
    const autoHideTotalsOnRevisit = preferences.autoHideTotalsOnRevisit === true;
    const systemNotificationsEnabled = preferences.systemNotificationsEnabled === true;
    const pushSupport = getPushSupportState();

    // Save preferred currency to preferences state
    const handleCurrencyChange = (newCurrency) => {
        setPreferredCurrency(newCurrency);
        
        // Update preferences state
        if (updatePreferences) {
            updatePreferences({ currency: newCurrency });
        }
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('preferenceChanged', {
            detail: { currency: newCurrency }
        }));
        
        showSuccess('Preferred currency updated successfully!');
    };

    const handleWeekStartToggle = (checked) => {
        if (updatePreferences) {
            updatePreferences({ weekStartsOn: checked ? 0 : 1 });
        }
        showSuccess('Week start preference updated!');
    };

    const handleAutoHideTotalsToggle = (checked) => {
        if (updatePreferences) {
            updatePreferences({ autoHideTotalsOnRevisit: checked });
        }
        showSuccess('Totals visibility preference updated!');
    };

    const handleSystemNotificationsToggle = async (checked) => {
        if (updatePreferences) {
            updatePreferences({ systemNotificationsEnabled: checked });
        }

        if (!checked) {
            try {
                await unsubscribeFromTaskTimePush();
            } catch {
                // Local preference still wins; schedule cleanup will retry when possible.
            }
        }

        showSuccess('Reminder preference updated!');
    };

    const handleEnableNotificationDevice = async () => {
        const support = getPushSupportState();
        if (!support.supported) {
            showError('System reminders are not supported on this device or app origin.');
            return;
        }

        setIsSavingNotificationDevice(true);

        try {
            const subscription = await subscribeToTaskTimePush();
            await savePushSubscription(subscription);
            if (updatePreferences) {
                updatePreferences({ systemNotificationsEnabled: true });
            }
            showSuccess('System reminders enabled on this device');
        } catch (error) {
            showError(error?.message || 'Unable to enable system reminders on this device');
        } finally {
            setIsSavingNotificationDevice(false);
        }
    };

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Preferences</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage your personal preferences and default settings.
                </p>
            </div>

            <Card>
                <CardHeader className={cn(isMobileLayout && 'px-3 pb-2 pt-3')}>
                    <CardTitle>Currency Settings</CardTitle>
                </CardHeader>
                <CardContent className={cn(isMobileLayout && 'px-3 pb-3 pt-0')}>
                    <div className="max-w-sm space-y-2">
                        <Label htmlFor="preferredCurrency">
                            Preferred Currency
                        </Label>
                        <CurrencySelect
                            id="preferredCurrency"
                            value={preferredCurrency}
                            onValueChange={handleCurrencyChange}
                        />
                        <p className="text-sm text-muted-foreground">
                            This currency will be used as the default for new projects and in dashboard metrics.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className={cn('mt-6', isMobileLayout && 'mt-4')}>
                <CardHeader className={cn(isMobileLayout && 'px-3 pb-2 pt-3')}>
                    <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent className={cn(isMobileLayout && 'px-3 pb-3 pt-0')}>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <CustomCheckbox
                                checked={weekStartsOnSunday}
                                onChange={handleWeekStartToggle}
                                label="Sunday as first day of the week"
                            />
                            <p className="text-sm text-muted-foreground">
                                Changes the planner week layout and week calculations.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <CustomCheckbox
                                checked={autoHideTotalsOnRevisit}
                                onChange={handleAutoHideTotalsToggle}
                                label="Always auto-hide totals when returning to TaskTime"
                            />
                            <p className="text-sm text-muted-foreground">
                                Totals will hide again whenever you revisit the tab.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <CustomCheckbox
                                checked={systemNotificationsEnabled}
                                onChange={handleSystemNotificationsToggle}
                                label="System reminders"
                            />
                            <p className="text-sm text-muted-foreground">
                                Receive generic system reminders for due tasks & expenses.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleEnableNotificationDevice}
                                disabled={!systemNotificationsEnabled || isSavingNotificationDevice || !pushSupport.supported}
                            >
                                {isSavingNotificationDevice ? 'Enabling...' : 'Enable reminders on this device'}
                            </Button>
                            {!pushSupport.supported && (
                                <p className="text-sm text-muted-foreground">
                                    {pushSupport.reason === 'dev-server'
                                        ? 'Closed-app reminders require the preview or deployed app. The local Vite dev server disables the service worker.'
                                        : 'Closed-app reminders are not supported on this device or app origin.'}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Preferences;
