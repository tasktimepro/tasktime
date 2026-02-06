/**
 * ExpenseFilters component - Filter controls for expenses list
 */

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CustomCheckbox from '@/components/CustomCheckbox';

const ExpenseFilters = ({
    search,
    onSearchChange,
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input
                    placeholder="Search expenses..."
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
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

            <div className="flex flex-wrap items-center gap-4">
                <CustomCheckbox
                    checked={personalOnly}
                    onChange={onPersonalToggle}
                    label="Personal"
                />
                <CustomCheckbox
                    checked={billableOnly}
                    onChange={onBillableToggle}
                    label="Billable"
                />
                <CustomCheckbox
                    checked={recurringOnly}
                    onChange={onRecurringToggle}
                    label="Recurring"
                />
                <Select value={paidStatus} onValueChange={onPaidStatusChange}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Paid status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={billedStatus} onValueChange={onBilledStatusChange}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Billed status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="billed">Billed</SelectItem>
                        <SelectItem value="unbilled">Unbilled</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};

export default ExpenseFilters;
