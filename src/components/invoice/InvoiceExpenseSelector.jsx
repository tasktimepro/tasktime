import { formatCurrency, CURRENCY_NAMES, normalizeCurrencyCode } from '../../utils/currencyUtils.ts';
import { Notice } from '@/components/ui/notice';
import CustomCheckbox from '../CustomCheckbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrashIcon } from '@/components/ui/icons';

/**
 * InvoiceExpenseSelector component - Expense selection for invoicing.
 * @param {Object} props
 */
const InvoiceExpenseSelector = ({
    activeSection,
    toggleSection,
    expenses,
    selectedExpensesForBilling,
    setSelectedExpensesForBilling,
    additionalExpenses,
    showAddExpenseForm,
    setShowAddExpenseForm,
    newExpenseTitle,
    setNewExpenseTitle,
    newExpenseAmount,
    setNewExpenseAmount,
    newExpenseCurrency,
    setNewExpenseCurrency,
    newExpenseSupplierName,
    setNewExpenseSupplierName,
    handleAddAdditionalExpense,
    handleRemoveAdditionalExpense,
    getInvoiceCurrency,
    conversionUnavailableCount,
    exchangeRatesError,
    exchangeRatesLoading
}) => {
    const handleSelectAll = () => {
        const allSelected = {};
        expenses.forEach((expense) => {
            if (expense.isConvertible === false) return;
            allSelected[expense.id] = true;
        });
        setSelectedExpensesForBilling(allSelected);
    };

    const handleDeselectAll = () => {
        setSelectedExpensesForBilling({});
    };

    return (
        <div className="border border-border rounded-lg">
            <button
                type="button"
                onClick={() => toggleSection('expenses')}
                className={`w-full px-4 py-3 text-left cursor-pointer bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'expenses' ? 'rounded-t-lg' : 'rounded-lg'}`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-foreground">Expenses</h4>
                        <span className="text-xs text-muted-foreground">({expenses.length + additionalExpenses.length})</span>
                    </div>
                    <svg
                        className={`w-5 h-5 text-muted-foreground transform transition-transform ${activeSection === 'expenses' ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>
            {activeSection === 'expenses' && (
                <div className="p-4 space-y-3">
                    {conversionUnavailableCount > 0 && (
                        <Notice
                            title="Some expenses need exchange rates"
                            description={`${conversionUnavailableCount} expense${conversionUnavailableCount === 1 ? '' : 's'} cannot be selected until rates are available.`}
                        />
                    )}
                    {exchangeRatesError && !exchangeRatesLoading && (
                        <Notice
                            title="Exchange rates unavailable"
                            description={exchangeRatesError}
                        />
                    )}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {expenses.length > 0 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleSelectAll}
                                        className="text-xs text-muted-foreground underline underline-offset-2 cursor-pointer hover:text-foreground"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-xs text-muted-foreground">|</span>
                                    <button
                                        type="button"
                                        onClick={handleDeselectAll}
                                        className="text-xs text-muted-foreground underline underline-offset-2 cursor-pointer hover:text-foreground"
                                    >
                                        Deselect All
                                    </button>
                                </>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto shrink-0 p-0"
                            onClick={() => {
                                setShowAddExpenseForm(true);
                            }}
                        >
                            + Add Expense
                        </Button>
                    </div>
                    {expenses.length === 0 ? (
                            <Notice
                                title="No billable expenses available"
                            />
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {expenses.map((expense) => {
                                const invoiceCurrency = getInvoiceCurrency();
                                const isConvertible = expense.isConvertible !== false;
                                const originalCurrency = expense.originalCurrency || invoiceCurrency;
                                const showOriginal = originalCurrency !== invoiceCurrency;

                                return (
                                    <div
                                        key={expense.id}
                                        className={`flex items-center justify-between rounded border bg-card p-3 ${!isConvertible ? 'opacity-60' : ''}`}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <CustomCheckbox
                                                checked={selectedExpensesForBilling[expense.id] || false}
                                                onChange={(checked) => setSelectedExpensesForBilling((prev) => ({
                                                    ...prev,
                                                    [expense.id]: checked
                                                }))}
                                                disabled={!isConvertible}
                                            />
                                            <div className="min-w-0 flex-1 pr-4">
                                                <p className="text-sm font-medium text-foreground">
                                                    {expense.title}
                                                </p>
                                                {expense.supplierName && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {expense.supplierName}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {isConvertible ? (
                                                <>
                                                    <div className="text-sm font-medium text-foreground sensitive-data">
                                                        {formatCurrency(expense.convertedAmount ?? expense.amount ?? 0, invoiceCurrency)}
                                                    </div>
                                                    {showOriginal && (
                                                        <div className="text-xs text-muted-foreground sensitive-data">
                                                            {formatCurrency(expense.originalAmount ?? expense.amount ?? 0, originalCurrency)}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-sm font-medium text-muted-foreground sensitive-data">
                                                        {formatCurrency(expense.originalAmount ?? expense.amount ?? 0, originalCurrency)}
                                                    </div>
                                                    <div className="text-xs text-destructive">
                                                        Rate unavailable
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {additionalExpenses.length > 0 && (
                        <div className="pt-2 space-y-2">
                            <div className="text-xs text-muted-foreground">
                                Invoice-only expenses
                            </div>
                            <div className="space-y-2">
                                {additionalExpenses.map((expense) => {
                                    const invoiceCurrency = getInvoiceCurrency();
                                    const originalCurrency = expense.originalCurrency || invoiceCurrency;
                                    const showOriginal = normalizeCurrencyCode(originalCurrency) !== normalizeCurrencyCode(invoiceCurrency);

                                    return (
                                        <div
                                            key={expense.id}
                                            className="flex items-center justify-between rounded border bg-card p-3"
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveAdditionalExpense(expense.id)}
                                                    className="text-destructive-strong hover-text-destructive-strong cursor-pointer"
                                                    title="Remove expense"
                                                    aria-label="Remove expense"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </Button>
                                                <div className="min-w-0 flex-1 pr-4">
                                                    <p className="text-sm font-medium text-foreground">
                                                        {expense.title}
                                                    </p>
                                                    {expense.supplierName && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {expense.supplierName}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-foreground sensitive-data">
                                                    {formatCurrency(expense.amount || 0, invoiceCurrency)}
                                                </div>
                                                {showOriginal && (
                                                    <div className="text-xs text-muted-foreground sensitive-data">
                                                        {formatCurrency(expense.originalAmount || expense.amount || 0, originalCurrency)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {showAddExpenseForm && (
                        <div className="mt-2 mb-2 p-3 bg-card border border-border rounded-md">
                            <div className="space-y-3">
                                <Input
                                    type="text"
                                    value={newExpenseTitle}
                                    onChange={(e) => setNewExpenseTitle(e.target.value)}
                                    placeholder="Expense description"
                                    required
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleAddAdditionalExpense();
                                        }
                                    }}
                                />

                                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                                    <div className="w-full md:min-w-[140px] md:flex-1">
                                        <div className="text-xs text-muted-foreground mb-1">Amount</div>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={newExpenseAmount}
                                            onChange={(e) => setNewExpenseAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="sensitive-data"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleAddAdditionalExpense();
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="w-full md:w-36">
                                        <div className="text-xs text-muted-foreground mb-1">Currency</div>
                                        <Select
                                            value={newExpenseCurrency}
                                            onValueChange={setNewExpenseCurrency}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Currency" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(CURRENCY_NAMES).map((code) => (
                                                    <SelectItem key={code} value={code}>
                                                        {code}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-full md:min-w-[160px] md:flex-1">
                                        <div className="text-xs text-muted-foreground mb-1">Supplier (optional)</div>
                                        <Input
                                            type="text"
                                            value={newExpenseSupplierName}
                                            onChange={(e) => setNewExpenseSupplierName(e.target.value)}
                                            placeholder="Supplier name"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleAddAdditionalExpense();
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            setShowAddExpenseForm(false);
                                            setNewExpenseTitle('');
                                            setNewExpenseAmount('');
                                            setNewExpenseSupplierName('');
                                            setNewExpenseCurrency(getInvoiceCurrency());
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleAddAdditionalExpense}
                                    >
                                        Add Expense
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InvoiceExpenseSelector;
