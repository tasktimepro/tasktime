import { HandCoinsIcon } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Expenses component - Placeholder view for upcoming expenses features
 */
const Expenses = () => {

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Track and manage expenses.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Coming soon</CardTitle>
                </CardHeader>
                <CardContent>
                    <EmptyState
                        icon={HandCoinsIcon}
                        title="Expenses is coming soon"
                        description="We’re preparing the expenses experience. Check back soon."
                    />
                </CardContent>
            </Card>
        </div>
    );
};

export default Expenses;
