import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Upcoming from './Upcoming';

it('orders mixed upcoming work by date and keeps every item and its original action accessible', async () => {
    const user = userEvent.setup();
    const view = vi.fn();
    const tasks = Array.from({ length: 5 }, (_, index) => ({ id: `task-${index}`, title: `Task ${index}`, startDate: `2026-09-${12 + index}` }));
    const expense = { id: 'expense', title: 'Subscription', date: '2026-09-11' };
    const renderTask = vi.fn((item) => <button onClick={() => view(item)}>{item.title}</button>);
    const renderExpense = vi.fn((item) => <button onClick={() => view(item)}>{item.title}</button>);
    render(<Upcoming tasks={tasks} expenses={[expense]} renderTask={renderTask} renderExpense={renderExpense} />);
    expect(screen.queryByText('Next 7 days')).not.toBeInTheDocument();
    expect(renderExpense).toHaveBeenCalledWith(expense, { context: 'upcoming' });
    expect(renderTask).toHaveBeenCalledWith(tasks[0], { context: 'upcoming' });
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Subscription');
    expect(screen.queryByText('Task 4')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all 6 upcoming items' }));
    await user.click(screen.getByRole('button', { name: 'Task 4' }));
    expect(view).toHaveBeenCalledWith(tasks[4]);
    await user.click(screen.getByRole('button', { name: 'Subscription' }));
    expect(view).toHaveBeenCalledWith(expense);
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText('Task 4')).not.toBeInTheDocument();
});
