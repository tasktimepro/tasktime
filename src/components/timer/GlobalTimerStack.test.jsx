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
    default: ({ timer }) => (
        <div data-testid={`timer-${timer.projectId}`}>{timer.taskId}</div>
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

    it('renders focused timer and collapsed badge', () => {
        const { container } = render(
            <GlobalTimerStack navigateToProject={vi.fn()} onClose={vi.fn()} />
        );

        expect(screen.getByTestId('timer-project-1')).toBeInTheDocument();
        expect(screen.queryByTestId('timer-project-2')).not.toBeInTheDocument();
        expect(screen.getByText('+1 more')).toBeInTheDocument();

        fireEvent.mouseEnter(container.firstChild);
        expect(screen.getByTestId('timer-project-2')).toBeInTheDocument();
    });
});
