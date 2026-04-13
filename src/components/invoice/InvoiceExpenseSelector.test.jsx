import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvoiceExpenseSelector from './InvoiceExpenseSelector';

const createBaseProps = (overrides = {}) => ({
    activeSection: 'expenses',
    toggleSection: vi.fn(),
    expenses: [],
    selectedExpensesForBilling: {},
    setSelectedExpensesForBilling: vi.fn(),
    additionalExpenses: [],
    showAddExpenseForm: false,
    setShowAddExpenseForm: vi.fn(),
    newExpenseTitle: '',
    setNewExpenseTitle: vi.fn(),
    newExpenseAmount: '',
    setNewExpenseAmount: vi.fn(),
    newExpenseCurrency: 'USD',
    setNewExpenseCurrency: vi.fn(),
    newExpenseSupplierName: '',
    setNewExpenseSupplierName: vi.fn(),
    handleAddAdditionalExpense: vi.fn(),
    handleRemoveAdditionalExpense: vi.fn(),
    getInvoiceCurrency: () => 'USD',
    conversionUnavailableCount: 0,
    exchangeRatesError: '',
    exchangeRatesLoading: false,
    ...overrides,
});

const findAncestorWithClass = (element, className) => {
    let current = element;

    while (current) {
        if (typeof current.className === 'string' && current.className.includes(className)) {
            return current;
        }

        current = current.parentElement;
    }

    return null;
};

describe('InvoiceExpenseSelector', () => {
    it('keeps expense rows inline and stacks add-expense form actions on mobile', () => {
        render(
            <InvoiceExpenseSelector
                {...createBaseProps({
                    expenses: [
                        {
                            id: 'expense-1',
                            title: 'Hosting',
                            amount: 75,
                            convertedAmount: 75,
                            supplierName: 'Example Vendor',
                        }
                    ],
                    showAddExpenseForm: true,
                })}
            />
        );

        const expenseRow = findAncestorWithClass(screen.getByText('Hosting'), 'rounded border bg-card p-3');
        const amountInput = screen.getByPlaceholderText('0.00');
        const addExpenseButtonRow = findAncestorWithClass(screen.getByRole('button', { name: 'Add Expense' }), 'flex-col-reverse');

        expect(expenseRow?.className.includes('items-center')).toBe(true);
        expect(expenseRow?.className.includes('justify-between')).toBe(true);
        expect(expenseRow?.className.includes('flex-col')).toBe(false);
        expect(amountInput.className.includes('w-full')).toBe(true);
        expect(addExpenseButtonRow?.className.includes('flex-col-reverse')).toBe(true);
    });
});