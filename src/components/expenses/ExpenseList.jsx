/**
 * ExpenseList component - List of expenses
 */

import { EmptyState } from '@/components/ui/empty-state';
import { HandCoinsIcon, PlusIcon } from '@/components/ui/icons';
import ExpenseRow from './ExpenseRow';

const ExpenseList = ({
    expenses,
    expenseCategoriesById = new Map(),
    clientsById,
    projectsById,
    onView,
    onEdit,
    onTogglePaid,
    compact = false,
    hasAnyExpenses = false,
    hasActiveFilters = false,
    onCreateFirst,
    showProjectContext = false,
}) => {

    if (!expenses.length) {
        const title = hasAnyExpenses
            ? (hasActiveFilters ? 'No expenses match your filters' : 'No expenses in this period')
            : 'No expenses yet';
        const description = hasAnyExpenses
            ? (hasActiveFilters
                ? 'Try adjusting filters or date range to see other expenses.'
                : 'Try a different time range to see other expenses.')
            : 'Create your first expense to start tracking spending.';
        const shouldShowCreate = !hasAnyExpenses && typeof onCreateFirst === 'function';

        return (
            <EmptyState
                icon={HandCoinsIcon}
                title={title}
                description={description}
                actionLabel={shouldShowCreate ? 'Create First Expense' : undefined}
                actionIcon={shouldShowCreate ? PlusIcon : undefined}
                onAction={shouldShowCreate ? onCreateFirst : undefined}
            />
        );
    }

    return (
        <div className="space-y-3">
            {expenses.map((expense) => {
                const client = clientsById.get(expense.clientId || '') || null;
                const project = projectsById.get(expense.projectId || '') || null;
                const category = expense.categoryId ? (expenseCategoriesById.get(expense.categoryId) || null) : null;

                return (
                    <ExpenseRow
                        key={expense.id}
                        expense={expense}
                        category={category}
                        client={client}
                        project={project}
                        compact={compact}
                        onView={onView}
                        onEdit={onEdit}
                        onTogglePaid={onTogglePaid}
                        showProjectContext={showProjectContext}
                    />
                );
            })}
        </div>
    );
};

export default ExpenseList;
