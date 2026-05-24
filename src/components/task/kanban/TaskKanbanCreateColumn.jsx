import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { cn } from '@/lib/utils';
import RecurringPicker from '../RecurringPicker';

const TaskKanbanCreateColumn = ({
    newTaskTitle,
    setNewTaskTitle,
    newTaskNote,
    setNewTaskNote,
    newTaskStartDate,
    setNewTaskStartDate,
    newTaskRecurring,
    setNewTaskRecurring,
    onSubmit,
    onCancel,
}) => {
    return (
        <section
            className="flex w-[min(20rem,85vw)] shrink-0 self-start rounded-xl border border-border bg-card p-3 sm:w-80"
            data-testid="task-kanban-create-column"
        >
            <form onSubmit={onSubmit} className="w-full space-y-3">
                <div className="space-y-1">
                    <h4 className="text-sm font-medium text-foreground">Create New Task</h4>
                </div>

                <Input
                    type="text"
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="Enter task title"
                    autoFocus
                />

                <Input
                    type="text"
                    value={newTaskNote}
                    onChange={(event) => setNewTaskNote(event.target.value)}
                    placeholder="Note"
                />

                <NativeDateInput
                    value={newTaskStartDate}
                    onChange={(event) => {
                        setNewTaskStartDate(event.target.value);
                        if (event.target.value) {
                            setNewTaskRecurring(null);
                        }
                    }}
                    className="w-full dark:[color-scheme:dark]"
                    disabled={Boolean(newTaskRecurring)}
                />

                <RecurringPicker
                    value={newTaskRecurring}
                    onChange={(config) => {
                        setNewTaskRecurring(config);
                        setNewTaskStartDate('');
                    }}
                    onClear={() => setNewTaskRecurring(null)}
                    inactiveVariant="ghost"
                />

                <div className={cn('flex gap-2 justify-end')}>
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Create</Button>
                </div>
            </form>
        </section>
    );
};

export default TaskKanbanCreateColumn;
