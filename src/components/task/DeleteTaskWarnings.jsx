import { Notice } from '@/components/ui/notice';
import { millisecondsToHours } from '@/utils/dateUtils.ts';

const DeleteTaskWarnings = ({ summary, taskCount = 1 }) => {
    if (!summary?.hasUnbilledTime && !summary?.hasBilledTime) {
        return null;
    }

    const subject = taskCount > 1 ? 'This task and its subtasks' : 'This task';
    const verb = taskCount > 1 ? 'include' : 'includes';
    const objectPronoun = taskCount > 1 ? 'them' : 'it';
    const unbilledHours = millisecondsToHours(summary.unbilledTimeMs || 0);

    return (
        <div className="space-y-3">
            {summary.hasUnbilledTime && (
                <Notice
                    title={`${subject} ${verb} ${unbilledHours.toFixed(2)} unbilled hours.`}
                    description={`Deleting ${objectPronoun} will permanently remove billable time that has not been included on an invoice yet.`}
                    variant="warning"
                />
            )}
            {summary.hasBilledTime && (
                <Notice
                    title={`${subject} ${verb} time that is already recorded on an invoice.`}
                    description={`Deleting ${objectPronoun} will not remove historical invoices or their line items, but it will remove the live task and time entry records from TaskTime Pro.`}
                    variant="warning"
                />
            )}
        </div>
    );
};

export default DeleteTaskWarnings;