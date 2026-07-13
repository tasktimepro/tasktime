import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimeEntriesOverview from './TimeEntriesOverview';
import { DEFAULT_TIME_ENTRIES_PROJECT_FILTER } from './dashboardWidgetConstants';

vi.mock('../../hooks/useIsMobileLayout', () => ({
    default: () => false,
}));

describe('TimeEntriesOverview', () => {
    it('shows entry durations with the same seconds-aware formatting as tasks', () => {
        const start = Date.parse('2026-07-13T10:00:00.000Z');
        const task = { id: 'task-1', title: 'Evaluation & analysis' };
        const project = { id: 'project-1', title: 'HCP App' };

        render(
            <TimeEntriesOverview
                entries={[
                    { id: 'seconds', task, project, start, end: start + 45_000 },
                    { id: 'minutes-seconds', task: { ...task, title: 'Mixed duration' }, project, start, end: start + 65_000 },
                    { id: 'minutes', task: { ...task, title: 'Exact minutes' }, project, start, end: start + 120_000 },
                    { id: 'zero', task: { ...task, title: 'Zero duration' }, project, start, end: start },
                ]}
                projects={[project]}
                projectFilter={DEFAULT_TIME_ENTRIES_PROJECT_FILTER}
                setProjectFilter={vi.fn()}
                onTaskClick={vi.fn()}
                onProjectClick={vi.fn()}
            />
        );

        expect(screen.getByText('45s')).toBeInTheDocument();
        expect(screen.getByText('1m 5s')).toBeInTheDocument();
        expect(screen.getByText('2m')).toBeInTheDocument();
        expect(screen.getByText('0s')).toBeInTheDocument();
        expect(screen.queryByText('0m')).not.toBeInTheDocument();
    });
});
