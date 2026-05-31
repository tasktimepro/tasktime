import { addDays } from 'date-fns';
import type { Expense, ExpenseRecurrence, Task } from '@/stores/yjs/types';
import { advanceByRepeat, getNextRecurringDate } from '@/utils/expenseUtils';
import { parseStoredDate, toStorageDate } from '@/utils/dateUtils';
import { isRecurringTaskDueOnDate } from '@/utils/recurringUtils';
import { isRecurringCompletedOnDate } from '@/utils/recurringCompletionUtils';

export type TodoNotificationSchedule = {
    scheduleKey: string;
    type: 'todo_today';
    localDate: string;
    dueAt: string;
    timezone: string;
};

export type BuildTodoNotificationSchedulesParams = {
    tasks: Task[];
    expenses: Expense[];
    expenseRecurrences: ExpenseRecurrence[];
    startDate?: Date;
    horizonDays?: number;
    notificationTime?: string | null;
    timezone?: string;
};

const DEFAULT_HORIZON_DAYS = 400;
const DEFAULT_NOTIFICATION_TIME = '09:00';

function getTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

function parseNotificationTime(value?: string | null): { hours: number; minutes: number } {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
        return { hours: 9, minutes: 0 };
    }

    const [hours, minutes] = value.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return { hours: 9, minutes: 0 };
    }

    return { hours, minutes };
}

function buildDueAt(localDate: string, notificationTime?: string | null): string | null {
    const parsed = parseStoredDate(localDate);
    if (!parsed) {
        return null;
    }

    const { hours, minutes } = parseNotificationTime(notificationTime || DEFAULT_NOTIFICATION_TIME);
    parsed.setHours(hours, minutes, 0, 0);

    return parsed.toISOString();
}

function isActionableExpense(expense: Expense): boolean {
    if (expense.paymentStatus === 'paid') {
        return false;
    }

    return expense.paymentMode !== 'auto' || expense.amountType === 'variable';
}

function isRecurringExpenseActionable(recurrence: ExpenseRecurrence): boolean {
    return recurrence.paymentMode !== 'auto' || recurrence.amountType === 'variable';
}

function addDigestDate(dates: Set<string>, dateValue: string | null | undefined, startDate: string, endDate: string): void {
    if (!dateValue || dateValue < startDate || dateValue > endDate) {
        return;
    }

    dates.add(dateValue);
}

function getTaskStartDate(task: Task): string | null {
    if (task.startDate) {
        return task.startDate;
    }

    return typeof task.createdAt === 'number'
        ? toStorageDate(task.createdAt)
        : null;
}

function isRecurringTaskSkippedForDate(task: Task, dateValue: string): boolean {
    return Boolean(
        task.skipUntilNextRecurring
        && task.skippedOccurrenceDate
        && task.skippedOccurrenceDate === dateValue
    );
}

function addTaskDigestDates(dates: Set<string>, tasks: Task[], startDate: Date, endDate: Date): void {
    const startStr = toStorageDate(startDate);
    const endStr = toStorageDate(endDate);
    if (!startStr || !endStr) {
        return;
    }

    tasks.forEach((task) => {
        if (!task || task.archived) return;

        if (!task.recurring) {
            if (task.completed) return;
            addDigestDate(dates, task.startDate, startStr, endStr);
            return;
        }

        const recurringStartStr = getTaskStartDate(task);

        for (
            let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            cursor <= endDate;
            cursor = addDays(cursor, 1)
        ) {
            const cursorStr = toStorageDate(cursor);
            if (!cursorStr) continue;
            if (recurringStartStr && cursorStr < recurringStartStr) continue;
            if (!isRecurringTaskDueOnDate(cursor, task.recurring)) continue;
            if (isRecurringTaskSkippedForDate(task, cursorStr)) continue;
            if (isRecurringCompletedOnDate(task.completedDatesByYear, cursorStr)) continue;

            dates.add(cursorStr);
        }
    });
}

function addExpenseDigestDates(dates: Set<string>, expenses: Expense[], startDate: string, endDate: string): Map<string, Set<string>> {
    const datesByRecurrence = new Map<string, Set<string>>();

    expenses.forEach((expense) => {
        if (expense.recurrenceId) {
            if (!datesByRecurrence.has(expense.recurrenceId)) {
                datesByRecurrence.set(expense.recurrenceId, new Set());
            }
            datesByRecurrence.get(expense.recurrenceId)?.add(expense.date);
        }

        if (!isActionableExpense(expense)) {
            return;
        }

        addDigestDate(dates, expense.date, startDate, endDate);
    });

    return datesByRecurrence;
}

function addRecurringExpenseDigestDates(
    dates: Set<string>,
    recurrences: ExpenseRecurrence[],
    datesByRecurrence: Map<string, Set<string>>,
    startDate: string,
    endDate: string,
): void {
    recurrences.forEach((recurrence) => {
        if (!recurrence.active || !isRecurringExpenseActionable(recurrence)) {
            return;
        }

        let fromDate = startDate;
        let safetyCounter = 0;

        while (safetyCounter < 32) {
            safetyCounter += 1;

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
                fromDate,
            });

            if (!nextDate || nextDate > endDate) {
                break;
            }

            if (!datesByRecurrence.get(recurrence.id)?.has(nextDate)) {
                dates.add(nextDate);
            }

            fromDate = advanceByRepeat(nextDate, recurrence.repeat, recurrence.monthlyType, recurrence.monthlyDay);
            if (fromDate <= nextDate) {
                break;
            }
        }
    });
}

export function buildTodoNotificationSchedules({
    tasks,
    expenses,
    expenseRecurrences,
    startDate = new Date(),
    horizonDays = DEFAULT_HORIZON_DAYS,
    notificationTime = DEFAULT_NOTIFICATION_TIME,
    timezone = getTimezone(),
}: BuildTodoNotificationSchedulesParams): TodoNotificationSchedule[] {
    const startStr = toStorageDate(startDate);
    const endDate = addDays(startDate, horizonDays);
    const endStr = toStorageDate(endDate);
    if (!startStr || !endStr) {
        return [];
    }

    const digestDates = new Set<string>();
    addTaskDigestDates(digestDates, tasks, startDate, endDate);
    const datesByRecurrence = addExpenseDigestDates(digestDates, expenses, startStr, endStr);
    addRecurringExpenseDigestDates(digestDates, expenseRecurrences, datesByRecurrence, startStr, endStr);

    return Array.from(digestDates)
        .sort((left, right) => left.localeCompare(right))
        .map((localDate) => {
            const dueAt = buildDueAt(localDate, notificationTime);
            if (!dueAt) {
                return null;
            }

            return {
                scheduleKey: `todo-today:${localDate}`,
                type: 'todo_today' as const,
                localDate,
                dueAt,
                timezone,
            };
        })
        .filter((schedule): schedule is TodoNotificationSchedule => Boolean(schedule));
}

export function getTodoNotificationReplaceHorizonUntil(startDate = new Date(), horizonDays = DEFAULT_HORIZON_DAYS): string {
    return toStorageDate(addDays(startDate, horizonDays)) || '';
}
