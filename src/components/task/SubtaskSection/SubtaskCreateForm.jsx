import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RecurringPicker from '../RecurringPicker';

/**
 * SubtaskCreateForm component - Form for creating subtasks.
 * @param {Object} props
 */
const SubtaskCreateForm = ({
    newSubtaskTitle,
    setNewSubtaskTitle,
    newSubtaskStartDate,
    setNewSubtaskStartDate,
    newSubtaskRecurring,
    setNewSubtaskRecurring,
    onCreateSubtask,
    onCancel,
    isDisabled
}) => {
    if (isDisabled) {
        return null;
    }

    return (
        <form onSubmit={onCreateSubtask} className="space-y-3">
            <div className="flex items-center space-x-3">
                <Input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Enter subtask title"
                    className="flex-1 text-sm"
                    autoFocus
                />
                <Input
                    type="date"
                    value={newSubtaskStartDate}
                    onChange={(e) => {
                        setNewSubtaskStartDate(e.target.value);
                        if (e.target.value) {
                            setNewSubtaskRecurring(null);
                        }
                    }}
                    className="w-36"
                    disabled={Boolean(newSubtaskRecurring)}
                />
                <RecurringPicker
                    value={newSubtaskRecurring}
                    onChange={(config) => {
                        setNewSubtaskRecurring(config);
                        setNewSubtaskStartDate('');
                    }}
                    onClear={() => setNewSubtaskRecurring(null)}
                />
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
        </form>
    );
};

export default SubtaskCreateForm;
