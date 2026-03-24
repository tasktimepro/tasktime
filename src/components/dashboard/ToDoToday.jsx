/**
 * ToDoToday component - Shows overdue, today, and upcoming tasks.
 */

import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, ListTodoIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import CustomCheckbox from '../CustomCheckbox';
import StartDateBadge from '../task/StartDateBadge';
import TaskActionsMenu from '../task/TaskActionsMenu';
import TimeEntriesModal from '../TimeEntriesModal';
import ExpenseDueCard from '../expenses/ExpenseDueCard';
import { useTimers } from '../../hooks/useTimers';
import { useExpenses } from '../../hooks/useExpenses.ts';
import { useExpenseRecurrences } from '../../hooks/useExpenseRecurrences.ts';
import { useToast } from '../../hooks/useToast.ts';
import useIsMobileLayout from '../../hooks/useIsMobileLayout';
import { advanceByRepeat, buildExpenseFromRecurrence, getNextRecurringDate } from '@/utils/expenseUtils';
import { parseStoredDate, toStorageDate } from '../../utils/dateUtils.ts';
import { formatDurationWithSeconds } from '../../utils/dateUtils.ts';

/**
 * @param {Object} props
 * @param {Array} props.overdueTasks
 * @param {Array} props.tasksForToday
 * @param {Array} props.upcomingTasks
 * @param {Function} props.handleCompleteTask
 * @param {Function} props.getTaskCompletedStatus
 * @param {Function} props.renderTaskTitle
 * @param {Function} props.renderTaskControls
 * @param {Function} props.handleProjectTitleClick
 * @param {Function} props.onTaskTitleClick
 * @param {Function} props.onEditTask
 * @param {Function} props.onDeleteTask
 * @param {Function} props.onArchiveTask
 * @param {Function} props.openExpenseView
 */
const ToDoToday = ({
    overdueTasks,
    tasksForToday,
    upcomingTasks,
    handleCompleteTask,
    getTaskCompletedStatus,
    renderTaskTitle,
    renderTaskControls,
    handleProjectTitleClick,
    onTaskTitleClick,
    onEditTask,
    onDeleteTask,
    onArchiveTask,
    openExpenseView
}) => {
    const { getTimerForTask } = useTimers();
    const { expenses, markAsPaid } = useExpenses();
    const { recurrences } = useExpenseRecurrences();
    const { showError, showSuccess } = useToast();
    const isMobileLayout = useIsMobileLayout();
    const [showUpcomingTasks, setShowUpcomingTasks] = useState(false);
    const [showUpcomingExpenses, setShowUpcomingExpenses] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTimeEntriesModal, setShowTimeEntriesModal] = useState(false);
    const todayStr = useMemo(() => toStorageDate(new Date()) || '', []);

    // Combine and deduplicate tasks (a task might be both overdue and planned for today)
    const combinedTasks = [...overdueTasks, ...tasksForToday].reduce((acc, current) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    const sortedTasks = combinedTasks.sort((a, b) => {
        const aCompleted = getTaskCompletedStatus(a);
        const bCompleted = getTaskCompletedStatus(b);

        if (aCompleted === bCompleted) return 0;
        return aCompleted ? 1 : -1;
    });
    const incompleteCount = combinedTasks.filter((task) => !getTaskCompletedStatus(task)).length;

    const recurrencesById = useMemo(() => {
        const map = new Map();
        recurrences.forEach((recurrence) => {
            map.set(recurrence.id, recurrence);
        });
        return map;
    }, [recurrences]);

    const { overdueExpenses, todayExpenses, upcomingExpenses } = useMemo(() => {
        const todayDate = parseStoredDate(todayStr);
        if (!todayDate) {
            return { overdueExpenses: [], todayExpenses: [], upcomingExpenses: [] };
        }

        const upcomingEnd = new Date(todayDate);
        upcomingEnd.setDate(upcomingEnd.getDate() + 7);
        const upcomingStart = new Date(todayDate);
        upcomingStart.setDate(upcomingStart.getDate() + 1);

        const upcomingStartStr = toStorageDate(upcomingStart) || '';
        const upcomingEndStr = toStorageDate(upcomingEnd) || '';

        const isManualExpense = (expense) => (
            expense.paymentMode !== 'auto' || expense.amountType === 'variable'
        );

        const unpaidManual = expenses.filter((expense) => (
            expense.paymentStatus === 'unpaid' && isManualExpense(expense)
        ));
        const paidToday = expenses.filter((expense) => (
            expense.paymentStatus === 'paid'
            && expense.paidOn === todayStr
            && isManualExpense(expense)
        ));
        const datesByRecurrence = new Map();
        expenses.forEach((expense) => {
            if (!expense.recurrenceId) return;
            if (!datesByRecurrence.has(expense.recurrenceId)) {
                datesByRecurrence.set(expense.recurrenceId, new Set());
            }
            datesByRecurrence.get(expense.recurrenceId).add(expense.date);
        });

        const groups = {
            overdueExpenses: [],
            todayExpenses: [],
            upcomingExpenses: [],
        };

        unpaidManual.forEach((expense) => {
            const expenseDate = parseStoredDate(expense.date);
            if (!expenseDate) return;

            if (expenseDate < todayDate) {
                groups.overdueExpenses.push(expense);
                return;
            }

            if (expenseDate.toDateString() === todayDate.toDateString()) {
                groups.todayExpenses.push(expense);
                return;
            }

            if (expenseDate > todayDate && expenseDate <= upcomingEnd) {
                groups.upcomingExpenses.push(expense);
            }
        });

        expenses.forEach((expense) => {
            if (expense.paymentMode !== 'auto' || expense.amountType === 'variable') return;
            const expenseDate = parseStoredDate(expense.date);
            if (!expenseDate) return;
            if (expenseDate > todayDate && expenseDate <= upcomingEnd) {
                groups.upcomingExpenses.push(expense);
            }
        });

        const previewExpenses = recurrences
            .filter((recurrence) => recurrence.active)
            .map((recurrence) => {
                if (!upcomingStartStr || !upcomingEndStr) return null;

                const baseStart = recurrence.lastGeneratedDate
                    ? advanceByRepeat(
                        recurrence.lastGeneratedDate,
                        recurrence.repeat,
                        recurrence.monthlyType,
                        recurrence.monthlyDay
                    )
                    : recurrence.startDate;

                const nextDate = getNextRecurringDate({
                    startDate: baseStart,
                    repeat: recurrence.repeat,
                    monthlyType: recurrence.monthlyType,
                    monthlyDay: recurrence.monthlyDay,
                    endDate: recurrence.endDate,
                    fromDate: upcomingStartStr,
                });

                if (!nextDate) return null;
                const nextParsed = parseStoredDate(nextDate);
                if (!nextParsed || nextParsed > upcomingEnd) return null;

                const existingDates = datesByRecurrence.get(recurrence.id);
                if (existingDates?.has(nextDate)) {
                    return null;
                }

                const preview = buildExpenseFromRecurrence(recurrence, nextDate);
                return {
                    ...preview,
                    id: `preview-${recurrence.id}-${nextDate}`,
                    amount: recurrence.amountType === 'variable'
                        ? (recurrence.amount || 0)
                        : recurrence.amount,
                    isPreview: true,
                };
            })
            .filter(Boolean);

        previewExpenses.forEach((expense) => {
            groups.upcomingExpenses.push(expense);
        });

        paidToday.forEach((expense) => {
            groups.todayExpenses.push(expense);
        });

        const sortByDate = (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime();

        groups.overdueExpenses.sort(sortByDate);
        groups.todayExpenses.sort((a, b) => {
            if (a.paymentStatus === b.paymentStatus) {
                return sortByDate(a, b);
            }
            return a.paymentStatus === 'unpaid' ? -1 : 1;
        });
        groups.upcomingExpenses.sort(sortByDate);

        return groups;
    }, [expenses, recurrences, todayStr]);

    const handleOpenTimeEntries = (task) => {
        setSelectedTask(task);
        setShowTimeEntriesModal(true);
    };

    const closeTimeEntries = () => {
        setShowTimeEntriesModal(false);
        setSelectedTask(null);
    };

    const renderTaskRow = (task) => {
        const timer = getTimerForTask(task.id, task.projectId);
        const isTimerActive = !!timer && timer.taskId === task.id;
        const shouldDisable = !!timer && !timer.isPaused && !isTimerActive;
        const hideActions = !!timer;
        const isCompleted = getTaskCompletedStatus(task);
        const isOverdue = !isCompleted && (
            Boolean(task.recurringStatus?.isOverdue) ||
            (task.startDate && task.startDate < todayStr)
        );
        const canOpenDetails = Boolean(onTaskTitleClick);

        const dateBadge = (
            <StartDateBadge
                startDate={task.startDate}
                recurring={task.recurring}
                completed={isCompleted}
                recurringOverdue={Boolean(task.recurringStatus?.isOverdue)}
            />
        );

        const dateBadgeNode = isOverdue && canOpenDetails ? (
            <button
                type="button"
                onClick={() => onTaskTitleClick(task)}
                className="cursor-pointer"
                title="Open task details"
                aria-label="Open task details"
            >
                {dateBadge}
            </button>
        ) : (
            dateBadge
        );

        return (
            <div key={task.id} className={`px-2 py-2 hover:bg-muted sm:px-3 sm:py-2.5 ${shouldDisable ? 'opacity-50' : ''}`}>
                {isMobileLayout ? (
                    <div className="flex items-start gap-3">
                        <CustomCheckbox
                            checked={isCompleted}
                            onChange={(checked) => handleCompleteTask(task, checked)}
                            disabled={shouldDisable}
                        />
                        <div className="flex-1 min-w-0 space-y-1.5 overflow-hidden" data-testid={`task-row-content-${task.id}`}>
                            {renderTaskTitle(task, isCompleted)}
                            <div
                                className="flex w-full flex-wrap items-center justify-end gap-2"
                                data-testid={`task-row-secondary-${task.id}`}
                            >
                                <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                                    {dateBadgeNode}
                                    {(task.recentTime || 0) > 0 && (
                                        <div className={`text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                            {formatDurationWithSeconds(task.recentTime || 0)}
                                        </div>
                                    )}
                                </div>
                                {(!shouldDisable || !hideActions) && (
                                    <div
                                        className="flex flex-wrap items-center justify-end gap-1"
                                        data-testid={`task-row-actions-${task.id}`}
                                    >
                                        {renderTaskControls(task, shouldDisable)}
                                        {!hideActions && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    title="Add time entry"
                                                    onClick={() => handleOpenTimeEntries(task)}
                                                >
                                                    <ClockIcon className="h-5 w-5" />
                                                </Button>
                                                <TaskActionsMenu
                                                    task={task}
                                                    onEdit={onEditTask}
                                                    onDelete={onDeleteTask}
                                                    onArchive={onArchiveTask}
                                                />
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <CustomCheckbox
                            checked={isCompleted}
                            onChange={(checked) => handleCompleteTask(task, checked)}
                            disabled={shouldDisable}
                        />
                        <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                            {renderTaskTitle(task, isCompleted)}
                        </div>
                        {dateBadgeNode}
                        {(task.recentTime || 0) > 0 && (
                            <div className={`flex-shrink-0 text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                {formatDurationWithSeconds(task.recentTime || 0)}
                            </div>
                        )}
                        {(!shouldDisable || !hideActions) && (
                            <div className="flex flex-shrink-0 space-x-1">
                                {renderTaskControls(task, shouldDisable)}
                                {!hideActions && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            title="Add time entry"
                                            onClick={() => handleOpenTimeEntries(task)}
                                        >
                                            <ClockIcon className="h-5 w-5" />
                                        </Button>
                                        <TaskActionsMenu
                                            task={task}
                                            onEdit={onEditTask}
                                            onDelete={onDeleteTask}
                                            onArchive={onArchiveTask}
                                        />
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const handleMarkExpensePaid = (expense) => {
        try {
            markAsPaid(expense.id);
            showSuccess('Expense marked as paid');
        } catch (error) {
            showError(error?.message || 'Unable to mark expense as paid');
        }
    };

    const renderExpenseRow = (expense, options = {}) => (
        <ExpenseDueCard
            key={expense.id}
            expense={expense}
            isOverdue={options.isOverdue}
            isToday={options.isToday}
            isPreview={expense.isPreview}
            recurrence={expense.recurrenceId ? recurrencesById.get(expense.recurrenceId) : null}
            onView={() => openExpenseView?.(expense)}
                onMarkPaid={expense.isPreview
                    || (expense.paymentMode === 'auto' && expense.amountType !== 'variable')
                    || expense.paymentStatus === 'paid'
                ? undefined
                : () => handleMarkExpensePaid(expense)}
        />
    );

    const overdueTaskItems = sortedTasks.filter((task) => task.startDate && task.startDate < todayStr);
    const todayTaskItems = sortedTasks.filter((task) => !task.startDate || task.startDate >= todayStr);
    const overdueIncompleteTaskItems = overdueTaskItems.filter((task) => !getTaskCompletedStatus(task));
    const overdueCompletedTaskItems = overdueTaskItems.filter((task) => getTaskCompletedStatus(task));
    const todayIncompleteTaskItems = todayTaskItems.filter((task) => !getTaskCompletedStatus(task));
    const todayCompletedTaskItems = todayTaskItems.filter((task) => getTaskCompletedStatus(task));
    const unpaidTodayExpenses = todayExpenses.filter((expense) => expense.paymentStatus !== 'paid');
    const paidTodayExpenses = todayExpenses.filter((expense) => expense.paymentStatus === 'paid');

    return (
        <Card>
            <CardHeader className="px-3 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-2.5">
                <CardTitle className="flex items-center text-lg">
                    <ListTodoIcon className="status-info-text-strong mr-2 h-5 w-5" />
                    To Do Today ({incompleteCount})
                </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2.5 pt-0 sm:px-5 sm:pb-4">
                <div className="divide-y divide-border">
                    {combinedTasks.length > 0 || overdueExpenses.length > 0 || todayExpenses.length > 0 ? (
                        <div className="divide-y divide-border py-0.5">
                            {overdueIncompleteTaskItems.map(renderTaskRow)}
                            {overdueExpenses.map((expense) => renderExpenseRow(expense, { isOverdue: true }))}
                            {todayIncompleteTaskItems.map(renderTaskRow)}
                            {unpaidTodayExpenses.map((expense) => renderExpenseRow(expense, { isToday: true }))}
                            {overdueCompletedTaskItems.map(renderTaskRow)}
                            {todayCompletedTaskItems.map(renderTaskRow)}
                            {paidTodayExpenses.map((expense) => renderExpenseRow(expense, { isToday: true }))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={ListTodoIcon}
                            title="Nothing due today"
                            description="You're all caught up."
                            className="pt-0 pb-6"
                        />
                    )}

                    {upcomingTasks.length > 0 && (
                        <div className="py-1 sm:py-1.5">
                            <button
                                onClick={() => setShowUpcomingTasks(!showUpcomingTasks)}
                                className="flex w-full items-center py-2 text-left text-sm font-medium text-foreground transition-colors hover:text-foreground cursor-pointer"
                            >
                                {showUpcomingTasks ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                <span>Upcoming tasks ({upcomingTasks.length})</span>
                            </button>

                            {showUpcomingTasks && (
                                <div className="divide-y divide-border">
                                    {upcomingTasks.map(renderTaskRow)}
                                </div>
                            )}
                        </div>
                    )}

                    {upcomingExpenses.length > 0 && (
                        <div className="py-1 sm:py-1.5">
                            <button
                                onClick={() => setShowUpcomingExpenses(!showUpcomingExpenses)}
                                className="flex w-full items-center py-2 text-left text-sm font-medium text-foreground transition-colors hover:text-foreground cursor-pointer"
                            >
                                {showUpcomingExpenses ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-1" />
                                ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-1" />
                                )}
                                <span>Upcoming expenses ({upcomingExpenses.length})</span>
                            </button>

                            {showUpcomingExpenses && (
                                <div className="divide-y divide-border">
                                    {upcomingExpenses.map((expense) => renderExpenseRow(expense))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>

            {selectedTask && (
                <TimeEntriesModal
                    isOpen={showTimeEntriesModal}
                    onClose={closeTimeEntries}
                    task={selectedTask}
                />
            )}
        </Card>
    );
};

export default ToDoToday;
