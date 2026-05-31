import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Preferences from './Preferences';

const pushMocks = vi.hoisted(() => ({
    getCurrentPushSubscription: vi.fn(),
    getNotificationPermissionFailureMessage: vi.fn(),
    getPushSupportState: vi.fn(),
    savePushSubscription: vi.fn(),
    subscribeToTaskTimePush: vi.fn(),
    unsubscribeFromTaskTimePush: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
}));

vi.mock('@/utils/pushNotificationClient', () => pushMocks);

vi.mock('../hooks/useToast.ts', () => ({
    useToast: () => toastMocks,
}));

vi.mock('../hooks/useIsMobileLayout', () => ({
    default: () => false,
}));

vi.mock('@/components/ui/currency-select', () => ({
    default: ({ value, onValueChange }) => (
        <select
            aria-label="Preferred Currency"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
        >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
        </select>
    ),
}));

describe('Preferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pushMocks.getCurrentPushSubscription.mockResolvedValue(null);
        pushMocks.getNotificationPermissionFailureMessage.mockImplementation((permission) => (
            permission === 'denied'
                ? 'Allow notifications in site settings and try again.'
                : 'Check the address bar permission prompt or allow notifications in site settings.'
        ));
        pushMocks.getPushSupportState.mockReturnValue({ supported: true });
        pushMocks.subscribeToTaskTimePush.mockResolvedValue({
            endpoint: 'https://push.example.test/subscription',
            toJSON: () => ({ endpoint: 'https://push.example.test/subscription' }),
        });
        pushMocks.savePushSubscription.mockResolvedValue(undefined);
        pushMocks.unsubscribeFromTaskTimePush.mockResolvedValue(undefined);
    });

    it('enables this device when the system reminders checkbox is checked', async () => {
        const updatePreferences = vi.fn();
        const user = userEvent.setup();

        render(<Preferences preferences={{ systemNotificationsEnabled: false }} updatePreferences={updatePreferences} />);

        expect(screen.queryByRole('button', { name: 'Enable reminders on this device' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: 'System reminders' }));

        await waitFor(() => {
            expect(pushMocks.subscribeToTaskTimePush).toHaveBeenCalledTimes(1);
            expect(pushMocks.savePushSubscription).toHaveBeenCalledTimes(1);
            expect(updatePreferences).toHaveBeenCalledWith({ systemNotificationsEnabled: true });
        });
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('System reminders enabled on this device');
    });

    it('does not enable the preference when device enablement fails', async () => {
        const updatePreferences = vi.fn();
        const user = userEvent.setup();
        pushMocks.subscribeToTaskTimePush.mockRejectedValue(new Error('Notification permission was not granted'));

        render(<Preferences preferences={{ systemNotificationsEnabled: false }} updatePreferences={updatePreferences} />);

        await user.click(screen.getByRole('checkbox', { name: 'System reminders' }));

        await waitFor(() => {
            expect(toastMocks.showError).toHaveBeenCalledWith('Notification permission was not granted');
        });
        expect(updatePreferences).not.toHaveBeenCalledWith({ systemNotificationsEnabled: true });
    });

    it('disables reminders and removes the current subscription when unchecked', async () => {
        const updatePreferences = vi.fn();
        const user = userEvent.setup();

        render(<Preferences preferences={{ systemNotificationsEnabled: true }} updatePreferences={updatePreferences} />);

        await user.click(screen.getByRole('checkbox', { name: 'System reminders' }));

        await waitFor(() => {
            expect(pushMocks.unsubscribeFromTaskTimePush).toHaveBeenCalledTimes(1);
            expect(updatePreferences).toHaveBeenCalledWith({ systemNotificationsEnabled: false });
        });
        expect(toastMocks.showSuccess).toHaveBeenCalledWith('Reminder preference updated!');
    });

    it('falls back to browser notification permission when closed-app push is unsupported', async () => {
        const updatePreferences = vi.fn();
        const requestPermission = vi.fn().mockResolvedValue('granted');
        const user = userEvent.setup();
        pushMocks.getPushSupportState.mockReturnValue({ supported: false, reason: 'dev-server' });
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: {
                permission: 'default',
                requestPermission,
            },
        });

        render(<Preferences preferences={{ systemNotificationsEnabled: false }} updatePreferences={updatePreferences} />);

        await user.click(screen.getByRole('checkbox', { name: 'System reminders' }));

        await waitFor(() => {
            expect(requestPermission).toHaveBeenCalledTimes(1);
            expect(updatePreferences).toHaveBeenCalledWith({ systemNotificationsEnabled: true });
        });
        expect(pushMocks.subscribeToTaskTimePush).not.toHaveBeenCalled();
    });

    it('keeps the notification section quiet when reminders are off and closed-app push is unavailable', () => {
        pushMocks.getPushSupportState.mockReturnValue({ supported: false, reason: 'dev-server' });

        render(<Preferences preferences={{ systemNotificationsEnabled: false }} updatePreferences={vi.fn()} />);

        expect(screen.queryByText(/^Device:/)).not.toBeInTheDocument();
    });

    it('shows a simple device issue when enabled reminders cannot use closed-app push', () => {
        pushMocks.getPushSupportState.mockReturnValue({ supported: false, reason: 'dev-server' });

        render(<Preferences preferences={{ systemNotificationsEnabled: true }} updatePreferences={vi.fn()} />);

        expect(screen.getByText('Device: Unavailable. Closed-app reminders are not available here.')).toBeInTheDocument();
    });

    it('shows a simple browser issue when permission is not granted', async () => {
        const updatePreferences = vi.fn();
        const user = userEvent.setup();
        pushMocks.subscribeToTaskTimePush.mockRejectedValue(new Error('Check the address bar permission prompt or allow notifications in site settings.'));
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: {
                permission: 'default',
                requestPermission: vi.fn().mockResolvedValue('default'),
            },
        });

        render(<Preferences preferences={{ systemNotificationsEnabled: false }} updatePreferences={updatePreferences} />);

        await user.click(screen.getByRole('checkbox', { name: 'System reminders' }));

        expect(await screen.findByText('Browser: Ask. Check the address bar permission prompt or allow notifications in site settings.')).toBeInTheDocument();
    });
});
