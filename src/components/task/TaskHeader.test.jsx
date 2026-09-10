import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskHeader from './TaskHeader';

const baseProps = {
    editTitle: '',
    setEditTitle: vi.fn(),
    isEditing: false,
    isCompleted: false,
    isArchived: false,
    onToggleComplete: vi.fn(),
    onSaveTitle: vi.fn(),
    onCancelEdit: vi.fn(),
    onShowTimeEntries: vi.fn(),
    mainTaskTime: 0,
    totalTimeWithSubtasks: 0,
    showCheckbox: false,
    showTimeDisplay: false,
};

describe('TaskHeader', () => {
    it('keeps a disabled recurring task title free of status icons', () => {
        render(
            <TaskHeader
                {...baseProps}
                task={{
                    id: 'task-1',
                    title: 'Disabled weekly task',
                    recurring: { type: 'weekly', weeklyDays: [1], paused: true },
                }}
            />
        );

        const title = screen.getByText('Disabled weekly task');

        expect(title).toBeInTheDocument();
        expect(title).toHaveClass('truncate');
        expect(screen.queryByLabelText('Recurring task disabled')).not.toBeInTheDocument();
    });

    it('keeps a clickable disabled recurring task title free of status icons', () => {
        render(
            <TaskHeader
                {...baseProps}
                task={{
                    id: 'task-1',
                    title: 'Clickable weekly task',
                    recurring: { type: 'weekly', weeklyDays: [1], paused: true },
                }}
                onTitleClick={vi.fn()}
            />
        );

        const titleButton = screen.getByRole('button', { name: 'Clickable weekly task' });

        expect(titleButton).toHaveClass('w-full');
        expect(screen.queryByLabelText('Recurring task disabled')).not.toBeInTheDocument();
    });

    it('does not mark an enabled recurring task as disabled', () => {
        render(
            <TaskHeader
                {...baseProps}
                task={{
                    id: 'task-1',
                    title: 'Enabled weekly task',
                    recurring: { type: 'weekly', weeklyDays: [1], paused: false },
                }}
            />
        );

        expect(screen.queryByLabelText('Recurring task disabled')).not.toBeInTheDocument();
    });
});
