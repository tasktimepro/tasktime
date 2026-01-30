import { ClipboardDocumentCheckIcon, MagnifyingGlassIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, getProjectCurrency } from '../../utils/currencyUtils.ts';

/**
 * ProjectsOverview component - Recent projects list with search.
 * @param {Object} props
 */
const ProjectsOverview = ({
    recentProjects,
    projectSearchQuery,
    setProjectSearchQuery,
    navigateToProject,
    handleClientTitleClick,
    clients
}) => {
    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-lg">
                        <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                        Recent Projects
                    </CardTitle>
                    <div className="relative">
                        <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <Input
                            type="text"
                            placeholder="Search projects"
                            value={projectSearchQuery}
                            onChange={(e) => setProjectSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 max-h-96 overflow-y-auto">
                {recentProjects.length > 0 ? (
                    <div className="divide-y divide-border">
                        {recentProjects.map((project) => (
                            <div key={project.id} className="px-3 py-3 hover:bg-muted transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <button
                                            onClick={() => navigateToProject(project.id)}
                                                    className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-blue-600 dark:text-blue-400 text-left block"
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
                                                <span>Personal <span className="mx-1">•</span> {project.pendingHours.toFixed(1)}h pending</span>
                                            )}
                                        </div>
                                    </div>
                                    {!project.isPersonal && (
                                        <div className="text-right">
                                            {/* Pending Bills */}
                                            <div className="text-sm font-medium text-foreground">
                                                {project.pendingAmount > 0 ? (
                                                    <span className="sensitive-data">
                                                        {formatCurrency(project.pendingAmount, getProjectCurrency(project, clients))}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground sensitive-data">{formatCurrency(0, getProjectCurrency(project, clients))}</span>
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
                            {projectSearchQuery ? 'No projects found matching your search' : 'No recent projects found'}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ProjectsOverview;
