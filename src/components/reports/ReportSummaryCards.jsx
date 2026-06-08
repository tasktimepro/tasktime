import PropTypes from 'prop-types';
import { CheckSquareIcon, ClockIcon, CurrencyDollarIcon, DocumentTextIcon, HandCoinsIcon, PercentIcon } from '@/components/ui/icons';
import { StatCard } from '@/components/ui/stat-card';

const mutedCardClassName = 'border-border bg-muted/40';
const titleClassByAccent = {
    blue: 'status-info-text',
    green: 'status-success-text',
    amber: 'status-warning-text',
    red: 'status-danger-text',
    default: 'text-foreground',
};
const iconClassByAccent = {
    blue: 'status-info-text-strong',
    green: 'status-success-text-strong',
    amber: 'status-warning-text-strong',
    red: 'status-danger-text-strong',
    default: 'text-muted-foreground',
};

function ReportSummaryCards({ cards }) {
    const buildCardProps = (accent = 'default') => ({
        className: mutedCardClassName,
        titleClassName: titleClassByAccent[accent],
        iconClassName: iconClassByAccent[accent],
    });

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Issued"
                    value={cards.revenueIssued.value}
                    subtitle={cards.revenueIssued.subtitle}
                    icon={DocumentTextIcon}
                    {...buildCardProps('blue')}
                />
                <StatCard
                    title="Received"
                    value={cards.revenuePaid.value}
                    subtitle={cards.revenuePaid.subtitle}
                    icon={DocumentTextIcon}
                    {...buildCardProps('green')}
                />
                <StatCard
                    title="Outstanding"
                    value={cards.outstanding.value}
                    subtitle={cards.outstanding.subtitle}
                    icon={DocumentTextIcon}
                    {...buildCardProps('amber')}
                />
                <StatCard
                    title="Overdue"
                    value={cards.overdue.value}
                    subtitle={cards.overdue.subtitle}
                    icon={DocumentTextIcon}
                    {...buildCardProps('red')}
                />
                <StatCard
                    title="Expenses"
                    value={cards.expenses.value}
                    subtitle={cards.expenses.subtitle}
                    icon={HandCoinsIcon}
                    {...buildCardProps()}
                />
                <StatCard
                    title="Estimated Profit"
                    value={cards.estimatedProfit.value}
                    subtitle={cards.estimatedProfit.subtitle}
                    icon={CurrencyDollarIcon}
                    {...buildCardProps('green')}
                />
                <StatCard
                    title="Hours Worked"
                    value={cards.hoursWorked.value}
                    subtitle={cards.hoursWorked.subtitle}
                    icon={ClockIcon}
                    {...buildCardProps()}
                />
                <StatCard
                    title="Uninvoiced Work"
                    value={cards.uninvoicedWork.value}
                    subtitle={cards.uninvoicedWork.subtitle}
                    icon={CheckSquareIcon}
                    {...buildCardProps()}
                />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Output Tax"
                    value={cards.outputTax.value}
                    subtitle={cards.outputTax.subtitle}
                    icon={PercentIcon}
                    {...buildCardProps()}
                />
                <StatCard
                    title="Billable Utilization"
                    value={cards.billableUtilization.value}
                    subtitle={cards.billableUtilization.subtitle}
                    icon={ClockIcon}
                    {...buildCardProps()}
                />
            </div>
        </div>
    );
}

const cardShape = PropTypes.shape({
    value: PropTypes.node.isRequired,
    subtitle: PropTypes.node.isRequired,
});

ReportSummaryCards.propTypes = {
    cards: PropTypes.shape({
        revenueIssued: cardShape.isRequired,
        revenuePaid: cardShape.isRequired,
        outstanding: cardShape.isRequired,
        overdue: cardShape.isRequired,
        outputTax: cardShape.isRequired,
        expenses: cardShape.isRequired,
        estimatedProfit: cardShape.isRequired,
        hoursWorked: cardShape.isRequired,
        uninvoicedWork: cardShape.isRequired,
        billableUtilization: cardShape.isRequired,
    }).isRequired,
};

export default ReportSummaryCards;
