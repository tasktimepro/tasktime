import { ClipboardDocumentCheckIcon, ListFilterIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useIsMobileLayout from '../../hooks/useIsMobileLayout';
import { formatCurrency, getProjectCurrency } from '../../utils/currencyUtils.ts';
import { PROJECT_FILTER_OPTIONS } from './dashboardOverviewUtils.ts';
import CardSearchControl from './CardSearchControl';

/**
 * ProjectsOverview component - Recent projects list with search.
 * @param {Object} props
 */
const ProjectsOverview = ({
    recentProjects,
    projectFilter,
    setProjectFilter,
    projectSearchQuery,
    setProjectSearchQuery,
    navigateToProject,
    handleClientTitleClick,
    clients,
    preferredCurrency
}) => {
    const isMobileLayout = useIsMobileLayout();
    const emptyStateMessage = projectSearchQuery
        ? 'No projects found matching your search'
        : projectFilter === 'unbilled'
            ? 'No unbilled projects found'
            : 'No recent projects found';

    return (
        <Card>
            <CardHeader className="px-3 pt-3 pb-2 sm:px-5 sm:pt-4 sm:pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="order-1 mr-auto flex items-center text-lg">
                        <ClipboardDocumentCheckIcon className="status-info-text-strong mr-2 h-5 w-5" />
                        Projects
                    </CardTitle>
                    <CardSearchControl
                        value={projectSearchQuery}
                        onChange={setProjectSearchQuery}
                        placeholder="Search projects"
                        buttonLabel="Search projects"
                        inputAriaLabel="Search projects"
                        buttonClassName="order-2"
                        inputClassName="order-4 basis-full sm:order-3 sm:basis-auto"
                    />
                    <Select value={projectFilter} onValueChange={setProjectFilter}>
                            <SelectTrigger
                                className={isMobileLayout ? 'order-3 h-9 w-9' : 'order-4 w-[132px]'}
                                aria-label="Filter projects"
                                leadingIcon={ListFilterIcon}
                                hideCaret={isMobileLayout}
                                iconOnly={isMobileLayout}
                            >
                                {isMobileLayout ? (
                                    <span className="sr-only">
                                        <SelectValue placeholder="Filter projects" />
                                    </span>
                                ) : (
                                    <SelectValue placeholder="Filter projects" />
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                {PROJECT_FILTER_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                </div>
            </CardHeader>
            <CardContent className="px-3 pb-2.5 pt-0 sm:px-5 sm:pb-4 max-h-96 overflow-y-auto">
                {recentProjects.length > 0 ? (
                    <div className="divide-y divide-border">
                        {recentProjects.map((project) => (
                            <div key={project.id} className="px-3 py-3 hover:bg-muted transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <button
                                            onClick={() => navigateToProject(project.id)}
                                            className="hover-status-info-text-strong text-sm font-medium text-foreground truncate cursor-pointer text-left block"
                                            title={`Click to open ${project.title} project`}
                                        >
                                            {project.title}
                                        </button>
                                        <div className="text-xs text-muted-foreground">
                                            {project.client ? (
                                                <span>
                                                    <button
                                                        onClick={() => handleClientTitleClick(project.client)}
                                                        className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                                                        title={`Click to open ${project.client.title} client dashboard`}
                                                    >
                                                        {project.client.title}
                                                    </button>
                                                    <span> <span className="mx-1">•</span> {project.pendingHours.toFixed(1)}h pending</span>
                                                </span>
                                            ) : (
                                                <span>Personal <span className="mx-1">•</span> {project.pendingHours.toFixed(1)}h</span>
                                            )}
                                        </div>
                                    </div>
                                    {!project.isPersonal && (
                                        <div className="text-right">
                                            {/* Pending Bills */}
                                            <div className="text-sm font-medium text-foreground">
                                                {project.pendingAmount > 0 ? (
                                                    <span className="sensitive-data">
                                                        {formatCurrency(project.pendingAmount, getProjectCurrency(project, clients, preferredCurrency))}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground sensitive-data">{formatCurrency(0, getProjectCurrency(project, clients, preferredCurrency))}</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                bills
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-6 py-8 text-center text-muted-foreground">
                        <ClipboardDocumentCheckIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm">
                            {emptyStateMessage}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ProjectsOverview;
