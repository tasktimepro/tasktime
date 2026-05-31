import { render, screen } from '@testing-library/react';
import DayColumn from './DayColumn';

vi.mock('./PlannerItem', () => ({
    default: () => <div>Planner item</div>
}));

vi.mock('./AddItemPopover', () => ({
    default: ({ children }) => children
}));

vi.mock('./DailyGoalProgress', () => ({
    default: () => <div>Daily goal progress</div>
}));

describe('DayColumn', () => {
    const baseProps = {
        date: new Date(2026, 2, 24),
        dateStr: '2026-03-24',
        items: [],
        totalTimeMs: 60 * 60 * 1000,
        totalEarnings: 125,
        dailyGoal: { id: 'goal-1', targetHours: 6, targetEarnings: 250 },
        currency: 'EUR',
        onAddClick: vi.fn(),
        onCreateTask: vi.fn(),
        onItemClick: vi.fn(),
        onEditItem: vi.fn(),
        onRemoveItem: vi.fn(),
        onSetDailyGoal: vi.fn(),
    };

    it('uses the column background on the desktop hover footer for regular days', () => {
        render(<DayColumn {...baseProps} />);

        const footer = screen.getByText('Daily goal progress').parentElement;

        expect(footer).not.toBeNull();
        expect(footer.className).toContain('bg-card');
    });

    it('uses the today column background on the desktop hover footer for today', () => {
        render(<DayColumn {...baseProps} isToday={true} />);

        const footer = screen.getByText('Daily goal progress').parentElement;

        expect(footer).not.toBeNull();
        expect(footer.className).toContain('bg-muted/80');
    });
});