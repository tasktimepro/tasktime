import React from 'react';
import { DocumentTextIcon, ClockIcon } from '@/components/ui/icons';
import { formatCurrency, getProjectCurrency } from '../../utils/currencyUtils.ts';
import { usePreferences } from '@/hooks/usePreferences';

/**
 * InvoiceGeneratorButton - Renders invoice generation button with badge.
 */
const InvoiceGeneratorButton = ({
    onClick,
    currentProject,
    invoicePreview,
    clients,
    mode = 'invoice',
    isLoading = false
}) => {
    const { preferences } = usePreferences();
    const isQuoteMode = mode === 'quote';
    const previewAmount = invoicePreview?.total || 0;
    const previewCurrency = invoicePreview?.currency
        || (currentProject ? getProjectCurrency(currentProject, clients, preferences.currency) : null);
    const unpricedHours = invoicePreview?.unpricedHours || 0;
    const excludedExpenseCount = invoicePreview?.excludedExpenseCount || 0;
    const previewTitle = excludedExpenseCount > 0
        ? `${excludedExpenseCount} expense${excludedExpenseCount === 1 ? '' : 's'} excluded until exchange rates are available`
        : 'Estimated invoice total';

    return (
        <div className="flex items-center space-x-3">
            <button
                onClick={onClick}
                disabled={isLoading}
                aria-busy={isLoading}
                title={isLoading ? 'Loading complete billing history…' : undefined}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring cursor-pointer"
            >
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                {isLoading ? 'Loading billing history…' : (isQuoteMode ? 'Generate Quote' : (currentProject ? 'Generate Invoice' : 'Create Invoice'))}
                {!isQuoteMode && currentProject && previewAmount > 0 && (
                    <span className="ml-2 px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full" title={previewTitle}>
                        <span className="sensitive-data">
                            {formatCurrency(previewAmount, previewCurrency)}
                        </span>
                    </span>
                )}
                {!isQuoteMode && currentProject && previewAmount <= 0 && unpricedHours > 0 && (
                    <span className="ml-2 px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full flex items-center">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        {unpricedHours.toFixed(2)}h
                    </span>
                )}
            </button>
        </div>
    );
};

export default React.memo(InvoiceGeneratorButton);
