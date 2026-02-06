/**
 * ExpenseFilters component - Filter controls for expenses list
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FilterIcon } from '@/components/ui/icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CustomCheckbox from '@/components/CustomCheckbox';

const ExpenseFilters = ({
    search,
    onSearchChange,
    period,
    onPeriodChange,
    periodOptions,
    customStart,
    customEnd,
    onCustomStartChange,
    onCustomEndChange,
    clients,
    projects,
    clientId,
    projectId,
    onClientChange,
    onProjectChange,
    personalOnly,
    billableOnly,
    recurringOnly,
    onPersonalToggle,
    onBillableToggle,
    onRecurringToggle,
    paidStatus,
    billedStatus,
    onPaidStatusChange,
    onBilledStatusChange,
}) => {

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                <Input
                    placeholder="Search expenses..."
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
                <Select value={period} onValueChange={onPeriodChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                        {periodOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" leadingIcon={FilterIcon}>
                            More filters
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[320px] p-4" align="end">
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Type
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <CustomCheckbox
                                        checked={personalOnly}
                                        onChange={onPersonalToggle}
                                        label="Personal"
                                    />
                                    <CustomCheckbox
                                        checked={recurringOnly}
                                        onChange={onRecurringToggle}
                                        label="Recurring"
                                    />
                                    {!personalOnly && (
                                        <CustomCheckbox
                                            checked={billableOnly}
                                            onChange={onBillableToggle}
                                            label="Billable"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Assignment
                                </div>
                                {!personalOnly && (
                                    <div className="space-y-1">
                                        <div className="text-xs font-medium text-muted-foreground">Client</div>
                                        <Select value={clientId} onValueChange={onClientChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All clients" />
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
                                )}
                                <div className="space-y-1">
                                    <div className="text-xs font-medium text-muted-foreground">Project</div>
                                    <Select value={projectId} onValueChange={onProjectChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All projects" />
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

                            <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Status
                                </div>
                                <div className="space-y-1">
                                    <div className="text-xs font-medium text-muted-foreground">Paid status</div>
                                    <Select value={paidStatus} onValueChange={onPaidStatusChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Paid status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            <SelectItem value="paid">Paid</SelectItem>
                                            <SelectItem value="unpaid">Unpaid</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {!personalOnly && billableOnly && (
                                    <div className="space-y-1">
                                        <div className="text-xs font-medium text-muted-foreground">Billed status</div>
                                        <Select value={billedStatus} onValueChange={onBilledStatusChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Billed status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="billed">Billed</SelectItem>
                                                <SelectItem value="unbilled">Unbilled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {period === 'custom' && (
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">From</span>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(event) => onCustomStartChange(event.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">To</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(event) => onCustomEndChange(event.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpenseFilters;
