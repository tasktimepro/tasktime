/**
 * StartDateBadge - Shows task start date or recurring schedule.
 */

import { differenceInCalendarDays, parseISO } from 'date-fns';
import { ArrowPathIcon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { getTodayString, toDisplayDate } from '@/utils/dateUtils.ts';
import { formatRecurringLabel } from '@/utils/recurringUtils.ts';

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
 */
const StartDateBadge = ({ startDate, recurring, completed }) => {
    const today = getTodayString();

    if (recurring) {
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
    const dayDiff = differenceInCalendarDays(parseISO(startDate), parseISO(today));
    const isSoon = dayDiff > 0 && dayDiff <= 3;

    let variant = 'muted';
    if (isOverdue) {
        variant = 'warning';
    } else if (startDate === today || isSoon) {
        variant = 'secondary';
    }

    const label = isOverdue ? 'Overdue' : getRelativeLabel(startDate);

    return (
        <Badge variant={variant}>
            {label}
        </Badge>
    );
};

export default StartDateBadge;
