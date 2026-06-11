import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MetricsDisplay from './MetricsDisplay';

vi.mock('@/hooks/usePreferences', () => ({
    usePreferences: () => ({
        preferences: {
            weekStartsOn: 1,
        }
    })
}));

vi.mock('@/hooks/useIsMobileLayout', () => ({
    default: () => false
}));

describe('MetricsDisplay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-11T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders last week after this week and no longer shows last 90 days', () => {
        const timeEntries = [
            {
                id: 'today',
                taskId: 'task-1',
                start: new Date('2026-06-11T09:00:00.000Z').getTime(),
                end: new Date('2026-06-11T10:00:00.000Z').getTime(),
            },
            {
                id: 'this-week',
                taskId: 'task-1',
                start: new Date('2026-06-10T09:00:00.000Z').getTime(),
                end: new Date('2026-06-10T11:00:00.000Z').getTime(),
            },
            {
                id: 'last-week',
                taskId: 'task-1',
                start: new Date('2026-06-03T09:00:00.000Z').getTime(),
                end: new Date('2026-06-03T12:00:00.000Z').getTime(),
            },
            {
                id: 'last-month',
                taskId: 'task-1',
                start: new Date('2026-05-15T09:00:00.000Z').getTime(),
                end: new Date('2026-05-15T13:00:00.000Z').getTime(),
            },
        ];

        render(
            <MetricsDisplay
                timeEntries={timeEntries}
            />
        );

        expect(screen.queryByText('Last 90 Days')).not.toBeInTheDocument();

        const labels = screen.getAllByText(/Today|This Week|Last Week|This Month|Last Month/);
        expect(labels.map((label) => label.textContent)).toEqual([
            'Today',
            'This Week',
            'Last Week',
            'This Month',
            'Last Month',
        ]);

        expect(within(labels[0].closest('.flex.flex-col')).getByText('1h')).toBeInTheDocument();
        expect(within(labels[1].closest('.flex.flex-col')).getByText('3h')).toBeInTheDocument();
        expect(within(labels[2].closest('.flex.flex-col')).getByText('3h')).toBeInTheDocument();
        expect(within(labels[3].closest('.flex.flex-col')).getByText('6h')).toBeInTheDocument();
        expect(within(labels[4].closest('.flex.flex-col')).getByText('4h')).toBeInTheDocument();
    });
});
