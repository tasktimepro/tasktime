/**
 * ExpenseList component - List of expenses
 */

import { EmptyState } from '@/components/ui/empty-state';
import { HandCoinsIcon } from '@/components/ui/icons';
import ExpenseRow from './ExpenseRow';

const ExpenseList = ({
    expenses,
    clientsById,
    projectsById,
    onEdit,
    onTogglePaid,
    compact = false,
}) => {

    if (!expenses.length) {
        return (
            <EmptyState
                icon={HandCoinsIcon}
                title="No expenses yet"
                description="Create your first expense to start tracking spending."
            />
        );
    }

    return (
        <div className="space-y-3">
            {expenses.map((expense) => {
                const client = clientsById.get(expense.clientId || '') || null;
                const project = projectsById.get(expense.projectId || '') || null;

                return (
                    <ExpenseRow
                        key={expense.id}
                        expense={expense}
                        client={client}
                        project={project}
                        compact={compact}
                        onEdit={onEdit}
                        onTogglePaid={onTogglePaid}
                    />
                );
            })}
        </div>
    );
};

export default ExpenseList;
