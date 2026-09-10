import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import TaskRecurrenceMenuItem from './TaskRecurrenceMenuItem';

const state = vi.hoisted(() => ({ task: null, updateTask: vi.fn() }));
vi.mock('@/hooks/useTasks', () => ({ useTasks: () => ({ getTask: () => state.task, updateTask: state.updateTask }) }));
vi.mock('@/components/ui/dropdown-menu', () => ({ DropdownMenuItem: ({ children, className, onClick }) => <button className={className} onClick={onClick}>{children}</button> }));
beforeEach(() => {
    state.task = { id: 't', title: 'Weekly', recurring: { type: 'weekly', weeklyDays: [1] } };
    state.updateTask.mockReset();
});
it('offers explicit recurrence actions with schedule icons and updates only recurrence', () => {
    const { rerender } = render(<TaskRecurrenceMenuItem task={state.task} />);
    const action = screen.getByRole('button', { name: 'Disable recurrence' });
    expect(action).toHaveClass('cursor-pointer', 'hover:bg-accent', 'focus:bg-accent');
    expect(action.querySelector('svg')).toHaveClass('mr-2', 'lucide-calendar-off');
    fireEvent.click(action);
    expect(state.updateTask).toHaveBeenCalledWith('t', { recurring: { type: 'weekly', weeklyDays: [1], paused: true } });
    state.task = { ...state.task, recurring: { ...state.task.recurring, paused: true } };
    rerender(<TaskRecurrenceMenuItem task={state.task} />);
    const enable = screen.getByRole('button', { name: 'Enable recurrence' });
    expect(enable.querySelector('svg')).toHaveClass('lucide-calendar-check-2');
    fireEvent.click(enable);
    expect(state.updateTask).toHaveBeenLastCalledWith('t', { recurring: { type: 'weekly', weeklyDays: [1], paused: false } });
});
it.each([{ recurring: null }, { parentTaskId: 'parent' }, { archived: true }])('hides the action for unsupported tasks: %o', extra => {
    state.task = { ...state.task, ...extra };
    render(<TaskRecurrenceMenuItem task={state.task} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('does not mutate a task removed after the menu opened', () => {
    render(<TaskRecurrenceMenuItem task={state.task} />);
    state.task = null;
    fireEvent.click(screen.getByRole('button', { name: 'Disable recurrence' }));
    expect(state.updateTask).not.toHaveBeenCalled();
});

it.each([true, false])('does not reverse the displayed action after a remote change (paused: %s)', paused => {
    state.task = { ...state.task, recurring: { ...state.task.recurring, paused } };
    render(<TaskRecurrenceMenuItem task={state.task} />);
    state.task = { ...state.task, recurring: { ...state.task.recurring, paused: !paused } };
    fireEvent.click(screen.getByRole('button', { name: paused ? 'Enable recurrence' : 'Disable recurrence' }));
    expect(state.updateTask).not.toHaveBeenCalled();
});
