import { ClockIcon, ListFilterIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useIsMobileLayout from '../../hooks/useIsMobileLayout';
import { formatDuration, toDisplayDate } from '../../utils/dateUtils.ts';
import { DEFAULT_TIME_ENTRIES_PROJECT_FILTER } from './dashboardWidgetConstants';

const TimeEntriesOverview = ({
    entries,
    projects,
    projectFilter,
    setProjectFilter,
    onTaskClick,
    onProjectClick,
}) => {
    const isMobileLayout = useIsMobileLayout();
    const emptyStateMessage = projectFilter === DEFAULT_TIME_ENTRIES_PROJECT_FILTER
        ? 'No time entries in the last 30 days'
        : 'No time entries for this project in the last 30 days';

    return (
        <Card>
            <CardHeader className="px-3 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="mr-auto flex items-center text-lg">
                        <ClockIcon className="status-info-text-strong mr-2 h-5 w-5" />
                        Time Entries
                    </CardTitle>
                    <Select value={projectFilter} onValueChange={setProjectFilter}>
                        <SelectTrigger
                            className={isMobileLayout ? 'h-9 w-9' : 'w-[168px]'}
                            aria-label="Filter time entries by project"
                            leadingIcon={ListFilterIcon}
                            hideCaret={isMobileLayout}
                            iconOnly={isMobileLayout}
                        >
                            {isMobileLayout ? (
                                <span className="sr-only">
                                    <SelectValue placeholder="Filter time entries" />
                                </span>
                            ) : (
                                <SelectValue placeholder="Filter time entries" />
                            )}
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={DEFAULT_TIME_ENTRIES_PROJECT_FILTER}>All projects</SelectItem>
                            {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                    {project.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="px-3 pb-2.5 pt-0 sm:px-5 sm:pb-4 max-h-96 overflow-y-auto">
                {entries.length > 0 ? (
                    <div className="divide-y divide-border">
                        {entries.map((entry) => {
                            const duration = entry.end > entry.start
                                ? formatDuration(entry.end - entry.start)
                                : '0m';

                            return (
                                <div key={entry.id} className="px-3 py-3 hover:bg-muted transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1 space-y-1">
                                            {entry.task ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onTaskClick?.(entry.task)}
                                                    className="block truncate text-left text-sm font-medium text-foreground hover-status-info-text-strong cursor-pointer"
                                                    title={`Open ${entry.task.title}`}
                                                >
                                                    {entry.task.title}
                                                </button>
                                            ) : (
                                                <p className="truncate text-sm font-medium text-foreground">
                                                    Deleted task
                                                </p>
                                            )}
                                            <p className="truncate text-xs text-muted-foreground">
                                                {entry.project ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => onProjectClick?.(entry.project.id)}
                                                            className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                                            title={`Open ${entry.project.title}`}
                                                        >
                                                            {entry.project.title}
                                                        </button>
                                                        <span className="mx-1">•</span>
                                                    </>
                                                ) : null}
                                                {toDisplayDate(entry.start, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                            {entry.note ? (
                                                <p className="line-clamp-2 text-xs text-muted-foreground">
                                                    {entry.note}
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-sm font-medium text-foreground">{duration}</div>
                                            <div className="text-xs text-muted-foreground">Logged</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="px-6 py-8 text-center text-muted-foreground">
                        <ClockIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm">{emptyStateMessage}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default TimeEntriesOverview;