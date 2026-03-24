import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import MobileDaySelector from './MobileDaySelector';

vi.mock('@/hooks/useDayRollover', () => ({
    useTodayDate: () => new Date(2026, 2, 24),
}));

describe('MobileDaySelector', () => {
    it('shows only day name and date with extra spacing on mobile chips', async () => {
        const user = userEvent.setup();
        const onSelectDay = vi.fn();

        render(
            <MobileDaySelector
                weekDays={[
                    {
                        date: new Date(2026, 2, 24),
                        dateStr: '2026-03-24',
                    },
                    {
                        date: new Date(2026, 2, 25),
                        dateStr: '2026-03-25',
                    },
                ]}
                selectedDateStr="2026-03-24"
                onSelectDay={onSelectDay}
            />
        );

        const todayChip = screen.getByRole('button', { name: /Tue\s*24/i });
        expect(todayChip.className.includes('gap-1.5')).toBe(true);
        expect(screen.queryByText('Today')).not.toBeInTheDocument();
        expect(screen.queryByText('Mar')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Wed\s*25/i }));
        expect(onSelectDay).toHaveBeenCalledWith('2026-03-25');
    });
});