import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Account from './Account';

const accountLayoutMocks = vi.hoisted(() => ({
    isMobileLayout: false,
    isDriveConnected: false,
    activeSection: 'preferences',
    clearAllData: vi.fn(),
    forceSyncDrive: vi.fn(),
    disconnectDrive: vi.fn(),
    wipeDriveData: vi.fn(),
    signOut: vi.fn(),
    revokeAccess: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    updateUrl: vi.fn(),
    resetOnboardingCompleted: vi.fn(),
    queuePostReloadToast: vi.fn(),
}));

vi.mock('../hooks/useIsMobileLayout', () => ({
    default: () => accountLayoutMocks.isMobileLayout,
}));

vi.mock('../hooks/useUrlState.ts', () => ({
    useUrlState: () => ({
        urlParams: { section: accountLayoutMocks.activeSection },
        updateUrl: accountLayoutMocks.updateUrl,
    }),
}));

vi.mock('../hooks/useToast.ts', () => ({
    useToast: () => ({
        showSuccess: accountLayoutMocks.showSuccess,
        showError: accountLayoutMocks.showError,
    }),
}));

vi.mock('../contexts/YjsContext', () => ({
    useYjs: () => ({
        clearAllData: accountLayoutMocks.clearAllData,
        isDriveConnected: accountLayoutMocks.isDriveConnected,
        forceSyncDrive: accountLayoutMocks.forceSyncDrive,
        disconnectDrive: accountLayoutMocks.disconnectDrive,
        wipeDriveData: accountLayoutMocks.wipeDriveData,
    }),
}));

vi.mock('../hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        signOut: accountLayoutMocks.signOut,
        revokeAccess: accountLayoutMocks.revokeAccess,
    }),
}));

vi.mock('../utils/onboardingUtils.ts', () => ({
    resetOnboardingCompleted: accountLayoutMocks.resetOnboardingCompleted,
}));

vi.mock('../utils/postReloadToast.ts', () => ({
    queuePostReloadToast: accountLayoutMocks.queuePostReloadToast,
}));

vi.mock('../hooks/usePreferences.ts', () => ({
    usePreferences: () => ({
        preferences: {},
        updatePreferences: vi.fn(),
    }),
}));

vi.mock('./ExportImport', () => ({ default: () => <div data-testid="backup-content" /> }));
vi.mock('./Preferences', () => ({ default: () => <div data-testid="preferences-content" /> }));
vi.mock('./sync/YjsSyncSettings', () => ({ default: () => <div data-testid="sync-content" /> }));
vi.mock('./Modal', () => ({
    default: ({ isOpen, title, children, footer }) => isOpen ? (
        <div role="dialog" aria-label={title}>
            {children}
            {footer}
        </div>
    ) : null,
}));

const renderAccount = () => render(
    <Account
        projects={[]}
        tasks={[]}
        timeEntries={[]}
        invoices={[]}
        paymentMethods={[]}
        businessInfos={[]}
        clients={[]}
        invoiceTemplates={[]}
        expenses={[]}
        expenseRecurrences={[]}
        dailyGoals={[]}
        plannerAttachments={[]}
        onImport={vi.fn()}
    />
);

beforeEach(() => {
    accountLayoutMocks.isMobileLayout = false;
    accountLayoutMocks.isDriveConnected = false;
    accountLayoutMocks.activeSection = 'preferences';

    accountLayoutMocks.clearAllData.mockReset();
    accountLayoutMocks.forceSyncDrive.mockReset();
    accountLayoutMocks.disconnectDrive.mockReset();
    accountLayoutMocks.wipeDriveData.mockReset();
    accountLayoutMocks.signOut.mockReset();
    accountLayoutMocks.revokeAccess.mockReset();
    accountLayoutMocks.showSuccess.mockReset();
    accountLayoutMocks.showError.mockReset();
    accountLayoutMocks.updateUrl.mockReset();
    accountLayoutMocks.resetOnboardingCompleted.mockReset();
    accountLayoutMocks.queuePostReloadToast.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Account', () => {
    it('renders a persistent footer with privacy and terms links', () => {
        renderAccount();

        const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
        const termsLink = screen.getByRole('link', { name: 'Terms & Conditions' });

        expect(privacyLink.getAttribute('href')).toBe('/privacy');
        expect(termsLink.getAttribute('href')).toBe('/terms');
        expect(privacyLink.getAttribute('target')).toBe('_blank');
        expect(termsLink.getAttribute('target')).toBe('_blank');
    });

    it('keeps the desktop subtitle visible', () => {
        accountLayoutMocks.isDriveConnected = true;

        renderAccount();

        expect(screen.getByText('Manage your account settings')).toBeInTheDocument();
    });

    it('hides the subtitle and keeps sign out inline on mobile', () => {
        accountLayoutMocks.isMobileLayout = true;
        accountLayoutMocks.isDriveConnected = true;

        renderAccount();

        expect(screen.queryByText('Manage your account settings')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign out' }).className.includes('shrink-0')).toBe(true);
    });

    it('revokes the Drive session before clearing data when connected', async () => {
        accountLayoutMocks.isDriveConnected = true;
        accountLayoutMocks.activeSection = 'data';

        accountLayoutMocks.wipeDriveData.mockResolvedValue(undefined);
        accountLayoutMocks.revokeAccess.mockResolvedValue(undefined);
        accountLayoutMocks.clearAllData.mockResolvedValue(undefined);

        renderAccount();

        fireEvent.click(screen.getByRole('button', { name: 'Delete All Account Data' }));
        fireEvent.change(screen.getByLabelText(/delete all data/i), {
            target: { value: 'delete all data' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));

        await waitFor(() => {
            expect(accountLayoutMocks.wipeDriveData).toHaveBeenCalledTimes(1);
            expect(accountLayoutMocks.revokeAccess).toHaveBeenCalledTimes(1);
            expect(accountLayoutMocks.clearAllData).toHaveBeenCalledTimes(1);
        });

        expect(accountLayoutMocks.wipeDriveData.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.revokeAccess.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.revokeAccess.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.clearAllData.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.resetOnboardingCompleted).toHaveBeenCalledTimes(1);
        expect(accountLayoutMocks.queuePostReloadToast).toHaveBeenCalledWith({
            level: 'success',
            message: 'All data was deleted and Google Drive was disconnected',
        });
        expect(accountLayoutMocks.showSuccess).not.toHaveBeenCalled();
    });
});