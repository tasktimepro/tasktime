import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskActions from './index';

const hookState = vi.hoisted(() => ({
    getTimerForTask: vi.fn(() => null),
}));

vi.mock('../../../hooks/useTimers', () => ({
    useTimers: () => ({
        getTimerForTask: hookState.getTimerForTask,
    }),
}));

vi.mock('../../TaskTimer', () => ({
    default: () => <div>Timer</div>,
}));

describe('TaskActions', () => {
    it('opens the more actions dropdown from the shared task action row', async () => {
        const user = userEvent.setup();

        render(
            <TaskActions
                task={{
                    id: 'task-1',
                    title: 'Task',
                    projectId: 'project-1',
                    recurring: null,
                    archived: false,
                    completed: false,
                    billable: false,
                }}
                isEditing={false}
                anyTimerActive={false}
                isArchived={false}
                isCompleted={false}
                isRelatedToActiveTimer={false}
                onArchive={vi.fn()}
                onUnarchive={vi.fn()}
                onDelete={vi.fn()}
                onToggleBillable={vi.fn()}
                onShowTimeEntries={vi.fn()}
                onEdit={vi.fn()}
            />
        );

        await user.click(screen.getByTitle('More actions'));

        expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });
});