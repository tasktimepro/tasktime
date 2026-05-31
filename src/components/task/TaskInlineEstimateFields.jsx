import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const TaskInlineEstimateFields = ({
    idPrefix = 'task-inline-estimate',
    estimatedHours,
    onEstimatedHoursChange,
    estimatedFlatAmount,
    onEstimatedFlatAmountChange,
    isFlatRateProject = false,
    className,
    variant = 'card',
    showHeading = true,
}) => {
    const containerClassName = variant === 'plain'
        ? 'space-y-3'
        : 'space-y-3 rounded-lg border border-border bg-muted/30 p-3';

    return (
        <div className={cn(containerClassName, className)}>
            {showHeading && (
                <h4 className="text-sm font-medium text-foreground">Estimate</h4>
            )}

            <div className={cn('grid gap-3', isFlatRateProject && 'sm:grid-cols-2')}>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-hours`}>Estimated Hours</Label>
                    <Input
                        id={`${idPrefix}-hours`}
                        type="number"
                        min="0"
                        step="0.25"
                        value={estimatedHours}
                        onChange={(event) => onEstimatedHoursChange(event.target.value)}
                        placeholder="0.00"
                        className="sensitive-data"
                    />
                </div>

                {isFlatRateProject && (
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}-quote`}>Quote Amount</Label>
                        <Input
                            id={`${idPrefix}-quote`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={estimatedFlatAmount}
                            onChange={(event) => onEstimatedFlatAmountChange(event.target.value)}
                            placeholder="0.00"
                            className="sensitive-data"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskInlineEstimateFields;