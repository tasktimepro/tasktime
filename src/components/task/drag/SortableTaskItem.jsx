import { useCallback, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import TaskItem from '../../TaskItem';

const SortableTaskItem = ({ task, ...props }) => {
    const nodeRef = useRef(null);
    const {
        attributes,
        listeners,
        setActivatorNodeRef,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `task:${task.id}`,
        data: {
            type: 'task',
            taskId: task.id,
            getOverlayRect: () => nodeRef.current?.getBoundingClientRect() || null,
        },
    });

    const setSortableNodeRef = useCallback((node) => {
        nodeRef.current = node;
        setNodeRef(node);
    }, [setNodeRef]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const dragHandle = (
        <span aria-hidden="true" className="inline-flex h-8 shrink-0 items-center justify-center text-muted-foreground">
            <GripVerticalIcon className="h-4 w-4" />
        </span>
    );

    return (
        <div ref={setSortableNodeRef} style={style} className={cn(isDragging && 'opacity-0')}>
            <TaskItem
                {...props}
                task={task}
                dragHandle={dragHandle}
                dragActivatorRef={setActivatorNodeRef}
                dragAttributes={attributes}
                dragListeners={listeners}
                isDragging={isDragging}
                manualSortEnabled={true}
            />
        </div>
    );
};

export default SortableTaskItem;
