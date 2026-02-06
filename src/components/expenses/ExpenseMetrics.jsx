/**
 * ExpenseMetrics component - Summary cards for expense totals
 */

import { Card, CardContent } from '@/components/ui/card';

const ExpenseMetrics = ({
    totalLabel,
    unpaidLabel,
    billableLabel,
    paidLabel,
}) => {

    const cards = [
        { label: 'Total', value: totalLabel },
        { label: 'Unpaid', value: unpaidLabel },
        { label: 'Billable Unbilled', value: billableLabel },
        { label: 'Paid', value: paidLabel },
    ];

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.label}>
                    <CardContent className="p-4">
                        <div className="text-sm text-muted-foreground">
                            {card.label}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-foreground">
                            {card.value}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default ExpenseMetrics;
