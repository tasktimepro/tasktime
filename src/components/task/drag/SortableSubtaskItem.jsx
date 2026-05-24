import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import SubtaskItem from '../SubtaskSection/SubtaskItem';

const SortableSubtaskItem = ({ task, isDragGhost = false, disableTransform = false, ...props }) => {
    const {
        attributes,
        listeners,
        setActivatorNodeRef,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `subtask:${task.id}`,
        data: {
            type: 'subtask',
            taskId: task.id,
            parentTaskId: task.parentTaskId || null,
        },
    });

    const style = {
        transform: disableTransform ? undefined : CSS.Transform.toString(transform),
        transition,
    };

    const dragHandle = (
        <span aria-hidden="true" className="inline-flex h-8 shrink-0 items-center justify-center text-muted-foreground">
            <GripVerticalIcon className="h-4 w-4" />
        </span>
    );

    return (
        <div ref={setNodeRef} style={style} className={cn((isDragging || isDragGhost) && 'opacity-0')}>
            <SubtaskItem
                {...props}
                task={task}
                dragHandle={dragHandle}
                dragActivatorRef={setActivatorNodeRef}
                dragAttributes={attributes}
                dragListeners={listeners}
                isDragging={isDragging}
            />
        </div>
    );
};

export default SortableSubtaskItem;
