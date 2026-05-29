import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import TaskInlineEstimateFields from './TaskInlineEstimateFields';
import { cn } from '@/lib/utils';

const TaskEstimateDropdown = ({
    idPrefix,
    estimatedHours,
    onEstimatedHoursChange,
    estimatedFlatAmount,
    onEstimatedFlatAmountChange,
    isFlatRateProject = false,
    className,
    contentAlign = 'end',
}) => {
    const hasEstimateValue = Boolean(
        (typeof estimatedHours === 'string' && estimatedHours.trim())
        || (typeof estimatedFlatAmount === 'string' && estimatedFlatAmount.trim())
    );

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant={hasEstimateValue ? 'secondary' : 'outline'}
                    className={cn('shrink-0', className)}
                >
                    Estimate
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={contentAlign}
                className="w-[min(22rem,calc(100vw-2rem))] p-3"
                onCloseAutoFocus={(event) => event.preventDefault()}
            >
                <TaskInlineEstimateFields
                    idPrefix={idPrefix}
                    estimatedHours={estimatedHours}
                    onEstimatedHoursChange={onEstimatedHoursChange}
                    estimatedFlatAmount={estimatedFlatAmount}
                    onEstimatedFlatAmountChange={onEstimatedFlatAmountChange}
                    isFlatRateProject={isFlatRateProject}
                    variant="plain"
                    showHeading={false}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default TaskEstimateDropdown;
