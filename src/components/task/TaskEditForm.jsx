import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const stopDragPropagation = (event) => {
    event.stopPropagation();
};

/**
 * TaskEditForm component - Inline edit form for task title.
 * @param {Object} props
 */
const TaskEditForm = ({
    editTitle,
    setEditTitle,
    onSave,
    onCancel,
    isCompleted
}) => {
    return (
        <form onSubmit={onSave} className="flex items-center space-x-2" onPointerDownCapture={stopDragPropagation}>
            <Input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1"
                autoFocus
                disabled={isCompleted}
            />

            <Button type="submit" size="sm">
                Save
            </Button>

            <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onCancel}
            >
                Cancel
            </Button>
        </form>
    );
};

export default TaskEditForm;
