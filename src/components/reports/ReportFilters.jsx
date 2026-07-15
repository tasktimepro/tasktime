import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    BanknotesIcon,
    BuildingOfficeIcon,
    ClipboardDocumentCheckIcon,
    DocumentTextIcon,
    FilterIcon,
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

    const advancedFiltersContent = (
        <div className="space-y-5">
            <div className={cn('grid gap-4', isMobileLayout ? 'grid-cols-1' : 'grid-cols-2')}>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Assignment
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Business</div>
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
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Client</div>
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
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Project</div>
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
                        </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Expense filters
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Expense status</div>
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
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Expense date basis</div>
                            <Select value={expenseDateBasis} onValueChange={onExpenseDateBasisChange}>
                                <SelectTrigger className={triggerClassName} leadingIcon={HandCoinsIcon} aria-label="Expense date filter">
                                    <SelectValue placeholder="Expense date" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="expense-date">Expenses by expense date</SelectItem>
                                    <SelectItem value="paid-date">Expenses by paid date</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Category</div>
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
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Invoices and totals
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Currency display</div>
                            <Select value={currencyDisplayMode} onValueChange={onCurrencyDisplayModeChange}>
                                <SelectTrigger className={triggerClassName} leadingIcon={CurrencyDollarIcon} aria-label="Currency display filter">
                                    <SelectValue placeholder="Currency mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="preferred">Preferred currency</SelectItem>
                                    <SelectItem value="source">Source currencies</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Invoice status</div>
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
                                    <SelectItem value="canceled">Canceled only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Income date basis</div>
                            <Select value={incomeDateBasis} onValueChange={onIncomeDateBasisChange}>
                                <SelectTrigger className={triggerClassName} leadingIcon={BanknotesIcon} aria-label="Income date filter">
                                    <SelectValue placeholder="Income date" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="invoice-date">Income by invoice date</SelectItem>
                                    <SelectItem value="paid-date">Income by paid date</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    className={cn('text-sm', isMobileLayout ? 'w-full justify-center' : 'w-auto')}
                    leadingIcon={FunnelXIcon}
                    onClick={onResetFilters}
                >
                    Reset filters
                </Button>
            </div>
        </div>
    );

    return (
        <div className={cn('grid gap-3', isMobileLayout ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_auto] items-start')}>
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
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(isMobileLayout ? 'w-full justify-center' : 'min-w-[11rem] justify-center')}
                        leadingIcon={FilterIcon}
                    >
                        More filters
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align={isMobileLayout ? 'start' : 'end'}
                    className={cn(
                        'p-4',
                        isMobileLayout
                            ? 'w-[min(92vw,28rem)] max-w-[calc(100vw-1rem)]'
                            : 'w-[38rem] max-w-[calc(100vw-3rem)]'
                    )}
                >
                    {advancedFiltersContent}
                </DropdownMenuContent>
            </DropdownMenu>
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
