import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InvoicePreview from './InvoicePreview';

vi.mock('../CustomCheckbox', () => ({
    default: (props) => {
        const inputProps = { ...props };

        delete inputProps.label;
        delete inputProps.labelClassName;

        return <input type="checkbox" {...inputProps} />;
    }
}));

vi.mock('@/components/ui/select', () => ({
    Select: ({ children }) => <div>{children}</div>,
    SelectContent: ({ children }) => <div>{children}</div>,
    SelectItem: ({ children }) => <div>{children}</div>,
    SelectTrigger: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
    SelectValue: () => null,
}));

describe('InvoicePreview', () => {
    it('formats large pricing totals with grouped thousands separators', () => {
        render(
            <InvoicePreview
                activeSection="pricingTotals"
                toggleSection={vi.fn()}
                calculatePricing={{
                    subtotal: 50000,
                    discount: 10000,
                    shipping: 2500,
                    tax: 4250,
                    total: 46750,
                    taxLabel: 'VAT',
                    taxRate: 10,
                }}
                discountType="fixed"
                setDiscountType={vi.fn()}
                discountValue={10000}
                setDiscountValue={vi.fn()}
                shippingAmount={2500}
                setShippingAmount={vi.fn()}
                taxOverride={{ enabled: false }}
                setTaxOverride={vi.fn()}
                selectedBusinessInfo={{ taxEnabled: true, taxLabel: 'VAT', taxRate: 10 }}
                selectedClient={null}
                getInvoiceCurrency={() => 'CHF'}
                getCurrencySymbol={vi.fn(() => 'CHF')}
            />
        );

        expect(screen.getAllByText('CHF46,750.00')).toHaveLength(2);
        expect(screen.getByText('CHF50,000.00')).toBeInTheDocument();
        expect(screen.getByText('Discount (CHF10,000.00):')).toBeInTheDocument();
        expect(screen.getByText('-CHF10,000.00')).toBeInTheDocument();
        expect(screen.getByText('CHF2500.00')).toBeInTheDocument();
        expect(screen.getByText('CHF4250.00')).toBeInTheDocument();
    });
});
