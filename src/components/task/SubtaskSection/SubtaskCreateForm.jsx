import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDateInput } from '@/components/ui/native-date-input';
import { cn } from '@/lib/utils';
import TaskEstimateDropdown from '../TaskEstimateDropdown';
import TaskInlineEstimateFields from '../TaskInlineEstimateFields';
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
    newSubtaskEstimatedHours = '',
    setNewSubtaskEstimatedHours,
    newSubtaskEstimatedFlatAmount = '',
    setNewSubtaskEstimatedFlatAmount,
    showEstimateFields = false,
    isFlatRateProject = false,
    onCreateSubtask,
    onCancel,
    isDisabled,
    forceStackedLayout = false,
}) => {
    const isMobileLayout = useIsMobileLayout();
    const isStackedLayout = isMobileLayout || forceStackedLayout;

    if (isDisabled) {
        return null;
    }

    return (
        <form
            onSubmit={onCreateSubtask}
            className={cn('space-y-3', isStackedLayout && 'rounded-lg border border-border bg-card p-3')}
            data-testid="subtask-create-form"
        >
            <div className={cn(isStackedLayout ? 'space-y-3' : 'flex items-center space-x-3')}>
                <Input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Enter subtask title"
                    className={cn(!isStackedLayout && 'flex-1')}
                    autoFocus
                />
                <Input
                    type="text"
                    value={newSubtaskNote}
                    onChange={(e) => setNewSubtaskNote(e.target.value)}
                    placeholder="Note"
                    className={cn(!isStackedLayout && 'flex-1')}
                />
                <NativeDateInput
                    value={newSubtaskStartDate}
                    onChange={(e) => {
                        setNewSubtaskStartDate(e.target.value);
                    }}
                    className={cn(isStackedLayout ? 'w-full dark:[color-scheme:dark]' : 'w-40 dark:[color-scheme:dark]')}
                />
                {showEstimateFields && !isStackedLayout && (
                    <TaskEstimateDropdown
                        idPrefix="subtask-inline-create"
                        estimatedHours={newSubtaskEstimatedHours}
                        onEstimatedHoursChange={setNewSubtaskEstimatedHours}
                        estimatedFlatAmount={newSubtaskEstimatedFlatAmount}
                        onEstimatedFlatAmountChange={setNewSubtaskEstimatedFlatAmount}
                        isFlatRateProject={isFlatRateProject}
                    />
                )}
                {showEstimateFields && isStackedLayout && (
                    <TaskInlineEstimateFields
                        idPrefix="subtask-inline-create"
                        estimatedHours={newSubtaskEstimatedHours}
                        onEstimatedHoursChange={setNewSubtaskEstimatedHours}
                        estimatedFlatAmount={newSubtaskEstimatedFlatAmount}
                        onEstimatedFlatAmountChange={setNewSubtaskEstimatedFlatAmount}
                        isFlatRateProject={isFlatRateProject}
                        variant="plain"
                        showHeading={false}
                    />
                )}
                <div className={cn('flex gap-2', isStackedLayout ? 'justify-end' : 'ml-auto shrink-0')}>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" size="sm">
                        Add
                    </Button>
                </div>
            </div>
        </form>
    );
};

export default SubtaskCreateForm;
