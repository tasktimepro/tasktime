import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Account from './Account';

const accountLayoutMocks = vi.hoisted(() => ({
    isMobileLayout: false,
    isDriveConnected: false,
    isCloudConnected: false,
    isOffline: false,
    isCloudIdentityLoading: false,
    isConnecting: false,
    hostedServiceSessionId: null,
    pendingChanges: false,
    syncState: 'idle',
    activeStorageProvider: null,
    googleUser: null,
    dropboxAccountEmail: null,
    dropboxSessionId: null,
    dropboxSignedIn: false,
    dropboxError: null,
    activeSection: 'preferences',
    clearAllData: vi.fn(),
    forceSyncDrive: vi.fn(),
    forceSyncCloud: vi.fn(),
    disconnectDrive: vi.fn(),
    disconnectActiveCloudSession: vi.fn(),
    wipeDriveData: vi.fn(),
    wipeCloudData: vi.fn(),
    deleteAllBackups: vi.fn(),
    signIn: vi.fn(),
    signInDropbox: vi.fn(),
    refreshDropbox: vi.fn(),
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
        isCloudConnected: accountLayoutMocks.isCloudConnected,
        isCloudIdentityLoading: accountLayoutMocks.isCloudIdentityLoading,
        isConnecting: accountLayoutMocks.isConnecting,
        hostedServiceSessionId: accountLayoutMocks.hostedServiceSessionId,
        store: {
            isCloudConnected: () => accountLayoutMocks.isCloudConnected,
            getSyncState: () => accountLayoutMocks.syncState,
            hasPendingSyncChanges: () => accountLayoutMocks.pendingChanges,
        },
        syncState: accountLayoutMocks.syncState,
        activeStorageProvider: accountLayoutMocks.activeStorageProvider,
        forceSyncDrive: accountLayoutMocks.forceSyncDrive,
        forceSyncCloud: accountLayoutMocks.forceSyncCloud,
        disconnectDrive: accountLayoutMocks.disconnectDrive,
        disconnectActiveCloudSession: accountLayoutMocks.disconnectActiveCloudSession,
        wipeDriveData: accountLayoutMocks.wipeDriveData,
        wipeCloudData: accountLayoutMocks.wipeCloudData,
        deleteAllBackups: accountLayoutMocks.deleteAllBackups,
    }),
}));

vi.mock('../hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        user: accountLayoutMocks.googleUser,
        signIn: accountLayoutMocks.signIn,
        signOut: accountLayoutMocks.signOut,
        revokeAccess: accountLayoutMocks.revokeAccess,
    }),
}));

vi.mock('../hooks/useDropboxAuth.ts', () => ({
    useDropboxAuth: () => ({
        accountEmail: accountLayoutMocks.dropboxAccountEmail,
        sessionId: accountLayoutMocks.dropboxSessionId,
        isSignedIn: accountLayoutMocks.dropboxSignedIn,
        error: accountLayoutMocks.dropboxError,
        signIn: accountLayoutMocks.signInDropbox,
        refresh: accountLayoutMocks.refreshDropbox,
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

vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: { ui: true },
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
vi.mock('./billing/BillingPanel', () => ({
    BillingPanel: ({ connectedAccountEmail }) => (
        <div data-testid="billing-account-email">{connectedAccountEmail ?? 'no-email'}</div>
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
    accountLayoutMocks.isCloudConnected = false;
    accountLayoutMocks.isOffline = false;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => !accountLayoutMocks.isOffline);
    accountLayoutMocks.isCloudIdentityLoading = false;
    accountLayoutMocks.isConnecting = false;
    accountLayoutMocks.hostedServiceSessionId = null;
    accountLayoutMocks.pendingChanges = false;
    accountLayoutMocks.syncState = 'idle';
    accountLayoutMocks.activeStorageProvider = null;
    accountLayoutMocks.googleUser = null;
    accountLayoutMocks.dropboxAccountEmail = null;
    accountLayoutMocks.dropboxSessionId = null;
    accountLayoutMocks.dropboxSignedIn = false;
    accountLayoutMocks.dropboxError = null;
    accountLayoutMocks.activeSection = 'preferences';

    accountLayoutMocks.clearAllData.mockReset();
    accountLayoutMocks.forceSyncDrive.mockReset();
    accountLayoutMocks.forceSyncCloud.mockReset();
    accountLayoutMocks.disconnectDrive.mockReset();
    accountLayoutMocks.disconnectActiveCloudSession.mockReset();
    accountLayoutMocks.wipeDriveData.mockReset();
    accountLayoutMocks.wipeCloudData.mockReset();
    accountLayoutMocks.deleteAllBackups.mockReset();
    accountLayoutMocks.signIn.mockReset();
    accountLayoutMocks.signInDropbox.mockReset();
    accountLayoutMocks.refreshDropbox.mockReset();
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

        const xLink = screen.getByRole('link', { name: 'TaskTime Pro on X' });
        const githubLink = screen.getByRole('link', { name: 'TaskTime Pro on GitHub' });
        const privacyLink = screen.getByRole('link', { name: 'Privacy' });
        const termsLink = screen.getByRole('link', { name: 'Terms' });

        expect(githubLink.getAttribute('href')).toBe('https://github.com/tasktimepro/tasktime');
        expect(githubLink.getAttribute('target')).toBe('_blank');
        expect(xLink).toHaveClass('text-muted-foreground');
        expect(githubLink).toHaveClass('text-foreground');
        expect(xLink).not.toHaveClass('hover:text-primary');
        expect(githubLink).not.toHaveClass('hover:text-primary');
        expect(privacyLink).toHaveClass('text-muted-foreground', 'hover:text-foreground');
        expect(privacyLink).not.toHaveClass('underline');
        expect(privacyLink.getAttribute('href')).toBe('https://tasktime.pro/privacy/');
        expect(termsLink.getAttribute('href')).toBe('https://tasktime.pro/terms/');
        expect(privacyLink.getAttribute('target')).toBe('_blank');
        expect(termsLink.getAttribute('target')).toBe('_blank');
    });

    it('keeps the desktop subtitle visible', () => {
        accountLayoutMocks.isCloudConnected = true;
        accountLayoutMocks.hostedServiceSessionId = 'active-session';
        accountLayoutMocks.activeStorageProvider = 'dropbox';

        renderAccount();

        expect(screen.getByText('Manage your account settings')).toBeInTheDocument();
    });

    it('hides the subtitle and keeps sign out inline on mobile', () => {
        accountLayoutMocks.isMobileLayout = true;
        accountLayoutMocks.isCloudConnected = true;
        accountLayoutMocks.hostedServiceSessionId = 'active-session';
        accountLayoutMocks.activeStorageProvider = 'dropbox';

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

    it('passes the active provider email to Plan & Billing', () => {
        accountLayoutMocks.activeSection = 'billing';
        accountLayoutMocks.activeStorageProvider = 'dropbox';
        accountLayoutMocks.dropboxAccountEmail = 'owner@example.com';

        renderAccount();

        expect(screen.getByTestId('billing-account-email')).toHaveTextContent('owner@example.com');
    });

    it('redirects the removed backup tab to your data', () => {
        accountLayoutMocks.activeSection = 'backup';

        renderAccount();

        expect(accountLayoutMocks.updateUrl).toHaveBeenCalledWith({ section: 'data' });
        expect(screen.getByRole('heading', { name: 'Your Data' })).toBeInTheDocument();
        expect(screen.getByTestId('backup-content')).toBeInTheDocument();
    });

    it.each([
        ['google-drive', 'Google Drive'],
        ['dropbox', 'Dropbox'],
    ])('wipes and revokes the active %s provider before clearing account data', async (provider, providerName) => {
        accountLayoutMocks.isCloudConnected = true;
        accountLayoutMocks.hostedServiceSessionId = 'active-session';
        accountLayoutMocks.activeStorageProvider = provider;
        accountLayoutMocks.activeSection = 'data';

        accountLayoutMocks.wipeCloudData.mockResolvedValue(undefined);
        accountLayoutMocks.deleteAllBackups.mockResolvedValue(undefined);
        accountLayoutMocks.disconnectActiveCloudSession.mockResolvedValue(undefined);
        accountLayoutMocks.clearAllData.mockResolvedValue(undefined);

        renderAccount();

        fireEvent.click(screen.getByRole('button', { name: 'Delete All Account Data' }));
        fireEvent.change(screen.getByLabelText(/delete all data/i), {
            target: { value: 'delete all data' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));

        await waitFor(() => {
            expect(accountLayoutMocks.wipeCloudData).toHaveBeenCalledTimes(1);
            expect(accountLayoutMocks.deleteAllBackups).toHaveBeenCalledTimes(1);
            expect(accountLayoutMocks.disconnectActiveCloudSession).toHaveBeenCalledWith({ revoke: true });
            expect(accountLayoutMocks.clearAllData).toHaveBeenCalledTimes(1);
        });

        expect(accountLayoutMocks.wipeCloudData.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.deleteAllBackups.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.deleteAllBackups.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.disconnectActiveCloudSession.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.disconnectActiveCloudSession.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.clearAllData.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.resetOnboardingCompleted).toHaveBeenCalledTimes(1);
        expect(accountLayoutMocks.queuePostReloadToast).toHaveBeenCalledWith({
            level: 'success',
            message: `All data was deleted and ${providerName} was disconnected`,
        });
        expect(accountLayoutMocks.showSuccess).not.toHaveBeenCalled();
    });

    it('syncs Dropbox before signing out and clearing local data', async () => {
        accountLayoutMocks.isCloudConnected = true;
        accountLayoutMocks.hostedServiceSessionId = 'active-session';
        accountLayoutMocks.activeStorageProvider = 'dropbox';
        accountLayoutMocks.forceSyncCloud.mockResolvedValue(undefined);
        accountLayoutMocks.disconnectActiveCloudSession.mockResolvedValue(undefined);
        accountLayoutMocks.clearAllData.mockResolvedValue(undefined);

        renderAccount();

        fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sync & Sign out' }));

        await waitFor(() => {
            expect(accountLayoutMocks.forceSyncCloud).toHaveBeenCalledTimes(1);
            expect(accountLayoutMocks.disconnectActiveCloudSession).toHaveBeenCalledWith({ revoke: false });
            expect(accountLayoutMocks.clearAllData).toHaveBeenCalledTimes(1);
        });
        expect(accountLayoutMocks.forceSyncCloud.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.disconnectActiveCloudSession.mock.invocationCallOrder[0]);
        expect(accountLayoutMocks.disconnectActiveCloudSession.mock.invocationCallOrder[0]).toBeLessThan(accountLayoutMocks.clearAllData.mock.invocationCallOrder[0]);
    });

    it('does not clear local data while a selected provider needs reconnection', async () => {
        accountLayoutMocks.activeStorageProvider = 'dropbox';
        accountLayoutMocks.activeSection = 'data';

        renderAccount();

        fireEvent.click(screen.getByRole('button', { name: 'Delete All Account Data' }));

        expect(screen.getByText(/reconnect Dropbox before deleting all account data/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete All Data' })).toBeDisabled();
        expect(accountLayoutMocks.clearAllData).not.toHaveBeenCalled();
    });
});


it('opens provider sign-in from Account without leaving the current tab', async () => {
    renderAccount();
    const signInButton = screen.getByRole('button', { name: 'Sign in' });
    expect(signInButton.querySelector('svg')).not.toBeNull();
    fireEvent.click(signInButton);
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
    const googleButton = screen.getByRole('button', { name: 'Continue with Google Drive' });
    const dropboxButton = screen.getByRole('button', { name: 'Continue with Dropbox' });
    expect(googleButton).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(dropboxButton).toHaveClass('bg-primary', 'text-primary-foreground');
    fireEvent.click(dropboxButton);
    await waitFor(() => expect(accountLayoutMocks.signInDropbox).toHaveBeenCalledTimes(1));
    expect(accountLayoutMocks.updateUrl).not.toHaveBeenCalled();
    expect(accountLayoutMocks.signIn).not.toHaveBeenCalled();
});

it('keeps a failed sign-in open for retry', async () => {
    accountLayoutMocks.signIn.mockRejectedValue(new Error('Popup closed'));
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google Drive' }));
    expect(await screen.findByText('Popup closed')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
});

it('explains a storage connection failure after authentication and offers connection details', () => {
    accountLayoutMocks.activeStorageProvider = 'google-drive';
    accountLayoutMocks.syncState = 'error';
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Your account could not connect.');
    fireEvent.click(screen.getByRole('button', { name: 'View connection details' }));
    expect(accountLayoutMocks.updateUrl).toHaveBeenCalledWith(expect.objectContaining({ section: 'sync' }));
});

it('signs into the selected provider without offering a provider switch', () => {
    accountLayoutMocks.activeStorageProvider = 'dropbox';
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.queryByRole('button', { name: 'Continue with Google Drive' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Dropbox' })).toBeVisible();
});

it('keeps retained Dropbox session recovery in Cloud Sync without starting another OAuth session', () => {
    accountLayoutMocks.activeStorageProvider = 'dropbox';
    accountLayoutMocks.hostedServiceSessionId = 'retained-session';
    accountLayoutMocks.dropboxSessionId = 'retained-session';
    accountLayoutMocks.dropboxError = 'The Dropbox connection service is temporarily unavailable.';
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('button', { name: 'Sync & Sign out' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'View connection details' }));
    expect(accountLayoutMocks.updateUrl).toHaveBeenCalledWith(expect.objectContaining({ section: 'sync' }));
    expect(accountLayoutMocks.signInDropbox).not.toHaveBeenCalled();
    expect(accountLayoutMocks.disconnectActiveCloudSession).not.toHaveBeenCalled();
});


it('blocks duplicate sign-in attempts and closes only once connected', async () => {
    let finish;
    accountLayoutMocks.signIn.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { rerender } = renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const google = screen.getByRole('button', { name: 'Continue with Google Drive' });
    fireEvent.click(google);
    fireEvent.click(google);
    expect(accountLayoutMocks.signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Continue with Dropbox' })).toBeDisabled();
    finish();
    await waitFor(() => expect(google).not.toBeDisabled());
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
    accountLayoutMocks.isCloudConnected = true;
    accountLayoutMocks.hostedServiceSessionId = 'active-session';
    rerender(<Account projects={[]} tasks={[]} timeEntries={[]} invoices={[]} paymentMethods={[]} businessInfos={[]} clients={[]} invoiceTemplates={[]} emailTemplates={[]} expenses={[]} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sign in' })).not.toBeInTheDocument());
});

it('keeps sign-in discoverable offline without attempting authentication', () => {
    accountLayoutMocks.isOffline = true;
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText("You're offline")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue with Google Drive' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with Dropbox' })).toBeDisabled();
    expect(accountLayoutMocks.signIn).not.toHaveBeenCalled();
});


describe('Account session presentation', () => {
    it.each(['google-drive', 'dropbox'])('keeps %s sign out stable through connection, sync and offline transitions', provider => {
        accountLayoutMocks.activeStorageProvider = provider;
        accountLayoutMocks.hostedServiceSessionId = 'retained-matching-session';
        const { rerender } = renderAccount();
        for (const state of [
            { syncState: 'idle', isConnecting: true, isCloudConnected: false },
            { syncState: 'syncing', isConnecting: false, isCloudConnected: false },
            { syncState: 'idle', isCloudConnected: true },
            { syncState: 'offline', isOffline: true, isCloudConnected: false },
            { syncState: 'error', isOffline: false },
            { syncState: 'idle', isCloudIdentityLoading: true },
        ]) {
            Object.assign(accountLayoutMocks, state);
            rerender(<Account projects={[]} tasks={[]} timeEntries={[]} invoices={[]} paymentMethods={[]} businessInfos={[]} clients={[]} invoiceTemplates={[]} expenses={[]} />);
            expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
            expect(screen.queryByRole('button', { name: /Reconnect|Sign in|Checking account/ })).not.toBeInTheDocument();
        }
        expect(accountLayoutMocks.signIn).not.toHaveBeenCalled();
        expect(accountLayoutMocks.signInDropbox).not.toHaveBeenCalled();
    });

    it('waits for identity loading and switches to sign in after session invalidation', () => {
        accountLayoutMocks.isCloudIdentityLoading = true;
        const { rerender } = renderAccount();
        expect(screen.getByRole('button', { name: 'Checking account…' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
        accountLayoutMocks.isCloudIdentityLoading = false;
        accountLayoutMocks.activeStorageProvider = 'dropbox';
        accountLayoutMocks.hostedServiceSessionId = 'selected-session';
        rerender(<Account projects={[]} tasks={[]} timeEntries={[]} invoices={[]} paymentMethods={[]} businessInfos={[]} clients={[]} invoiceTemplates={[]} expenses={[]} />);
        expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
        accountLayoutMocks.hostedServiceSessionId = null;
        // Stale transport/email/provider information cannot stand in for an auth session.
        accountLayoutMocks.isCloudConnected = true;
        accountLayoutMocks.dropboxAccountEmail = 'studio@example.test';
        rerender(<Account projects={[]} tasks={[]} timeEntries={[]} invoices={[]} paymentMethods={[]} businessInfos={[]} clients={[]} invoiceTemplates={[]} expenses={[]} />);
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
        expect(screen.queryByRole('button', { name: /Reconnect|Sign out/ })).not.toBeInTheDocument();
    });

    it.each([
        { isCloudConnected: false },
        { isCloudConnected: true, isOffline: true },
        { isCloudConnected: true, isConnecting: true },
        { isCloudConnected: true, syncState: 'syncing' },
    ])('keeps sign out safe while sync is unavailable: %j', state => {
        Object.assign(accountLayoutMocks, state, {
            activeStorageProvider: 'dropbox', hostedServiceSessionId: 'retained-session',
        });
        renderAccount();
        fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
        expect(screen.getByRole('button', { name: 'Sync & Sign out' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'View connection details' }));
        expect(accountLayoutMocks.updateUrl).toHaveBeenCalledWith(expect.objectContaining({ section: 'sync' }));
        expect(accountLayoutMocks.forceSyncCloud).not.toHaveBeenCalled();
        expect(accountLayoutMocks.clearAllData).not.toHaveBeenCalled();
        expect(accountLayoutMocks.disconnectActiveCloudSession).not.toHaveBeenCalled();
    });

    it.each(['disconnected', 'offline', 'error', 'syncing', 'pending', 'rejected'])('preserves local data if final sync is %s', async outcome => {
        accountLayoutMocks.activeStorageProvider = 'dropbox';
        accountLayoutMocks.hostedServiceSessionId = 'retained-session';
        accountLayoutMocks.isCloudConnected = true;
        accountLayoutMocks.forceSyncCloud.mockImplementation(async () => {
            if (outcome === 'disconnected') accountLayoutMocks.isCloudConnected = false;
            else if (outcome === 'pending') accountLayoutMocks.pendingChanges = true;
            else if (outcome === 'rejected') throw new Error('Sync failed');
            else accountLayoutMocks.syncState = outcome;
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        renderAccount();
        fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sync & Sign out' }));
        await waitFor(() => expect(accountLayoutMocks.showError).toHaveBeenCalledWith('Sync failed. Please resolve sync issues before signing out.'));
        expect(accountLayoutMocks.clearAllData).not.toHaveBeenCalled();
        expect(accountLayoutMocks.disconnectActiveCloudSession).not.toHaveBeenCalled();
        expect(accountLayoutMocks.showSuccess).not.toHaveBeenCalled();
    });
});


it('updates Account sign-in availability on browser offline and online events', () => {
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent(window, new Event('offline'));
    expect(screen.getByText("You're offline")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue with Google Drive' })).toBeDisabled();
    fireEvent(window, new Event('online'));
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google Drive' })).toBeEnabled();
});
