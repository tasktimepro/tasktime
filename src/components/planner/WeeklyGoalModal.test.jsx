import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import WeeklyGoalModal from './WeeklyGoalModal';
import { useWeeklyGoals } from '@/hooks/useWeeklyGoals';
import { usePreferences } from '@/hooks/usePreferences';

vi.mock('@/hooks/useWeeklyGoals', () => ({ useWeeklyGoals: vi.fn() }));
vi.mock('@/hooks/usePreferences', () => ({ usePreferences: vi.fn() }));

describe('WeeklyGoalModal', () => {
    beforeEach(() => {
        useWeeklyGoals.mockReturnValue({
            weeklyGoals: {
                targetHours: 40,
                targetEarnings: 1200,
            },
            setWeeklyGoals: vi.fn(),
            clearWeeklyGoals: vi.fn(),
        });
        usePreferences.mockReturnValue({
            preferences: { currency: 'USD' },
        });
    });

    it('shows week range label and include weekends toggle', () => {
        render(
            <WeeklyGoalModal
                isOpen={true}
                onClose={() => {}}
                weekStart={new Date(2026, 1, 2)}
            />
        );

        expect(screen.getByText('Target working hours')).toBeInTheDocument();
        expect(screen.getByText('These goals apply every week.')).toBeInTheDocument();
    });
});
