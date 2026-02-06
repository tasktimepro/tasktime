import { toDisplayDate } from '../../utils/dateUtils.ts';
import { formatCurrency } from '../../utils/currencyUtils.ts';
import { Notice } from '@/components/ui/notice';
import CustomCheckbox from '../CustomCheckbox';

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
    getInvoiceCurrency,
    incompatibleExpensesCount
}) => {
    const handleSelectAll = () => {
        const allSelected = {};
        expenses.forEach((expense) => {
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
                        <span className="text-xs text-muted-foreground">({expenses.length})</span>
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
                    {incompatibleExpensesCount > 0 && (
                        <Notice
                            title="Some expenses were excluded"
                            description={`${incompatibleExpensesCount} expense${incompatibleExpensesCount === 1 ? '' : 's'} have a different currency than this invoice.`}
                        />
                    )}
                    {expenses.length === 0 ? (
                        <Notice
                            title="No billable expenses available"
                            description="Only unbilled, billable expenses for the selected client or project appear here."
                        />
                    ) : (
                        <>
                            <div className="flex justify-between items-center">
                                <div className="flex space-x-2">
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
                                </div>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {expenses.map((expense) => (
                                    <div key={expense.id} className="flex items-center justify-between p-3 bg-card rounded border">
                                        <div className="flex items-center space-x-3 flex-1">
                                            <CustomCheckbox
                                                checked={selectedExpensesForBilling[expense.id] || false}
                                                onChange={(checked) => setSelectedExpensesForBilling((prev) => ({
                                                    ...prev,
                                                    [expense.id]: checked
                                                }))}
                                            />
                                            <div className="flex-1 pr-4">
                                                <p className="text-sm font-medium text-foreground">
                                                    {expense.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {toDisplayDate(expense.date)}
                                                    {expense.supplierName ? ` • ${expense.supplierName}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-sm font-medium text-foreground sensitive-data">
                                            {formatCurrency(expense.amount || 0, expense.currency || getInvoiceCurrency())}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default InvoiceExpenseSelector;
