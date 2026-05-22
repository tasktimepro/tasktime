import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { cn } from '@/lib/utils';
import useIsMobileLayout from '../../../hooks/useIsMobileLayout';

/**
 * SubtaskCreateForm component - Form for creating subtasks.
 * @param {Object} props
 */
const SubtaskCreateForm = ({
    newSubtaskTitle,
    setNewSubtaskTitle,
    newSubtaskNote,
    setNewSubtaskNote,
    newSubtaskStartDate,
    setNewSubtaskStartDate,
    onCreateSubtask,
    onCancel,
    isDisabled
}) => {
    const isMobileLayout = useIsMobileLayout();

    if (isDisabled) {
        return null;
    }

    return (
        <form
            onSubmit={onCreateSubtask}
            className={cn('space-y-3', isMobileLayout && 'rounded-lg border border-border bg-card p-3')}
            data-testid="subtask-create-form"
        >
            <div className={cn(isMobileLayout ? 'space-y-3' : 'flex items-center space-x-3')}>
                <Input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Enter subtask title"
                    className={cn(!isMobileLayout && 'flex-1')}
                    autoFocus
                />
                <Input
                    type="text"
                    value={newSubtaskNote}
                    onChange={(e) => setNewSubtaskNote(e.target.value)}
                    placeholder="Note"
                    className={cn(!isMobileLayout && 'flex-1')}
                />
                <NativeDateInput
                    value={newSubtaskStartDate}
                    onChange={(e) => {
                        setNewSubtaskStartDate(e.target.value);
                    }}
                    className={cn(isMobileLayout ? 'w-full dark:[color-scheme:dark]' : 'w-40 dark:[color-scheme:dark]')}
                />
                <div className={cn('flex gap-2', isMobileLayout && 'justify-end')}>
                    <Button type="submit" size="sm">
                        Add
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </form>
    );
};

export default SubtaskCreateForm;
