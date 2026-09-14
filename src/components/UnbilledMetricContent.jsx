import PropTypes from 'prop-types';
import { CurrencyDollarIcon, HandCoinsIcon } from '@/components/ui/icons';

/** Stack compact work and expense amounts beneath the Unbilled heading. */
export default function UnbilledMetricContent({ workAmount, expenseAmount = null, testId }) {

    return (
        <div data-testid={testId} className="min-w-0 w-full">
            <p className="text-sm font-medium text-muted-foreground truncate">Unbilled</p>
            <dl className="mt-2 space-y-1">
                <div>
                    <dt className="sr-only">Work</dt>
                    <dd className="flex items-center text-sm text-muted-foreground">
                        <CurrencyDollarIcon className="h-4 w-4 mr-2 shrink-0" aria-hidden="true" />
                        <span className="sensitive-data min-w-0 break-words text-foreground font-semibold">{workAmount}</span>
                    </dd>
                </div>
                {expenseAmount && (
                    <div>
                        <dt className="sr-only">Expenses</dt>
                        <dd className="flex items-center text-sm text-muted-foreground">
                            <HandCoinsIcon className="h-4 w-4 mr-2 shrink-0" aria-hidden="true" />
                            <span className="sensitive-data min-w-0 break-words text-foreground font-semibold">{expenseAmount}</span>
                        </dd>
                    </div>
                )}
            </dl>
        </div>
    );
}

UnbilledMetricContent.propTypes = {
    workAmount: PropTypes.string.isRequired,
    expenseAmount: PropTypes.string,
    testId: PropTypes.string,
};
