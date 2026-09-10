import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { CalendarCheckIcon, CalendarOffIcon } from '@/components/ui/icons';
import { useTasks } from '@/hooks/useTasks';

/** Explicit recurrence wording and schedule icons keep this action distinct from timers. */
export default function TaskRecurrenceMenuItem({ task }) {
    const { getTask, updateTask } = useTasks();
    const current = getTask?.(task.id) || task;
    if (!current.recurring || current.parentTaskId || current.archived) return null;
    const shouldPause = !current.recurring.paused;
    const Icon = current.recurring.paused ? CalendarCheckIcon : CalendarOffIcon;
    return <DropdownMenuItem className="cursor-pointer hover:bg-accent focus:bg-accent" onClick={() => {
        const latest = getTask?.(task.id);
        if (!latest?.recurring || latest.parentTaskId || latest.archived) return;
        if (Boolean(latest.recurring.paused) === shouldPause) return;
        updateTask(latest.id, { recurring: { ...latest.recurring, paused: shouldPause } });
    }}>
        <Icon className="h-4 w-4 mr-2" />
        <span>{current.recurring.paused ? 'Enable recurrence' : 'Disable recurrence'}</span>
    </DropdownMenuItem>;
}
