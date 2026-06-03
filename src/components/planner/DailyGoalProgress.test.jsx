import { render, screen } from '@testing-library/react';
import DailyGoalProgress from './DailyGoalProgress';

describe('DailyGoalProgress', () => {
    it('applies the hover surface styling on the button itself', () => {
        render(
            <DailyGoalProgress
                targetHours={5}
                actualHours={2}
                targetEarnings={400}
                actualEarnings={150}
                currency="EUR"
                onEditGoal={() => {}}
            />
        );

        const button = screen.getByRole('button');

        expect(button.className).toContain('hover:bg-card/95');
        expect(button.className).toContain('backdrop-blur-sm');
        expect(button.className).not.toContain('hover:backdrop-blur-sm');
        expect(button.className).not.toContain('hover:bg-muted/40');
    });
});
