import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Account from './Account';

const accountLayoutMocks = vi.hoisted(() => ({
    isMobileLayout: false,
    isDriveConnected: false,
}));

vi.mock('../hooks/useIsMobileLayout', () => ({
    default: () => accountLayoutMocks.isMobileLayout,
}));

vi.mock('../hooks/useUrlState.ts', () => ({
    useUrlState: () => ({
        urlParams: { section: 'preferences' },
        updateUrl: vi.fn(),
    }),
}));

vi.mock('../hooks/useToast.ts', () => ({
    useToast: () => ({
        showSuccess: vi.fn(),
        showError: vi.fn(),
    }),
}));

vi.mock('../contexts/YjsContext', () => ({
    useYjs: () => ({
        clearAllData: vi.fn(),
        isDriveConnected: accountLayoutMocks.isDriveConnected,
        forceSyncDrive: vi.fn(),
        disconnectDrive: vi.fn(),
        wipeDriveData: vi.fn(),
    }),
}));

vi.mock('../hooks/useGoogleAuth', () => ({
    useGoogleAuth: () => ({
        signOut: vi.fn(),
    }),
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
vi.mock('./Modal', () => ({ default: () => null }));

describe('Account', () => {
    it('renders a persistent footer with privacy and terms links', () => {
        accountLayoutMocks.isMobileLayout = false;
        accountLayoutMocks.isDriveConnected = false;

        render(
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

        const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
        const termsLink = screen.getByRole('link', { name: 'Terms & Conditions' });

        expect(privacyLink.getAttribute('href')).toBe('/privacy');
        expect(termsLink.getAttribute('href')).toBe('/terms');
        expect(privacyLink.getAttribute('target')).toBe('_blank');
        expect(termsLink.getAttribute('target')).toBe('_blank');
    });

    it('keeps the desktop subtitle visible', () => {
        accountLayoutMocks.isMobileLayout = false;
        accountLayoutMocks.isDriveConnected = true;

        render(
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

        expect(screen.getByText('Manage your account settings')).toBeInTheDocument();
    });

    it('hides the subtitle and keeps sign out inline on mobile', () => {
        accountLayoutMocks.isMobileLayout = true;
        accountLayoutMocks.isDriveConnected = true;

        render(
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

        expect(screen.queryByText('Manage your account settings')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign out' }).className.includes('shrink-0')).toBe(true);
    });
});