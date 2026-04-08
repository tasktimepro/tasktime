import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LegalPageLayout from './LegalPageLayout';

vi.mock('@/hooks/useDarkModePreference.ts', () => ({
    useDarkModePreference: () => [false, vi.fn()],
}));

describe('LegalPageLayout', () => {
    it('enables document scrolling while a public legal page is mounted and updates head metadata', () => {
        document.title = 'TaskTime';

        const { unmount } = render(
            <LegalPageLayout
                pageKey="privacy"
                title="Privacy Policy"
                summary="Summary"
                lastUpdated="April 9, 2026"
                highlights={['Stored locally by default']}
            >
                <section>
                    <h2>Details</h2>
                </section>
            </LegalPageLayout>
        );

        expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
        expect(document.title).toBe('Privacy Policy | TaskTime');
        expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Summary');
        expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://tasktime.pro/privacy');
        expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://tasktime.pro/privacy');
        expect(document.documentElement.classList.contains('public-legal-page')).toBe(true);
        expect(document.body.classList.contains('public-legal-page')).toBe(true);

        unmount();

        expect(document.title).toBe('TaskTime');
        expect(document.documentElement.classList.contains('public-legal-page')).toBe(false);
        expect(document.body.classList.contains('public-legal-page')).toBe(false);
    });
});