import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    BanknotesIcon,
    BuildingOfficeIcon,
    ClipboardDocumentCheckIcon,
    DocumentTextIcon,
    FunnelXIcon,
    HandCoinsIcon,
    ListFilterIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
} from '@/components/ui/icons';
import PeriodRangePicker from '@/components/ui/period-range-picker';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';

const triggerClassName = 'w-full min-w-[10rem] bg-background';

function ReportFilters({
    businessId,
    clientId,
    categoryId,
    categories,
    clients,
    currencyDisplayMode,
    customEnd,
    customStart,
    expenseDateBasis,
    expenseStatus,
    incomeDateBasis,
    invoiceStatus,
    onBusinessIdChange,
    onClientIdChange,
    onCategoryIdChange,
    onCurrencyDisplayModeChange,
    onCustomEndChange,
    onCustomStartChange,
    onExpenseDateBasisChange,
    onExpenseStatusChange,
    onIncomeDateBasisChange,
    onInvoiceStatusChange,
    onPeriodChange,
    onProjectIdChange,
    onResetFilters,
    period,
    periodOptions,
    projectId,
    projects,
    businessInfos,
}) {
    const isMobileLayout = useIsMobileLayout();

    return (
        <div className={cn('grid gap-3', isMobileLayout ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-4')}>
            <PeriodRangePicker
                value={period}
                onValueChange={onPeriodChange}
                options={periodOptions}
                customStart={customStart}
                customEnd={customEnd}
                onCustomStartChange={onCustomStartChange}
                onCustomEndChange={onCustomEndChange}
                triggerClassName={cn(triggerClassName, 'justify-between')}
                className="w-full"
                ariaLabel="Report period"
            />

            <Select value={businessId} onValueChange={onBusinessIdChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={BuildingOfficeIcon} aria-label="Business filter">
                    <SelectValue placeholder="Business profile" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All businesses</SelectItem>
                    {businessInfos.map((businessInfo) => (
                        <SelectItem key={businessInfo.id} value={businessInfo.id}>
                            {businessInfo.businessName || businessInfo.name || businessInfo.title || 'Untitled business'}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={clientId} onValueChange={onClientIdChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={UserGroupIcon} aria-label="Client filter">
                    <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                            {client.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={projectId} onValueChange={onProjectIdChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={ClipboardDocumentCheckIcon} aria-label="Project filter">
                    <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All projects</SelectItem>
                    {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                            {project.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={expenseStatus} onValueChange={onExpenseStatusChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={HandCoinsIcon} aria-label="Expense status filter">
                    <SelectValue placeholder="Expense status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All expenses</SelectItem>
                    <SelectItem value="paid">Paid only</SelectItem>
                    <SelectItem value="unpaid">Unpaid only</SelectItem>
                    <SelectItem value="claimed">Claimed only</SelectItem>
                    <SelectItem value="unclaimed">Unclaimed only</SelectItem>
                    <SelectItem value="excluded">Excluded only</SelectItem>
                </SelectContent>
            </Select>

            <Select value={expenseDateBasis} onValueChange={onExpenseDateBasisChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={HandCoinsIcon} aria-label="Expense date filter">
                    <SelectValue placeholder="Expense date" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="expense-date">Expenses by expense date</SelectItem>
                    <SelectItem value="paid-date">Expenses by paid date</SelectItem>
                </SelectContent>
            </Select>

            <Select value={categoryId} onValueChange={onCategoryIdChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={ListFilterIcon} aria-label="Category filter">
                    <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                            {category.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={currencyDisplayMode} onValueChange={onCurrencyDisplayModeChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={CurrencyDollarIcon} aria-label="Currency display filter">
                    <SelectValue placeholder="Currency mode" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="preferred">Preferred currency</SelectItem>
                    <SelectItem value="source">Source currencies</SelectItem>
                </SelectContent>
            </Select>

            <Select value={invoiceStatus} onValueChange={onInvoiceStatusChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={DocumentTextIcon} aria-label="Invoice status filter">
                    <SelectValue placeholder="Invoice status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="non-draft">Non-draft invoices</SelectItem>
                    <SelectItem value="all">All invoice statuses</SelectItem>
                    <SelectItem value="paid">Paid only</SelectItem>
                    <SelectItem value="unpaid">Unpaid only</SelectItem>
                    <SelectItem value="overdue">Overdue only</SelectItem>
                    <SelectItem value="draft">Draft only</SelectItem>
                </SelectContent>
            </Select>

            <Select value={incomeDateBasis} onValueChange={onIncomeDateBasisChange}>
                <SelectTrigger className={triggerClassName} leadingIcon={BanknotesIcon} aria-label="Income date filter">
                    <SelectValue placeholder="Income date" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="invoice-date">Income by invoice date</SelectItem>
                    <SelectItem value="paid-date">Income by paid date</SelectItem>
                </SelectContent>
            </Select>

            <div className={cn(
                'flex',
                isMobileLayout ? 'justify-stretch' : 'col-span-2 justify-end xl:col-span-1 xl:col-start-4'
            )}
            >
                <Button
                    variant="ghost"
                    className={cn(isMobileLayout ? triggerClassName : 'w-auto')}
                    leadingIcon={FunnelXIcon}
                    onClick={onResetFilters}
                >
                    Reset filters
                </Button>
            </div>
        </div>
    );
}

ReportFilters.propTypes = {
    businessId: PropTypes.string.isRequired,
    businessInfos: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        businessName: PropTypes.string,
        name: PropTypes.string,
        title: PropTypes.string,
    })).isRequired,
    clientId: PropTypes.string.isRequired,
    categories: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
    })).isRequired,
    categoryId: PropTypes.string.isRequired,
    clients: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
    })).isRequired,
    currencyDisplayMode: PropTypes.string.isRequired,
    customEnd: PropTypes.string.isRequired,
    customStart: PropTypes.string.isRequired,
    expenseDateBasis: PropTypes.string.isRequired,
    expenseStatus: PropTypes.string.isRequired,
    incomeDateBasis: PropTypes.string.isRequired,
    invoiceStatus: PropTypes.string.isRequired,
    onBusinessIdChange: PropTypes.func.isRequired,
    onClientIdChange: PropTypes.func.isRequired,
    onCategoryIdChange: PropTypes.func.isRequired,
    onCurrencyDisplayModeChange: PropTypes.func.isRequired,
    onCustomEndChange: PropTypes.func.isRequired,
    onCustomStartChange: PropTypes.func.isRequired,
    onExpenseDateBasisChange: PropTypes.func.isRequired,
    onExpenseStatusChange: PropTypes.func.isRequired,
    onIncomeDateBasisChange: PropTypes.func.isRequired,
    onInvoiceStatusChange: PropTypes.func.isRequired,
    onPeriodChange: PropTypes.func.isRequired,
    onProjectIdChange: PropTypes.func.isRequired,
    onResetFilters: PropTypes.func.isRequired,
    period: PropTypes.string.isRequired,
    periodOptions: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
    })).isRequired,
    projectId: PropTypes.string.isRequired,
    projects: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
    })).isRequired,
};

export default ReportFilters;
