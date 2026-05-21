import PropTypes from 'prop-types';
import { BanknotesIcon, ChartBarIcon, CheckSquareIcon, ClockIcon, CurrencyDollarIcon, DocumentTextIcon, HandCoinsIcon } from '@/components/ui/icons';
import { StatCard } from '@/components/ui/stat-card';

function ReportSummaryCards({ cards }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
                title="Revenue Issued"
                value={cards.revenueIssued.value}
                subtitle={cards.revenueIssued.subtitle}
                icon={DocumentTextIcon}
                variant="blue"
            />
            <StatCard
                title="Revenue Paid"
                value={cards.revenuePaid.value}
                subtitle={cards.revenuePaid.subtitle}
                icon={BanknotesIcon}
                variant="green"
            />
            <StatCard
                title="Outstanding"
                value={cards.outstanding.value}
                subtitle={cards.outstanding.subtitle}
                icon={CurrencyDollarIcon}
                variant="amber"
            />
            <StatCard
                title="Overdue"
                value={cards.overdue.value}
                subtitle={cards.overdue.subtitle}
                icon={HandCoinsIcon}
                variant="red"
            />
            <StatCard
                title="Output Tax"
                value={cards.outputTax.value}
                subtitle={cards.outputTax.subtitle}
                icon={ChartBarIcon}
                variant="default"
            />
            <StatCard
                title="Expenses"
                value={cards.expenses.value}
                subtitle={cards.expenses.subtitle}
                icon={HandCoinsIcon}
                variant="default"
            />
            <StatCard
                title="Uninvoiced Work"
                value={cards.uninvoicedWork.value}
                subtitle={cards.uninvoicedWork.subtitle}
                icon={CheckSquareIcon}
                variant="default"
            />
            <StatCard
                title="Billable Utilization"
                value={cards.billableUtilization.value}
                subtitle={cards.billableUtilization.subtitle}
                icon={ClockIcon}
                variant="default"
            />
        </div>
    );
}

const cardShape = PropTypes.shape({
    value: PropTypes.string.isRequired,
    subtitle: PropTypes.string.isRequired,
});

ReportSummaryCards.propTypes = {
    cards: PropTypes.shape({
        revenueIssued: cardShape.isRequired,
        revenuePaid: cardShape.isRequired,
        outstanding: cardShape.isRequired,
        overdue: cardShape.isRequired,
        outputTax: cardShape.isRequired,
        expenses: cardShape.isRequired,
        uninvoicedWork: cardShape.isRequired,
        billableUtilization: cardShape.isRequired,
    }).isRequired,
};

export default ReportSummaryCards;
