import { Fragment, useState } from 'react';
import { CalendarDaysIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

const VISIBLE_UPCOMING_ITEMS = 5;

/** Show the existing next-week occurrences using the same actions as Today. */
export default function Upcoming({ tasks, expenses, renderTask, renderExpense }) {
    const [expanded, setExpanded] = useState(false);
    const items = [
        ...tasks.map(task => ({ kind: 'task', date: task.startDate || '', value: task })),
        ...expenses.map(expense => ({ kind: 'expense', date: expense.date, value: expense })),
    ].sort((left, right) => left.date.localeCompare(right.date));
    const visible = expanded ? items : items.slice(0, VISIBLE_UPCOMING_ITEMS);

    return (
        <Card role="region" aria-labelledby="dashboard-upcoming-title" className="flex h-full min-w-0 flex-col shadow-sm">
            <CardHeader className="px-3 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-2.5">
                <div className="flex items-center justify-between gap-2">
                    <h2 id="dashboard-upcoming-title" className="flex items-center text-lg font-semibold">
                        <CalendarDaysIcon className="status-info-text-strong mr-2 h-5 w-5" />
                        Upcoming
                    </h2>
                    <span className="text-xs text-muted-foreground">Next 7 days</span>
                </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col px-3 pb-3 pt-0 sm:px-5 sm:pb-4">
                {items.length ? (
                    <div id="dashboard-upcoming-items" className="divide-y divide-border">
                        {visible.map(item => <Fragment key={`${item.kind}-${item.value.id}`}>{item.kind === 'task'
                            ? renderTask(item.value, { compact: true })
                            : renderExpense(item.value, { compact: true })}</Fragment>)}
                    </div>
                ) : (
                    <EmptyState icon={CalendarDaysIcon} iconSize="sm" title="Nothing coming up" className="my-auto py-6" />
                )}
                {items.length > VISIBLE_UPCOMING_ITEMS && (
                    <Button variant="ghost" size="sm" className="mt-2 w-full" aria-expanded={expanded} aria-controls="dashboard-upcoming-items" onClick={() => setExpanded(!expanded)}>
                        {expanded ? 'Show less' : `Show all ${items.length} upcoming items`}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
