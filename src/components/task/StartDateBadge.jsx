/**
 * StartDateBadge - Shows task start date or recurring schedule.
 */

import { ArrowPathIcon, CalendarDaysIcon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { getTodayString, toDisplayDate } from '@/utils/dateUtils.ts';
import { formatRecurringLabel } from '@/utils/recurringUtils.ts';
import TaskRecurrenceDisabledBadge from './TaskRecurrenceDisabledBadge';

const getRelativeLabel = (dateString) => {
    if (!dateString) return '';

    const today = getTodayString();
    if (!today) return toDisplayDate(dateString, { month: 'short', day: 'numeric' });

    if (dateString === today) return 'Today';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    if (dateString === tomorrowString) return 'Tomorrow';

    return toDisplayDate(dateString, { month: 'short', day: 'numeric' });
};

/**
 * @param {Object} props
 * @param {string|null|undefined} props.startDate
 * @param {Object|null|undefined} props.recurring
 * @param {boolean} props.completed
 * @param {boolean} props.recurringOverdue
 * @param {boolean} props.upcoming Shows the dated Upcoming preview with a schedule icon
 * @param {boolean} props.upcomingRecurring Identifies an occurrence when its schedule record is unavailable
 */
const StartDateBadge = ({ startDate, recurring, completed, recurringOverdue = false, upcoming = false, upcomingRecurring = false }) => {
    const today = getTodayString();

    if (recurring || (upcoming && upcomingRecurring)) {
        if (recurring?.paused) {
            return <TaskRecurrenceDisabledBadge />;
        }

        if (recurringOverdue && !completed) {
            return (
                <Badge variant="warning">
                    Overdue
                </Badge>
            );
        }

        if (upcoming && startDate) {
            return (
                <Badge variant="secondary" className="flex items-center">
                    <ArrowPathIcon className="h-3 w-3 mr-1" role="img" aria-label="Recurring" aria-hidden={false} />
                    {getRelativeLabel(startDate)}
                </Badge>
            );
        }

        return (
            <Badge variant="secondary" className="flex items-center">
                <ArrowPathIcon className="h-3 w-3 mr-1" />
                {formatRecurringLabel(recurring)}
            </Badge>
        );
    }

    if (!startDate || !today) {
        return null;
    }

    const isOverdue = startDate < today && !completed;
    let variant = 'secondary';
    if (isOverdue) {
        variant = 'warning';
    }

    const label = isOverdue ? 'Overdue' : getRelativeLabel(startDate);

    return (
        <Badge variant={variant} className={upcoming && !isOverdue ? 'flex items-center' : undefined}>
            {upcoming && !isOverdue && <CalendarDaysIcon className="h-3 w-3 mr-1" role="img" aria-label="Scheduled" aria-hidden={false} />}
            {label}
        </Badge>
    );
};

export default StartDateBadge;
