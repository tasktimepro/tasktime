import { KanbanIcon } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * TaskPlanner component - Placeholder view for upcoming planning features
 */
const TaskPlanner = () => {

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Task Planner</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Plan work with a weekly calendar view.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Coming soon</CardTitle>
                </CardHeader>
                <CardContent>
                    <EmptyState
                        icon={KanbanIcon}
                        title="Task Planner is coming soon"
                        description="We’re preparing the planning experience. Check back soon."
                    />
                </CardContent>
            </Card>
        </div>
    );
};

export default TaskPlanner;
