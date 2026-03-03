type InvoiceLikeTask = {
    id: string;
    parentTaskId?: string | null;
};

/**
 * Orders tasks so each subtask appears directly after its parent task.
 * Preserves the original relative order among root tasks and sibling subtasks.
 * @param tasks
 */
export const orderTasksWithSubtasks = <T extends InvoiceLikeTask>(tasks: T[]): T[] => {
    const tasksById = new Map(tasks.map(task => [task.id, task]));
    const childrenByParentId = new Map<string, T[]>();
    const orderedTasks: T[] = [];
    const visitedTaskIds = new Set<string>();

    tasks.forEach(task => {
        if (!task.parentTaskId) {
            return;
        }

        const currentChildren = childrenByParentId.get(task.parentTaskId) || [];
        currentChildren.push(task);
        childrenByParentId.set(task.parentTaskId, currentChildren);
    });

    const appendTaskWithChildren = (task: T | undefined) => {
        if (!task || visitedTaskIds.has(task.id)) {
            return;
        }

        visitedTaskIds.add(task.id);
        orderedTasks.push(task);

        const childTasks = childrenByParentId.get(task.id) || [];
        childTasks.forEach(childTask => {
            appendTaskWithChildren(childTask);
        });
    };

    tasks.forEach(task => {
        const parentExistsInTaskList = task.parentTaskId && tasksById.has(task.parentTaskId);
        if (!parentExistsInTaskList) {
            appendTaskWithChildren(task);
        }
    });

    tasks.forEach(task => {
        if (!visitedTaskIds.has(task.id)) {
            appendTaskWithChildren(task);
        }
    });

    return orderedTasks;
};
