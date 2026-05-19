import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import InvoicePreviewModal from './InvoicePreviewModal';

describe('InvoicePreviewModal', () => {
    const originalInnerWidth = window.innerWidth;

    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 375,
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: originalInnerWidth,
        });
    });

    it('renders preview html inside a fixed A4 page scaled to the viewport', async () => {
        render(
            <InvoicePreviewModal
                isOpen
                onClose={vi.fn()}
                title="Invoice Preview"
                htmlContent={'<div><h1>INVOICE</h1><p>Invoice: #INV-0160</p></div>'}
            />
        );

        const previewFrame = screen.getByTestId('invoice-preview-frame');
        const previewPage = screen.getByTestId('invoice-preview-page');
        const previewShell = screen.getByTestId('invoice-preview-shell');

        await waitFor(() => {
            expect(previewPage.style.transform).toContain('scale(');
        });

        expect(previewShell).toHaveClass('bg-white');
        expect(previewPage.style.width).toBe('794px');
        expect(previewPage.style.minHeight).toBe('1123px');
        expect(previewFrame.style.width).toBe('375px');
        expect(previewPage).toHaveTextContent('Invoice: #INV-0160');
    });

    it('omits client contact person and email from the fallback invoice to section', () => {
        render(
            <InvoicePreviewModal
                isOpen
                onClose={vi.fn()}
                title="Invoice Preview"
                invoice={{
                    invoiceNumber: 'INV-0162',
                    date: '2026-05-19',
                    client: {
                        name: 'Healthbrain GmbH',
                        contactPerson: 'Urs Wittwer',
                        email: 'uwittwer@gmail.com',
                        address: 'Alte Langackerstrasse 89',
                        city: 'Herrliberg',
                        state: 'ZH',
                        zip: '8704',
                    },
                    tasks: [],
                    totalHours: 0,
                    total: 0,
                    currency: 'CHF',
                }}
            />
        );

        expect(screen.getByText('Healthbrain GmbH')).toBeInTheDocument();
        expect(screen.getByText('Alte Langackerstrasse 89')).toBeInTheDocument();
        expect(screen.queryByText('Urs Wittwer')).not.toBeInTheDocument();
        expect(screen.queryByText('uwittwer@gmail.com')).not.toBeInTheDocument();
    });
});