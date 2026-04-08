import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalTimerStack from './GlobalTimerStack';

let mockTimers = [];
const focusTimerMock = vi.fn();

vi.mock('../../hooks/useTimers', () => ({
    useTimers: () => ({
        timers: mockTimers,
        focusTimer: focusTimerMock,
        getTimerForTask: () => null
    })
}));

vi.mock('./GlobalTimerCard', () => ({
    default: ({ timer, isExpanded }) => (
        <div data-testid={`timer-${timer.projectId}`} data-expanded={String(isExpanded)}>{timer.taskId}</div>
    )
}));

describe('GlobalTimerStack', () => {
    beforeEach(() => {
        mockTimers = [
            { projectId: 'project-1', taskId: 'task-1', startTime: 1, isPaused: false, elapsedTime: 1000 },
            { projectId: 'project-2', taskId: 'task-2', startTime: 2, isPaused: true, elapsedTime: 2000 }
        ];
        focusTimerMock.mockClear();
    });

    it('renders focused timer and expands on hover by default', () => {
        const { container } = render(
            <GlobalTimerStack navigateToProject={vi.fn()} onClose={vi.fn()} />
        );

        expect(screen.getByTestId('timer-project-1')).toBeInTheDocument();
        expect(screen.queryByTestId('timer-project-2')).not.toBeInTheDocument();
        expect(screen.getByText('+1 more')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Show 2 timers' })).not.toBeInTheDocument();

        fireEvent.mouseEnter(container.firstChild);
        expect(screen.getByTestId('timer-project-2')).toBeInTheDocument();
    });

    it('expands and collapses extra timers on click in manual-toggle mode', () => {
        render(
            <GlobalTimerStack navigateToProject={vi.fn()} onClose={vi.fn()} enableHoverExpansion={false} enableManualToggle={true} />
        );

        const collapsedToggle = screen.getByRole('button', { name: 'Show 2 timers' });

        expect(screen.getByText('+1 more')).toBeInTheDocument();
        expect(collapsedToggle.parentElement?.className).toContain('absolute');

        fireEvent.click(collapsedToggle);

        expect(screen.getByTestId('timer-project-2')).toBeInTheDocument();
        const expandedToggle = screen.getByRole('button', { name: 'Hide extra timers' });

        expect(expandedToggle).toBeInTheDocument();
        expect(expandedToggle.parentElement?.className).toContain('mt-2');

        fireEvent.click(expandedToggle);

        expect(screen.queryByTestId('timer-project-2')).not.toBeInTheDocument();
        expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('does not expand from hover in manual-toggle mode', () => {
        const { container } = render(
            <GlobalTimerStack navigateToProject={vi.fn()} onClose={vi.fn()} enableHoverExpansion={false} enableManualToggle={true} />
        );

        fireEvent.mouseEnter(container.firstChild);

        expect(screen.queryByTestId('timer-project-2')).not.toBeInTheDocument();
        expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('can transition from no timers to active timers without a hook-order crash', () => {
        mockTimers = [];

        const { rerender } = render(
            <GlobalTimerStack navigateToProject={vi.fn()} onClose={vi.fn()} />
        );

        expect(screen.queryByTestId('timer-project-1')).not.toBeInTheDocument();

        mockTimers = [
            { projectId: 'project-1', taskId: 'task-1', startTime: 1, isPaused: false, elapsedTime: 1000 },
        ];

        rerender(
            <GlobalTimerStack navigateToProject={vi.fn()} onClose={vi.fn()} />
        );

        expect(screen.getByTestId('timer-project-1')).toBeInTheDocument();
    });
});
