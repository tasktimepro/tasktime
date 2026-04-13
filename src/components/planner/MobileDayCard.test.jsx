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

describe('MobileDayCard', () => {
    const baseProps = {
        date: new Date(2026, 2, 24),
        dateStr: '2026-03-24',
        totalTimeMs: 0,
        totalEarnings: 0,
        currency: 'USD',
        onPrev: () => {},
        onNext: () => {},
        onAddClick: () => {},
        onCreateTask: () => {},
    };

    it('uses the simplified mobile title/date stack and button icon API', () => {
        render(<MobileDayCard {...baseProps} isToday={true} items={[]} />);

        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('March 24')).toBeInTheDocument();

        const attachButton = screen.getByRole('button', { name: /Attach item/i });
        expect(attachButton.querySelector('svg')).not.toBeNull();
        expect(attachButton.textContent).toContain('Attach item');
    });

    it('does not render the mobile item-count badge', () => {
        render(<MobileDayCard {...baseProps} items={[{ key: 'task-1', title: 'Alpha', type: 'task' }]} />);

        expect(screen.queryByText('1 item')).not.toBeInTheDocument();
        expect(screen.queryByText('1 items')).not.toBeInTheDocument();
    });

    it('uses a full-card today background without a mobile top border accent', () => {
        const { container } = render(<MobileDayCard {...baseProps} isToday={true} items={[]} />);

        const card = container.firstChild;
        expect(card.className).toContain('bg-muted/80');
        expect(card.className).not.toContain('border-t-2');
        expect(card.getAttribute('style')).toBeNull();
    });
});