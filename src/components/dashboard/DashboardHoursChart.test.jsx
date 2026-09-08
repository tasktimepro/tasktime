import { cloneElement } from 'react';
import { expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardHoursChart from './DashboardHoursChart';

// JSDOM has no layout; use a known viewport while retaining the real chart engine.
vi.mock('recharts', async importOriginal => ({ ...await importOriginal(), ResponsiveContainer: ({ children }) => cloneElement(children, { width: 640, height: 176 }) }));

it('offers exact daily values and a keyboard tooltip with both series and their total', async () => {
    const user = userEvent.setup();
    render(<DashboardHoursChart days={[
        { date: '2026-09-01', billable: 3600000, nonBillable: 1800000, total: 5400000 },
        { date: '2026-09-02', billable: 0, nonBillable: 0, total: 0 },
    ]} />);
    const chart = screen.getByRole('application', { name: 'Daily tracked hours, split into billable and non-billable time' });
    act(() => chart.focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('2 September 2026')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('1 September 2026')).toBeInTheDocument();
    expect(screen.queryByText('Daily values')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Actual time tracked each day' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: '1 Sep 1h 30m 1h 30m' })).toBeVisible();
    expect(screen.getByRole('row', { name: '2 Sep 0s 0s 0s' })).toBeVisible();
});

it.each([[0, 8], [7.5, 8], [8, 8], [8.5, 9], [9.2, 10], [26.25, 27]])('scales a stacked %sh day to a %sh ceiling', (hours, ceiling) => {
    const { container } = render(<DashboardHoursChart days={[
        { date: '2026-09-01', billable: hours * 1800000, nonBillable: hours * 1800000, total: hours * 3600000 },
        { date: '2026-09-02', billable: 0, nonBillable: 0, total: 0 },
    ]} />);
    // Recharts renders tick text into a shared SVG layer, outside the axis group.
    const ticks = [...container.querySelectorAll('.recharts-cartesian-axis-tick-value')]
        .map(node => node.textContent).filter(text => /^\d+h$/.test(text)).map(text => Number(text.replace('h', '')));
    expect(ticks).toHaveLength(5);
    expect(Math.min(...ticks)).toBe(0);
    expect(Math.max(...ticks)).toBe(ceiling);
});
