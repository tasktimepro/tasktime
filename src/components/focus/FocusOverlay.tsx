import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type ComponentType } from 'react';
import { format } from 'date-fns';
import { useFocusItems } from '@/hooks/useFocusItems';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useTimers } from '@/hooks/useTimers';
import { useYjs } from '@/contexts/YjsContext';
import { usePreferences } from '@/hooks/usePreferences';
import { buildTaskCompletionUpdates } from '@/domain/tasks/taskStateOperations';
import { groupFocusItems, isFocusItemActionable, resolveFocusOccurrence } from '@/domain/focus/focusOperations';
import { isRecurringCompletedOnDate } from '@/utils/recurringCompletionUtils';
import { readEntity } from '@/stores/yjs/entityUtils';
import type { FocusItem, Task } from '@/stores/yjs/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import TimerControls from '@/components/TimerControls';
import { useFocusReminder } from '@/hooks/useFocusReminder';

type UndoAction = { kind: 'remove' | 'complete'; item: FocusItem; updatedAt?: number };
const FullScreenDialogContent = DialogContent as ComponentType<any>;
const FocusDialogTitle = DialogTitle as ComponentType<any>;
const FocusTimerControls = TimerControls as ComponentType<any>;

/** Focus is a window over real tasks; only membership and its order are stored separately. */
export interface FocusOverlayHandle { enableSound: () => Promise<void> }

export const FocusOverlay = forwardRef<FocusOverlayHandle, {
    open: boolean;
    onClose: () => void;
    onViewTask?: (task: Task, date: string) => void;
    onPromptTimeEntry?: (task: Task, date: string) => void;
}>(function FocusOverlay({ open, onClose, onViewTask, onPromptTimeEntry }, ref) {
    const { store } = useYjs();
    const { items, invalidCount, isLoading, add, create, remove, restore, move } = useFocusItems();
    const { projects } = useProjects();
    const { tasks, getTask, updateTask } = useTasks();
    const { timers, stopTimer } = useTimers();
    const { preferences, isLoading: preferencesLoading, setPreference } = usePreferences();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerProject, setPickerProject] = useState<string | null | undefined>(undefined);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Record<string, string | undefined>>({});
    const [title, setTitle] = useState('');
    const [createProjectId, setCreateProjectId] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [undo, setUndo] = useState<UndoAction | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const groups = useMemo(() => groupFocusItems(items, tasks, projects), [items, tasks, projects]);
    const selectedIds = useMemo(() => new Set(items.map(item => item.taskId)), [items]);
    const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
    const visibleIds = new Set(groups.flatMap(group => group.items.map(row => row.item.taskId)));
    const unavailable = items.filter(item => !visibleIds.has(item.taskId));
    const otherTimers = timers.filter(timer => !selectedIds.has(timer.taskId));
    const actionableTimerCount = timers.filter(timer => !timer.isPaused && selectedIds.has(timer.taskId)
        && groups.some(group => group.items.some(row => row.task.id === timer.taskId))).length;
    const reminder = useFocusReminder({
        open,
        eligible: actionableTimerCount > 0,
        savedMinutes: preferences.focusReminderMinutes ?? 0,
        preferencesReady: !preferencesLoading,
    });
    useImperativeHandle(ref, () => ({ enableSound: reminder.enable }), [reminder.enable]);

    const candidates = useMemo(() => tasks.filter(task => {
        if (task.archived || task.archivedOnDate || task.completed || task.recurring?.paused) return false;
        if (pickerProject !== undefined && (task.projectId || null) !== pickerProject) return false;
        if (task.projectId && !projects.some(project => project.id === task.projectId && !project.archived && !project.archivedOnDate)) return false;
        const parent = task.parentTaskId ? taskById.get(task.parentTaskId) : null;
        const project = task.projectId ? projects.find(entry => entry.id === task.projectId) : null;
        return `${task.title} ${parent?.title || ''} ${project?.title || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    }).slice(0, 60), [tasks, projects, taskById, pickerProject, search]);

    const showPicker = (projectId?: string | null) => {
        setPickerProject(projectId);
        setCreateProjectId(projectId || '');
        setSearch('');
        setSelected({});
        setError('');
        setPickerOpen(true);
    };

    const handleCreate = () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            create(title, createProjectId || null);
            setTitle('');
            titleInputRef.current?.focus();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create the task.');
        } finally {
            setBusy(false);
        }
    };

    const handleAttach = () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            add(Object.entries(selected).map(([taskId, occurrenceDate]) => ({ taskId, occurrenceDate })));
            setSelected({});
            setPickerOpen(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not add the selected tasks.');
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = (item: FocusItem) => {
        const removed = remove(item.taskId, item.selectionId);
        if (removed) setUndo({ kind: 'remove', item: removed });
    };

    const handleMove = (item: FocusItem, direction: 'up' | 'down') => {
        setError('');
        try {
            move(item.taskId, direction, item.selectionId);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'The Focus order changed. Try again.');
        }
    };

    const handleComplete = async (item: FocusItem) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            let task = getTask(item.taskId);
            if (!task) throw new Error('This task is no longer available.');
            const timerKey = task.projectId || task.id;
            const timer = timers.find(candidate => candidate.projectId === timerKey && candidate.taskId === task!.id);
            if (timer) {
                await stopTimer(timerKey);
                if (readEntity(store.timers.get(timerKey))) throw new Error('Could not stop the timer. Try again.');
            }
            task = getTask(item.taskId);
            const current = readEntity<FocusItem>(store.focusItems.get(item.taskId));
            if (!task || current?.selectionId !== item.selectionId) throw new Error('The task changed. Review it and try again.');
            if (!isFocusItemActionable(current, task)) throw new Error('This selected occurrence changed. Review it before completing.');
            if (task.recurring) {
                if (!item.occurrenceDate || isRecurringCompletedOnDate(task.completedDatesByYear, item.occurrenceDate)) {
                    throw new Error('This occurrence is no longer available.');
                }
            } else if (task.completed) {
                throw new Error('This task is already complete.');
            }
            const completed = updateTask(task.id, buildTaskCompletionUpdates({
                task, completed: true, occurrenceDate: item.occurrenceDate, now: Date.now(),
            }));
            if (!completed) throw new Error('Could not complete this task.');
            remove(item.taskId, item.selectionId);
            setUndo({ kind: 'complete', item, updatedAt: completed.updatedAt });
            if (task.promptTimeEntry) onPromptTimeEntry?.(task, item.occurrenceDate || format(new Date(), 'yyyy-MM-dd'));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not complete the task.');
        } finally {
            setBusy(false);
        }
    };

    const handleUndo = () => {
        if (!undo) return;
        setError('');
        try {
            if (undo.kind === 'complete') {
                const task = getTask(undo.item.taskId);
                if (!task || task.updatedAt !== undo.updatedAt || store.focusItems.has(task.id)) {
                    throw new Error('The task changed since completion. Undo is no longer available.');
                }
                if (task.recurring
                    ? !undo.item.occurrenceDate || !isRecurringCompletedOnDate(task.completedDatesByYear, undo.item.occurrenceDate)
                    : !task.completed) {
                    throw new Error('The task completion changed.');
                }
                updateTask(task.id, buildTaskCompletionUpdates({
                    task, completed: false, occurrenceDate: undo.item.occurrenceDate, now: Date.now(),
                }));
            }
            if (!restore(undo.item)) throw new Error('The selection changed. Add the task again if needed.');
            setUndo(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not undo the action.');
            setUndo(null);
        }
    };

    const orderedProjects = [...projects].filter(project => !project.archived && !project.archivedOnDate)
        .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));

    return (
        <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
            <FullScreenDialogContent fullScreen hideCloseButton className="flex flex-col bg-background text-foreground" onEscapeKeyDown={(event: KeyboardEvent) => { if (pickerOpen) { event.preventDefault(); setPickerOpen(false); } }}>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-8">
                    <div>
                        <FocusDialogTitle className="text-xl">Focus</FocusDialogTitle>
                        <p className="text-xs text-muted-foreground">Your next work, across projects</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground" htmlFor="focus-reminder">Reminder</label>
                        <select id="focus-reminder" disabled={preferencesLoading} className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={reminder.minutes}
                            onChange={event => {
                                const minutes = Number(event.target.value) as 0 | 20 | 30 | 40 | 60;
                                setPreference('focusReminderMinutes', minutes);
                                reminder.setInterval(minutes);
                            }}>
                            <option value={0}>Off</option><option value={20}>20 min</option><option value={30}>30 min</option>
                            <option value={40}>40 min</option><option value={60}>60 min</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={onClose}>Exit Focus</Button>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8">
                    <div className="mx-auto max-w-4xl space-y-8 pb-12">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? 'task' : 'tasks'} in Focus</div>
                            <Button data-autofocus onClick={() => showPicker()}>Add tasks</Button>
                        </div>
                        {reminder.notice && <p role="status" className="rounded-lg bg-accent px-3 py-2 text-sm">{reminder.notice}</p>}
                        {reminder.minutes ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{reminder.status}</span>
                                {!reminder.audioEnabled && <Button variant="ghost" size="sm" onClick={reminder.enable}>Enable sound</Button>}
                                <Button variant="ghost" size="sm" onClick={reminder.preview}>Preview sound</Button>
                                <span>Reminders may be delayed when the browser sleeps.</span>
                            </div>
                        ) : null}
                        {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
                        {invalidCount > 0 && <p role="alert" className="rounded-lg border border-border bg-card px-3 py-2 text-sm">Some saved Focus selections could not be shown. Your tasks are still available.</p>}
                        {undo && <div role="status" className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2 text-sm"><span>{undo.kind === 'complete' ? 'Task completed.' : 'Removed from Focus.'}</span><Button variant="outline" size="sm" onClick={handleUndo}>Undo</Button></div>}
                        {pickerOpen && (
                            <section className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6" aria-label="Add tasks to Focus">
                                <div className="flex items-center justify-between"><h2 className="font-semibold">Add tasks</h2><Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>Close</Button></div>
                                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                    <input aria-label="Search existing tasks" placeholder="Search existing tasks" value={search} onChange={event => setSearch(event.target.value)} className="h-10 min-w-0 rounded-md border border-input bg-background px-3" />
                                    <select aria-label="Filter project" value={pickerProject === undefined ? '*' : pickerProject || ''} onChange={event => setPickerProject(event.target.value === '*' ? undefined : event.target.value || null)} className="h-10 rounded-md border border-input bg-background px-2">
                                        <option value="*">All projects</option><option value="">Unassigned</option>
                                        {orderedProjects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                                    </select>
                                </div>
                                <div className="max-h-64 space-y-1 overflow-y-auto" role="group" aria-label="Existing task results">
                                    {candidates.length === 0 && <p className="py-4 text-sm text-muted-foreground">No available tasks match.</p>}
                                    {candidates.map(task => {
                                        const already = selectedIds.has(task.id);
                                        const date = selected[task.id] || (task.recurring ? resolveFocusOccurrence(task, new Date()) : undefined);
                                        const parent = task.parentTaskId ? taskById.get(task.parentTaskId) : null;
                                        const project = task.projectId ? projects.find(entry => entry.id === task.projectId) : null;
                                        return <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent/50">
                                            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><input type="checkbox" disabled={already || Boolean(task.recurring && !date)} checked={already || Object.prototype.hasOwnProperty.call(selected, task.id)}
                                                onChange={event => setSelected(previous => { const next = { ...previous }; if (event.target.checked) next[task.id] = date; else delete next[task.id]; return next; })} />
                                                <span className="min-w-0 truncate">{task.title}<span className="ml-2 text-xs text-muted-foreground">{parent ? `${parent.title} · ` : ''}{project?.title || 'Unassigned'}</span></span>
                                            </label>
                                            {task.recurring && <input type="date" aria-label={`Occurrence for ${task.title}`} value={date || ''} disabled={already} onChange={event => setSelected(previous => ({ ...previous, [task.id]: event.target.value }))} className="rounded border border-input bg-background px-2 py-1 text-xs" />}
                                            {already && <span className="text-xs text-muted-foreground">Already in Focus</span>}
                                        </div>;
                                    })}
                                </div>
                                <Button disabled={busy || Object.keys(selected).length === 0} onClick={handleAttach}>Add selected ({Object.keys(selected).length})</Button>
                                <div className="border-t border-border pt-4">
                                    <h3 className="mb-3 text-sm font-medium">Create a new task</h3>
                                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                                        <input ref={titleInputRef} aria-label="New task title" placeholder="What needs doing?" value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); handleCreate(); } }} className="h-10 min-w-0 rounded-md border border-input bg-background px-3" />
                                        <select aria-label="New task project" value={createProjectId} onChange={event => setCreateProjectId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-2"><option value="">Unassigned</option>{orderedProjects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
                                        <Button disabled={busy || !title.trim()} onClick={handleCreate}>Create</Button>
                                    </div>
                                </div>
                            </section>
                        )}
                        {isLoading ? <p className="text-sm text-muted-foreground">Loading Focus…</p> : items.length === 0 && !pickerOpen ? (
                            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center"><p className="font-medium">Choose what comes next</p><p className="mt-1 text-sm text-muted-foreground">Bring tasks from any project here, or create one now.</p><Button className="mt-4" onClick={() => showPicker()}>Add your first task</Button></div>
                        ) : null}
                        {groups.map(group => <section key={group.id || 'unassigned'} className="space-y-3" aria-label={group.title}>
                            <div className="flex items-center justify-between border-b border-border pb-2"><h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.id && <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" style={projects.find(project => project.id === group.id)?.color ? { backgroundColor: projects.find(project => project.id === group.id)?.color || undefined } : undefined} />}{group.title}</h2><Button variant="ghost" size="sm" onClick={() => showPicker(group.id)}>Add task</Button></div>
                            <div className="space-y-2">{group.items.map(({ item, task }, index) => <div key={item.selectionId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
                                <input type="checkbox" aria-label={`Complete ${task.title}`} disabled={busy} onChange={() => void handleComplete(item)} />
                                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onViewTask?.(task, item.occurrenceDate || format(new Date(), 'yyyy-MM-dd'))}>
                                    <span className="block truncate text-sm font-medium">{task.title}{index === 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">Next up</span>}</span>
                                    {(task.parentTaskId || item.occurrenceDate) && <span className="block text-xs text-muted-foreground">{task.parentTaskId ? `${taskById.get(task.parentTaskId)?.title || 'Subtask'} · ` : ''}{item.occurrenceDate || ''}</span>}
                                </button>
                                <FocusTimerControls task={task} size="sm" />
                                <div className="flex items-center gap-1"><Button variant="ghost" size="sm" aria-label={`Move ${task.title} up`} disabled={index === 0} onClick={() => handleMove(item, 'up')}>↑</Button><Button variant="ghost" size="sm" aria-label={`Move ${task.title} down`} disabled={index === group.items.length - 1} onClick={() => handleMove(item, 'down')}>↓</Button><Button variant="ghost" size="sm" aria-label={`Remove ${task.title} from Focus`} onClick={() => handleRemove(item)}>Remove</Button></div>
                            </div>)}</div>
                        </section>)}
                        {unavailable.length > 0 && <section className="space-y-2"><h2 className="text-sm font-semibold">Unavailable tasks</h2>{unavailable.map(item => <div key={item.selectionId} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span>{taskById.get(item.taskId)?.title || `Task ${item.taskId}`} is unavailable or its selected occurrence changed.</span><Button variant="ghost" size="sm" onClick={() => handleRemove(item)}>Remove</Button></div>)}</section>}
                        {otherTimers.length > 0 && <section className="space-y-2 border-t border-border pt-5"><h2 className="text-sm font-semibold">Other timers</h2>{otherTimers.map(timer => { const task = taskById.get(timer.taskId); return task ? <div key={timer.projectId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>{task.title}</span><FocusTimerControls task={task} size="sm" /></div> : null; })}</section>}
                    </div>
                </div>
            </FullScreenDialogContent>
        </Dialog>
    );
});
