import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskTree from './TaskTree';

const taskTreeMocks = vi.hoisted(() => ({
    isMobileLayout: false,
    tasks: [],
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    deleteEntry: vi.fn(),
    getTimerForProject: vi.fn(() => null),
    clearTimer: vi.fn(),
    showSuccess: vi.fn(),
}));

vi.mock('../hooks/useIsMobileLayout', () => ({
    default: () => taskTreeMocks.isMobileLayout,
}));

vi.mock('../hooks/useToast.ts', () => ({
    useToast: () => ({ showSuccess: taskTreeMocks.showSuccess })
}));

vi.mock('../hooks/useTasks.ts', () => ({
    useTasks: () => ({
        tasks: taskTreeMocks.tasks,
        createTask: taskTreeMocks.createTask,
        updateTask: taskTreeMocks.updateTask,
        deleteTask: taskTreeMocks.deleteTask,
    })
}));

vi.mock('../hooks/useTimeEntries.ts', () => ({
    useTimeEntries: () => ({ entries: [], deleteEntry: taskTreeMocks.deleteEntry })
}));

vi.mock('../hooks/useTimers.ts', () => ({
    useTimers: () => ({
        getTimerForProject: taskTreeMocks.getTimerForProject,
        clearTimer: taskTreeMocks.clearTimer,
    })
}));

vi.mock('../hooks/useDayRollover', () => ({
    useTodayString: () => '2026-04-11',
    useTodayDate: () => new Date('2026-04-11T09:00:00Z'),
}));

vi.mock('./TaskItem', () => ({ default: () => <div>Task item</div> }));
vi.mock('./Modal', () => ({ default: () => null }));
vi.mock('./task/RecurringPicker', () => ({ default: () => <div>Recurring picker</div> }));
vi.mock('./task/DeleteTaskWarnings', () => ({ default: () => <div>Delete warnings</div> }));

describe('TaskTree', () => {
    beforeEach(() => {
        taskTreeMocks.isMobileLayout = false;
        taskTreeMocks.tasks = [];
    });

    it('keeps sort and new task controls inline on mobile until they need to wrap', () => {
        taskTreeMocks.isMobileLayout = true;

        render(
            <TaskTree
                project={{ id: 'project-1', title: 'Project', isPersonal: false }}
                onEditTask={vi.fn()}
                onViewTask={vi.fn()}
            />
        );

        const newTaskButton = screen.getByRole('button', { name: 'New Task' });
        const controlsRow = newTaskButton.parentElement;
        const headerRow = controlsRow?.parentElement;

        expect(controlsRow?.className.includes('gap-3')).toBe(true);
        expect(controlsRow?.className.includes('w-full')).toBe(false);
        expect(headerRow?.className.includes('flex-wrap')).toBe(true);
        expect(headerRow?.className.includes('flex-col')).toBe(false);
    });
});
