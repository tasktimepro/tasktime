import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { TemplateVariablesPanel } from '@/components/ui/template-variables-panel';
import { ToastContext } from '@/contexts/ToastContext';

const variables = [
    { key: '{invoiceNumber}', description: 'Invoice number' },
    { key: '{businessName}', description: 'Business name' },
];

describe('TemplateVariablesPanel', () => {
    const createToastContextValue = () => ({
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn(),
    });

    const renderWithToast = (ui, toastValue = createToastContextValue()) => {
        return {
            ...render(
                <ToastContext.Provider value={toastValue}>
                    {ui}
                </ToastContext.Provider>
            ),
            toastValue,
        };
    };

    it('renders a collapsible single-column grid that expands at small screens', () => {
        const { container } = renderWithToast(
            <TemplateVariablesPanel
                title="Available Variables"
                description="Choose a placeholder."
                variables={variables}
            />
        );

        expect(screen.getByText('Available Variables')).toBeInTheDocument();
        expect(screen.queryByText('{invoiceNumber}')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /available variables/i }));

        expect(screen.getByText('Choose a placeholder.')).toBeInTheDocument();
        expect(screen.getByText('{invoiceNumber}')).toBeInTheDocument();
        expect(screen.getByText('Business name')).toBeInTheDocument();

        const grid = container.querySelector('.grid');

        expect(grid.className).toContain('grid-cols-1');
        expect(grid.className).toContain('sm:grid-cols-2');
    });

    it('copies the variable and shows a success toast when tapped', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        const toastValue = createToastContextValue();

        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

        renderWithToast(
            <TemplateVariablesPanel
                variables={variables}
                defaultExpanded
            />,
            toastValue
        );

        fireEvent.click(screen.getByRole('button', { name: /invoice number/i }));

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith('{invoiceNumber}');
        });
        expect(toastValue.showSuccess).toHaveBeenCalledWith('Copied {invoiceNumber}');
    });
});