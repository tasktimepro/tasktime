import { render, screen } from '@testing-library/react';
import MobileDayCard from './MobileDayCard';

vi.mock('./PlannerItem', () => ({
    default: ({ title }) => <div>{title}</div>
}));

vi.mock('./AddItemPopover', () => ({
    default: ({ children }) => children
}));

vi.mock('./DailyGoalProgress', () => ({
    default: () => <div>Daily goal progress</div>
}));

vi.mock('./hooks/useTimeProgress', () => ({
    useTimeProgress: () => 0,
    getProgressGradientStyle: () => ({}),
}));

describe('MobileDayCard', () => {
    it('uses the simplified mobile title/date stack and button icon API', () => {
        render(
            <MobileDayCard
                date={new Date(2026, 2, 24)}
                dateStr="2026-03-24"
                isToday={true}
                items={[]}
                totalTimeMs={0}
                totalEarnings={0}
                currency="USD"
                onPrev={() => {}}
                onNext={() => {}}
                onAddClick={() => {}}
                onCreateTask={() => {}}
            />
        );

        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('March 24')).toBeInTheDocument();

        const attachButton = screen.getByRole('button', { name: /Attach item/i });
        expect(attachButton.querySelector('svg')).not.toBeNull();
        expect(attachButton.textContent).toContain('Attach item');
    });
});