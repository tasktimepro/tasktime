import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LegalInlineLinks from './LegalInlineLinks';
import AccountFooter from '../account/AccountFooter';

describe('public links from the separate app origin', () => {
    it('opens legal documents on the marketing origin without losing the workspace', () => {
        render(<LegalInlineLinks />);
        expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'https://tasktime.pro/privacy/');
        expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', 'https://tasktime.pro/terms/');
        expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('target', '_blank');
    });

    it('keeps all Account public navigation off the app origin', () => {
        render(<AccountFooter />);
        for (const [name, route] of [['Blog', 'blog'], ['Contact', 'contact'], ['Privacy', 'privacy'], ['Terms', 'terms']]) {
            expect(screen.getByRole('link', { name })).toHaveAttribute('href', `https://tasktime.pro/${route}/`);
        }
    });
});
