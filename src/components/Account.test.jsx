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
    deleteAllBackups: vi.fn(),
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
        deleteAllBackups: accountLayoutMocks.deleteAllBackups,
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
vi.mock('./agent/AgentBridgeSettings', () => ({
    default: () => (
        <div>
            <h2>Agent Access</h2>
            <div>Local Agent Bridge</div>
        </div>
    ),
}));
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
    accountLayoutMocks.deleteAllBackups.mockReset();
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
    it('renders persistent GitHub, privacy, and terms links', () => {
        renderAccount();

        const githubLink = screen.getByRole('link', { name: 'TaskTime Pro on GitHub' });
        const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
        const termsLink = screen.getByRole('link', { name: 'Terms & Conditions' });

        expect(githubLink.getAttribute('href')).toBe('https://github.com/tasktimepro/tasktime');
        expect(githubLink.getAttribute('target')).toBe('_blank');
        expect(privacyLink.getAttribute('href')).toBe('/privacy/');
        expect(termsLink.getAttribute('href')).toBe('/terms/');
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

    it('merges backup and restore into the your data tab above deletion', () => {
        accountLayoutMocks.activeSection = 'data';

        renderAccount();

        expect(screen.queryByRole('tab', { name: 'Backup & Restore' })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Your Data' })).toBeInTheDocument();
        expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
        expect(screen.getByTestId('backup-content')).toBeInTheDocument();

        const backupHeading = screen.getByText('Backup & Restore');
        const deleteButton = screen.getByRole('button', { name: 'Delete All Account Data' });

        expect(backupHeading.compareDocumentPosition(deleteButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows agent access as an account section', () => {
        accountLayoutMocks.activeSection = 'agent';

        renderAccount();

        expect(screen.getByRole('tab', { name: 'Agent Access' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Agent Access' })).toBeInTheDocument();
        expect(screen.getByText('Local Agent Bridge')).toBeInTheDocument();
    });

    it('redirects the removed backup tab to your data', () => {
        accountLayoutMocks.activeSection = 'backup';

        renderAccount();

        expect(accountLayoutMocks.updateUrl).toHaveBeenCalledWith({ section: 'data' });
        expect(screen.getByRole('heading', { name: 'Your Data' })).toBeInTheDocument();
        expect(screen.getByTestId('backup-content')).toBeInTheDocument();
    });

    it('revokes the Drive session before clearing data when connected', async () => {
        accountLayoutMocks.isDriveConnected = true;
        accountLayoutMocks.activeSection = 'data';

        accountLayoutMocks.wipeDriveData.mockResolvedValue(undefined);
        accountLayoutMocks.deleteAllBackups.mockResolvedValue(undefined);
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
            expect(accountLayoutMocks.deleteAllBackups).toHaveBeenCalledTimes(1);
            expect(accountLayoutMocks.revokeAccess).toHaveBeenCalledTimes(1);
            expect(accountLayoutMocks.clearAllData).toHaveBeenCalledTimes(1);
        });

        expect(accountLayoutMocks.wipeDriveData.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.deleteAllBackups.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.deleteAllBackups.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.revokeAccess.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.revokeAccess.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.clearAllData.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.resetOnboardingCompleted).toHaveBeenCalledTimes(1);
        expect(accountLayoutMocks.queuePostReloadToast).toHaveBeenCalledWith({
            level: 'success',
            message: 'All data was deleted and Google Drive was disconnected',
        });
        expect(accountLayoutMocks.showSuccess).not.toHaveBeenCalled();
    });
});
