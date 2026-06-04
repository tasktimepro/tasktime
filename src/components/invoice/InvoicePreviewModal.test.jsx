import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

        expect(screen.getByText('Preview note')).toBeInTheDocument();
        expect(screen.getByText('The final generated PDF can vary slightly from the preview below.')).toBeInTheDocument();
        expect(previewShell).toHaveClass('bg-white');
        expect(previewShell).toHaveClass('overflow-x-auto');
        expect(previewShell).toHaveClass('overflow-y-hidden');
        expect(previewPage.style.width).toBe('794px');
        expect(previewPage.style.minHeight).toBe('1123px');
        expect(previewFrame.style.width).toBe('375px');
        expect(previewPage).toHaveClass('overflow-visible');
        expect(previewPage).toHaveTextContent('Invoice: #INV-0160');
    });

    it('allows horizontal scrolling when preview content is wider than the modal body', async () => {
        render(
            <InvoicePreviewModal
                isOpen
                onClose={vi.fn()}
                title="Invoice Preview"
                htmlContent={'<div class="invoice-document"><div>Wide preview</div></div>'}
            />
        );

        const previewFrame = screen.getByTestId('invoice-preview-frame');
        const invoiceDocument = document.querySelector('.invoice-document');

        Object.defineProperty(invoiceDocument, 'scrollWidth', {
            configurable: true,
            get: () => 1000,
        });

        Object.defineProperty(invoiceDocument, 'scrollHeight', {
            configurable: true,
            get: () => 1123,
        });

        fireEvent(window, new Event('resize'));

        await waitFor(() => {
            expect(previewFrame.style.width).toBe('473px');
        });
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

    it('renders an optional download action in the default footer', () => {
        const onDownload = vi.fn();

        render(
            <InvoicePreviewModal
                isOpen
                onClose={vi.fn()}
                title="Template Preview"
                htmlContent={'<div><h1>INVOICE</h1></div>'}
                onDownload={onDownload}
                downloadLabel="Download Sample PDF"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Download Sample PDF' }));

        expect(onDownload).toHaveBeenCalledTimes(1);
    });
});
