import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import EntityPickerModal from './EntityPickerModal';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';

vi.mock('@/hooks/useTasks', () => ({ useTasks: vi.fn() }));
vi.mock('@/hooks/useProjects', () => ({ useProjects: vi.fn() }));
vi.mock('@/hooks/useClients', () => ({ useClients: vi.fn() }));

describe('EntityPickerModal (week scope)', () => {
    beforeEach(() => {
        useTasks.mockReturnValue({
            tasks: [{
                id: 'task-1',
                title: 'Design update',
                projectId: 'project-1',
                archived: false,
                completed: false,
                createdAt: 1,
            }],
        });
        useProjects.mockReturnValue({
            projects: [{ id: 'project-1', title: 'Website refresh' }],
        });
        useClients.mockReturnValue({ clients: [] });
    });

    it('attaches a task for the week with include weekends', () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();

        render(
            <EntityPickerModal
                isOpen={true}
                onClose={onClose}
                entityType="task"
                dateStr="2026-02-02"
                onSelect={onSelect}
                onCreateNew={null}
                scope="week"
                weekStart={new Date(2026, 1, 2)}
                weekEnd={new Date(2026, 1, 8)}
                mode="add"
            />
        );

        expect(screen.getByText('Include weekends')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Design update'));

        const attachButton = screen.getByRole('button', { name: 'Attach to Planner' });
        fireEvent.click(attachButton);

        expect(onSelect).toHaveBeenCalledTimes(1);
        const [entity, scheduleMode, weekday, targetHours, options] = onSelect.mock.calls[0];

        expect(entity.id).toBe('task-1');
        expect(scheduleMode).toBe('week');
        expect(weekday).toBe(1);
        expect(targetHours).toBeNull();
        expect(options.includeWeekends).toBe(true);
        expect(options.weekStart).toEqual(new Date(2026, 1, 2));
        expect(options.weekEnd).toEqual(new Date(2026, 1, 8));
    });
});
