import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import TaskKanbanTaskRow from './TaskKanbanTaskRow';

const TaskKanbanCard = ({
    task,
    onOpen,
    onArchive = null,
    onUnarchive = null,
    onDelete = null,
    showBillableBadge = false,
    isDragGhost = false,
    disableTransform = false,
    dragDisabled = false,
}) => {
    const {
        attributes,
        listeners,
        setActivatorNodeRef,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `card:${task.id}`,
        data: {
            type: 'card',
            taskId: task.id,
            parentTaskId: task.parentTaskId || null,
        },
        disabled: dragDisabled || Boolean(task.archived),
    });

    const style = {
        transform: disableTransform ? undefined : CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'w-full self-start rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors',
                !isDragging && 'hover:bg-accent/40',
                isDragging && 'opacity-0',
                isDragGhost && 'opacity-0',
                task.completed && 'bg-muted/50'
            )}
            data-testid={`task-kanban-card-${task.id}`}
        >
            <TaskKanbanTaskRow
                task={task}
                onOpen={onOpen}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
                showBillableBadge={showBillableBadge}
                dragActivatorRef={setActivatorNodeRef}
                dragAttributes={attributes}
                dragListeners={listeners}
                dragDisabled={dragDisabled || Boolean(task.archived)}
            />
        </div>
    );
};

export default TaskKanbanCard;
