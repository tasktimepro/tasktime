import { CalendarOffIcon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Shows the persisted disabled recurrence state using the shared schedule-tag pattern. */
export default function TaskRecurrenceDisabledBadge({ className }) {
    return (
        <Badge
            variant="secondary"
            aria-label="Recurring task disabled"
            title="Recurring task disabled"
            className={cn('w-fit', className)}
        >
            <CalendarOffIcon aria-hidden="true" className="mr-1 h-3 w-3" />
            Disabled
        </Badge>
    );
}
