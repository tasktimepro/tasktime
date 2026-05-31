import React from 'react';
import { DocumentTextIcon, ClockIcon } from '@/components/ui/icons';
import { getCurrencySymbol, getProjectCurrency } from '../../utils/currencyUtils.ts';

/**
 * InvoiceGeneratorButton - Renders invoice generation button with badge.
 */
const InvoiceGeneratorButton = ({
    onClick,
    currentProject,
    unbilledHours,
    unbilledAmount,
    clients,
    mode = 'invoice'
}) => {
    const isQuoteMode = mode === 'quote';

    return (
        <div className="flex items-center space-x-3">
            <button
                onClick={onClick}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring cursor-pointer"
            >
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                {isQuoteMode ? 'Generate Quote' : (currentProject ? 'Generate Invoice' : 'Create Invoice')}
                {!isQuoteMode && currentProject && unbilledHours > 0 && currentProject.hourlyRate && (
                    <span className="ml-2 px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">
                        <span className="sensitive-data">
                            {getCurrencySymbol(getProjectCurrency(currentProject, clients))}{unbilledAmount.toFixed(2)}
                        </span>
                    </span>
                )}
                {!isQuoteMode && currentProject && unbilledHours > 0 && !currentProject.hourlyRate && (
                    <span className="ml-2 px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full flex items-center">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        {unbilledHours.toFixed(2)}h
                    </span>
                )}
            </button>
        </div>
    );
};

export default React.memo(InvoiceGeneratorButton);
