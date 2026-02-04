import { render, screen } from '@testing-library/react';
import WeekHeader from './WeekHeader';

describe('WeekHeader', () => {
    it('renders week summary and add control', () => {
        render(
            <WeekHeader
                weekStart={new Date(2026, 1, 2)}
                weekEnd={new Date(2026, 1, 8)}
                weekNumber={6}
                onPrevious={() => {}}
                onNext={() => {}}
                onToday={() => {}}
                isCurrentWeek={false}
                weekSummary={{
                    hoursText: '12.0h / 40h',
                    earningsText: '$300 / $500',
                    hasGoals: true,
                }}
                weekAddControl={<button type="button">Add to week</button>}
            />
        );

        expect(screen.getByText('Week 6, February')).toBeInTheDocument();
        expect(screen.getByText('12.0h / 40h')).toBeInTheDocument();
        expect(screen.getByText('$300 / $500')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add to week' })).toBeInTheDocument();
    });
});
