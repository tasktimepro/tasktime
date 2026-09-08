import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SubtaskItem from './task/SubtaskSection/SubtaskItem';
import AddTimeEntryModal from './modals/AddTimeEntryModal';

const state = vi.hoisted(() => ({ projects: [], entries: [], updateTask: vi.fn(), createManualEntry: vi.fn(), showError: vi.fn() }));
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ projects: state.projects }) }));
vi.mock('@/hooks/useTasks', () => ({ useTasks: () => ({ updateTask: state.updateTask }) }));
vi.mock('@/hooks/useTimeEntries', () => ({ useTimeEntries: () => ({ entries: state.entries, createManualEntry: state.createManualEntry, updateManualEntry: vi.fn() }) }));
vi.mock('@/hooks/useTimers', () => ({ useTimers: () => ({ getTimerForTask: () => null, stopTimer: vi.fn() }) }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: state.showError }) }));
vi.mock('@/hooks/useIsMobileLayout', () => ({ default: () => false }));
vi.mock('./TimeEntriesModal', () => ({ default: () => null }));
vi.mock('./task/TaskHeader', () => ({ default: () => null }));
vi.mock('./task/TaskActions', () => ({ default: () => null }));
vi.mock('./task/StartDateBadge', () => ({ default: () => null }));
vi.mock('./Modal', () => ({ default: ({ children, footer }) => <div>{children}{footer}</div> }));
const task = { id: 'task', title: 'Work', projectId: 'project', billable: false };
const contexts = [
    ['no client', { id: 'project', title: 'Internal', hourlyRate: 100 }, false],
    ['personal', { id: 'project', title: 'Personal', hourlyRate: 100, isPersonal: true, preferredClientId: 'client' }, false],
    ['client', { id: 'project', title: 'Client work', hourlyRate: 100, preferredClientId: 'client' }, true],
];

describe('automatic billability in time-entry and subtask flows', () => {
    beforeEach(() => { vi.clearAllMocks(); state.entries = []; state.createManualEntry.mockResolvedValue({ id: 'entry' }); });
    it.each(contexts)('checks %s project context for subtasks', (_label, project, expected) => {
        state.projects = [project];
        state.entries = [{ id: 'entry', taskId: 'task', start: 1000, end: 61000 }];
        render(<SubtaskItem task={task} />);
        expect(state.updateTask).toHaveBeenCalledTimes(expected ? 1 : 0);
    });
    it.each(contexts)('checks %s project context when manually adding time', async (_label, project, expected) => {
        state.projects = [project];
        const onClose = vi.fn();
        render(<AddTimeEntryModal isOpen task={task} onClose={onClose} />);
        fireEvent.change(screen.getByLabelText('Time spent'), { target: { value: '1m' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(state.createManualEntry).toHaveBeenCalledTimes(1);
        expect(state.updateTask).toHaveBeenCalledTimes(expected ? 1 : 0);
    });
});
