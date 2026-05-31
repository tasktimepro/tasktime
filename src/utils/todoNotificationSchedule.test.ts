import { describe, expect, it } from 'vitest';
import { buildTodoNotificationSchedules } from './todoNotificationSchedule';

const baseDate = new Date(2026, 4, 30, 10, 0, 0, 0);

describe('todoNotificationSchedule', () => {
    it('builds date-level digest rows for due tasks and expenses', () => {
        const schedules = buildTodoNotificationSchedules({
            startDate: baseDate,
            horizonDays: 7,
            notificationTime: '09:30',
            timezone: 'Europe/Ljubljana',
            tasks: [
                { id: 'task-1', title: 'Task', startDate: '2026-06-01', completed: false },
                { id: 'task-2', title: 'Done', startDate: '2026-06-02', completed: true },
            ],
            expenses: [
                { id: 'expense-1', title: 'Expense', date: '2026-06-01', paymentStatus: 'unpaid', paymentMode: 'manual', amountType: 'fixed' },
                { id: 'expense-2', title: 'Paid', date: '2026-06-03', paymentStatus: 'paid', paymentMode: 'manual', amountType: 'fixed' },
            ],
            expenseRecurrences: [],
        });

        expect(schedules).toHaveLength(1);
        expect(schedules[0]).toMatchObject({
            scheduleKey: 'todo-today:2026-06-01',
            type: 'todo_today',
            localDate: '2026-06-01',
            timezone: 'Europe/Ljubljana',
        });
    });

    it('includes recurring tasks and skips completed or skipped occurrences', () => {
        const schedules = buildTodoNotificationSchedules({
            startDate: baseDate,
            horizonDays: 10,
            tasks: [
                {
                    id: 'weekly',
                    title: 'Weekly',
                    startDate: '2026-05-01',
                    recurring: { type: 'weekly', weeklyDays: [1] },
                    completedDatesByYear: { '2026': { '6': [1] } },
                },
                {
                    id: 'skipped',
                    title: 'Skipped',
                    startDate: '2026-05-01',
                    recurring: { type: 'weekly', weeklyDays: [2] },
                    skipUntilNextRecurring: true,
                    skippedOccurrenceDate: '2026-06-02',
                },
                {
                    id: 'monthly',
                    title: 'Monthly',
                    startDate: '2026-05-01',
                    recurring: { type: 'monthly', monthlyType: 'specific', monthlyDay: 3 },
                },
            ],
            expenses: [],
            expenseRecurrences: [],
        });

        expect(schedules.map((schedule) => schedule.localDate)).toEqual(['2026-06-03', '2026-06-08', '2026-06-09']);
    });

    it('includes recurring expense previews unless an instance already exists', () => {
        const schedules = buildTodoNotificationSchedules({
            startDate: baseDate,
            horizonDays: 40,
            tasks: [],
            expenses: [
                {
                    id: 'existing',
                    title: 'Existing',
                    date: '2026-06-15',
                    recurrenceId: 'rent',
                    paymentStatus: 'unpaid',
                    paymentMode: 'manual',
                    amountType: 'fixed',
                },
            ],
            expenseRecurrences: [
                {
                    id: 'rent',
                    title: 'Rent',
                    currency: 'EUR',
                    amount: 100,
                    amountType: 'fixed',
                    paymentMode: 'manual',
                    repeat: 'monthly',
                    monthlyType: 'specific',
                    monthlyDay: 15,
                    startDate: '2026-06-15',
                    isPersonal: false,
                    billable: false,
                    isTaxExempt: false,
                    active: true,
                },
            ],
        });

        expect(schedules.map((schedule) => schedule.localDate)).toEqual(['2026-06-15']);
    });

    it('excludes automatic fixed expenses because they do not need action', () => {
        const schedules = buildTodoNotificationSchedules({
            startDate: baseDate,
            horizonDays: 40,
            tasks: [],
            expenses: [
                { id: 'auto', title: 'Auto', date: '2026-06-01', paymentStatus: 'unpaid', paymentMode: 'auto', amountType: 'fixed' },
                { id: 'variable', title: 'Variable', date: '2026-06-02', paymentStatus: 'unpaid', paymentMode: 'auto', amountType: 'variable' },
            ],
            expenseRecurrences: [],
        });

        expect(schedules.map((schedule) => schedule.localDate)).toEqual(['2026-06-02']);
    });
});
