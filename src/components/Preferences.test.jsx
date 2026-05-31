import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Preferences from './Preferences';

const pushMocks = vi.hoisted(() => ({
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

    it('shows a notice when closed-app push is unavailable in local development', () => {
        pushMocks.getPushSupportState.mockReturnValue({ supported: false, reason: 'dev-server' });

        render(<Preferences preferences={{ systemNotificationsEnabled: false }} updatePreferences={vi.fn()} />);

        expect(screen.getByText('Closed-app reminders are unavailable in local development')).toBeInTheDocument();
        expect(screen.getByText('Use the preview or deployed app. The local Vite dev server disables the service worker.')).toBeInTheDocument();
    });
});
