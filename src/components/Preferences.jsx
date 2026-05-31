import { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast.ts';
import { DEFAULT_CURRENCY } from '../utils/currencyUtils.ts';
import {
    getCurrentPushSubscription,
    getNotificationPermissionFailureMessage,
    getPushSupportState,
    savePushSubscription,
    subscribeToTaskTimePush,
    unsubscribeFromTaskTimePush,
} from '@/utils/pushNotificationClient';
import CurrencySelect from '@/components/ui/currency-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import CustomCheckbox from './CustomCheckbox';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';

const getBrowserNotificationPermission = () => {
    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
        return 'unsupported';
    }

    return window.Notification.permission || 'default';
};

const getBrowserPermissionLabel = (permission) => {
    switch (permission) {
        case 'granted':
            return 'Allowed';
        case 'denied':
            return 'Blocked';
        case 'unsupported':
            return 'Unsupported';
        default:
            return 'Ask';
    }
};

const getDevicePushLabel = (state) => {
    switch (state) {
        case 'not-subscribed':
            return 'Not subscribed. Turn reminders off and on again to reconnect this device.';
        case 'checking':
            return 'Checking subscription status.';
        case 'error':
            return 'Unable to check this device. Reload and try again.';
        default:
            return 'Unavailable. Closed-app reminders are not available here.';
    }
};

/**
 * Preferences component - Manages user preferences including preferred currency
 */
const Preferences = ({ preferences = {}, updatePreferences }) => {
    const isMobileLayout = useIsMobileLayout();
    const [preferredCurrency, setPreferredCurrency] = useState(preferences.currency || DEFAULT_CURRENCY);
    const [isSavingNotificationDevice, setIsSavingNotificationDevice] = useState(false);
    const [browserNotificationPermission, setBrowserNotificationPermission] = useState(getBrowserNotificationPermission);
    const [devicePushState, setDevicePushState] = useState('checking');
    const [notificationIssueMessage, setNotificationIssueMessage] = useState(null);
    const { showSuccess, showError } = useToast();
    const weekStartsOnSunday = (preferences.weekStartsOn ?? 1) === 0;
    const autoHideTotalsOnRevisit = preferences.autoHideTotalsOnRevisit === true;
    const systemNotificationsEnabled = preferences.systemNotificationsEnabled === true;
    const pushSupport = getPushSupportState();

    useEffect(() => {
        setBrowserNotificationPermission(getBrowserNotificationPermission());

        if (!getPushSupportState().supported) {
            setDevicePushState('unsupported');
            return undefined;
        }

        let canceled = false;
        setDevicePushState('checking');

        getCurrentPushSubscription()
            .then((subscription) => {
                if (!canceled) {
                    setDevicePushState(subscription ? 'subscribed' : 'not-subscribed');
                }
            })
            .catch(() => {
                if (!canceled) {
                    setDevicePushState('error');
                }
            });

        return () => {
            canceled = true;
        };
    }, [isSavingNotificationDevice, systemNotificationsEnabled]);

    useEffect(() => {
        if (
            typeof navigator === 'undefined'
            || !navigator.permissions
            || typeof navigator.permissions.query !== 'function'
        ) {
            return undefined;
        }

        let permissionStatus;
        let handleChange;
        let canceled = false;

        navigator.permissions.query({ name: 'notifications' })
            .then((status) => {
                if (canceled) {
                    return;
                }

                permissionStatus = status;
                setBrowserNotificationPermission(getBrowserNotificationPermission());

                handleChange = () => {
                    setBrowserNotificationPermission(getBrowserNotificationPermission());
                };

                status.addEventListener?.('change', handleChange);
                status.onchange = handleChange;
            })
            .catch(() => {
                setBrowserNotificationPermission(getBrowserNotificationPermission());
            });

        return () => {
            canceled = true;
            if (permissionStatus) {
                if (handleChange) {
                    permissionStatus.removeEventListener?.('change', handleChange);
                }
                permissionStatus.onchange = null;
            }
        };
    }, []);

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

    const getCurrentNotificationIssueMessage = () => {
        if (isSavingNotificationDevice) {
            return 'Browser: Waiting for permission.';
        }

        if (notificationIssueMessage) {
            if (browserNotificationPermission !== 'granted') {
                return `Browser: ${getBrowserPermissionLabel(browserNotificationPermission)}. ${notificationIssueMessage}`;
            }

            return `Device: ${notificationIssueMessage}`;
        }

        if (systemNotificationsEnabled && !pushSupport.supported) {
            return `Device: ${getDevicePushLabel('unsupported')}`;
        }

        if (
            systemNotificationsEnabled
            && pushSupport.supported
            && devicePushState !== 'subscribed'
            && devicePushState !== 'checking'
        ) {
            return `Device: ${getDevicePushLabel(devicePushState)}`;
        }

        return null;
    };

    const requestNotificationPermission = async () => {
        if (typeof window === 'undefined' || typeof window.Notification === 'undefined') {
            throw new Error('System reminders are not supported on this device or app origin.');
        }

        if (window.Notification.permission === 'granted') {
            setBrowserNotificationPermission('granted');
            return;
        }

        const permission = await window.Notification.requestPermission();
        setBrowserNotificationPermission(permission);

        if (permission !== 'granted') {
            throw new Error(getNotificationPermissionFailureMessage(permission));
        }
    };

    const enableSystemNotifications = async () => {
        const support = getPushSupportState();

        setIsSavingNotificationDevice(true);
        setNotificationIssueMessage(null);

        try {
            if (support.supported) {
                const subscription = await subscribeToTaskTimePush();
                await savePushSubscription(subscription);
                setDevicePushState('subscribed');
            } else {
                await requestNotificationPermission();
                setDevicePushState('unsupported');
            }

            if (updatePreferences) {
                updatePreferences({ systemNotificationsEnabled: true });
            }

            setBrowserNotificationPermission(getBrowserNotificationPermission());
            setNotificationIssueMessage(null);
            showSuccess('System reminders enabled on this device');
        } catch (error) {
            const message = error?.message || 'Unable to enable system reminders on this device';
            setBrowserNotificationPermission(getBrowserNotificationPermission());
            setNotificationIssueMessage(message);
            showError(message);
        } finally {
            setIsSavingNotificationDevice(false);
        }
    };

    const handleSystemNotificationsToggle = async (checked) => {
        if (checked) {
            await enableSystemNotifications();
            return;
        }

        if (updatePreferences) {
            updatePreferences({ systemNotificationsEnabled: false });
        }

        try {
            await unsubscribeFromTaskTimePush();
            setDevicePushState('not-subscribed');
        } catch {
            // Local preference still wins; schedule cleanup will retry when possible.
        }

        setNotificationIssueMessage(null);
        showSuccess('Reminder preference updated!');
    };

    const notificationIssue = getCurrentNotificationIssueMessage();

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
                                disabled={isSavingNotificationDevice}
                                label="System reminders"
                            />
                            <p className="text-sm text-muted-foreground">
                                Receive generic system reminders for due tasks & expenses.
                            </p>
                            {notificationIssue && (
                                <Notice
                                    compact
                                    title={notificationIssue}
                                />
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Preferences;
