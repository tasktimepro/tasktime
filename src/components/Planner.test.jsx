import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Planner from './Planner';

const plannerState = vi.hoisted(() => ({
    current: {
        weekStart: new Date('2026-03-23T00:00:00.000Z'),
        weekDays: [],
    },
}));

const updateUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useUrlState', () => ({
    useUrlState: () => ({
        urlParams: { year: '2026', week: '13' },
        updateUrl: updateUrlMock,
        navigateToProject: vi.fn(),
        navigateToClient: vi.fn(),
    }),
}));

vi.mock('@/hooks/usePlannerItems', () => ({
    usePlannerItems: () => plannerState.current,
}));

vi.mock('@/hooks/usePlannerAttachments', () => ({
    usePlannerAttachments: () => ({
        attachments: [],
        createAttachment: vi.fn(),
        updateAttachment: vi.fn(),
        deleteAttachment: vi.fn(),
        isAttached: vi.fn(() => false),
    }),
}));

vi.mock('@/hooks/useExpenses', () => ({
    useExpenses: () => ({ markAsPaid: vi.fn() }),
}));

vi.mock('@/hooks/useDayRollover', () => ({
    useTodayDate: () => new Date('2026-03-24T09:00:00.000Z'),
}));

vi.mock('@/hooks/usePreferences', () => ({
    usePreferences: () => ({ preferences: { currency: 'EUR', weekStartsOn: 1 } }),
}));

vi.mock('@/hooks/useWeeklyGoals', () => ({
    useWeeklyGoals: () => ({
        weeklyGoals: {},
        hasGoals: false,
    }),
}));

vi.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        showSuccess: vi.fn(),
        showError: vi.fn(),
    }),
}));

vi.mock('@/components/planner/index.js', () => ({
    WeekHeader: () => <div>Week Header</div>,
    WeekAddPopover: ({ children }) => children,
    DayColumn: () => null,
    EntityPickerModal: () => null,
    DailyGoalModal: () => null,
    WeeklyGoalModal: () => null,
    MobileDaySelector: ({ weekDays, selectedDateStr, onSelectDay }) => (
        <div>
            <div data-testid="selected-chip">{selectedDateStr}</div>
            {weekDays.map((day) => (
                <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => onSelectDay(day.dateStr)}
                >
                    {day.dateStr}
                </button>
            ))}
        </div>
    ),
    MobileDayCard: ({ dateStr }) => <div data-testid="selected-day">{dateStr}</div>,
}));

describe('Planner', () => {
    const setMatchMedia = (matches) => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(() => ({
                matches,
                media: '(max-width: 767px)',
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    };

    const buildWeekDays = () => ([
        { date: new Date('2026-03-23T00:00:00.000Z'), dateStr: '2026-03-23', isToday: false, items: [], totalTimeMs: 0, totalEarnings: 0, dailyGoal: null, dayOfWeek: 1 },
        { date: new Date('2026-03-24T00:00:00.000Z'), dateStr: '2026-03-24', isToday: true, items: [], totalTimeMs: 0, totalEarnings: 0, dailyGoal: null, dayOfWeek: 2 },
        { date: new Date('2026-03-25T00:00:00.000Z'), dateStr: '2026-03-25', isToday: false, items: [], totalTimeMs: 0, totalEarnings: 0, dailyGoal: null, dayOfWeek: 3 },
        { date: new Date('2026-03-26T00:00:00.000Z'), dateStr: '2026-03-26', isToday: false, items: [], totalTimeMs: 0, totalEarnings: 0, dailyGoal: null, dayOfWeek: 4 },
        { date: new Date('2026-03-27T00:00:00.000Z'), dateStr: '2026-03-27', isToday: false, items: [], totalTimeMs: 0, totalEarnings: 0, dailyGoal: null, dayOfWeek: 5 },
        { date: new Date('2026-03-28T00:00:00.000Z'), dateStr: '2026-03-28', isToday: false, items: [], totalTimeMs: 0, totalEarnings: 0, dailyGoal: null, dayOfWeek: 6 },
        { date: new Date('2026-03-29T00:00:00.000Z'), dateStr: '2026-03-29', isToday: false, items: [], totalTimeMs: 0, totalEarnings: 0, dailyGoal: null, dayOfWeek: 0 },
    ]);

    beforeEach(() => {
        setMatchMedia(true);
        updateUrlMock.mockReset();
        plannerState.current = {
            weekStart: new Date('2026-03-23T00:00:00.000Z'),
            weekDays: buildWeekDays(),
        };
    });

    it('keeps the selected mobile day when the current week re-renders', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <Planner
                openClientModal={vi.fn()}
                openProjectModal={vi.fn()}
                openTaskModal={vi.fn()}
                openExpenseView={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        await user.click(screen.getByRole('button', { name: '2026-03-25' }));
        expect(screen.getByTestId('selected-day')).toHaveTextContent('2026-03-25');

        plannerState.current = {
            weekStart: new Date('2026-03-23T00:00:00.000Z'),
            weekDays: buildWeekDays().map((day) => ({
                ...day,
                items: day.dateStr === '2026-03-24'
                    ? [{ key: 'timer-task', type: 'task', title: 'Running timer', isCompleted: false }]
                    : [],
            })),
        };

        rerender(
            <Planner
                openClientModal={vi.fn()}
                openProjectModal={vi.fn()}
                openTaskModal={vi.fn()}
                openExpenseView={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        expect(screen.getByTestId('selected-day')).toHaveTextContent('2026-03-25');
    });
});