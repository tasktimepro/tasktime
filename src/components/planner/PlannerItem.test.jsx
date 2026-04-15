import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlannerItem from './PlannerItem';

describe('PlannerItem', () => {

    it('renders title', () => {
        render(
            <PlannerItem
                type="task"
                title="Test Task"
                isCompleted={false}
                onClick={() => {}}
            />
        );

        expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('applies neutral styling for client type', () => {
        const { container } = render(
            <PlannerItem
                type="client"
                title="Test Client"
                isCompleted={false}
                onClick={() => {}}
            />
        );

        // Should use neutral border styling
        const item = container.firstChild;
        expect(item).toHaveClass('border-border');
    });

    it('applies neutral styling for project type', () => {
        const { container } = render(
            <PlannerItem
                type="project"
                title="Test Project"
                isCompleted={false}
                onClick={() => {}}
            />
        );

        // Should use neutral border styling
        const item = container.firstChild;
        expect(item).toHaveClass('border-border');
    });

    it('applies neutral styling for task type', () => {
        const { container } = render(
            <PlannerItem
                type="task"
                title="Test Task"
                isCompleted={false}
                onClick={() => {}}
            />
        );

        // Should use neutral border styling
        const item = container.firstChild;
        expect(item).toHaveClass('border-border');
    });

    it('applies completed styling when isCompleted is true', () => {
        render(
            <PlannerItem
                type="task"
                title="Completed Task"
                isCompleted={true}
                onClick={() => {}}
            />
        );

        const title = screen.getByText('Completed Task');
        expect(title).toHaveClass('line-through');
    });

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn();

        render(
            <PlannerItem
                type="task"
                title="Clickable Task"
                isCompleted={false}
                onClick={handleClick}
            />
        );

        fireEvent.click(screen.getByText('Clickable Task'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('allows clicking preview expense items', () => {
        const handleClick = vi.fn();

        render(
            <PlannerItem
                type="expense"
                title="Upcoming Expense"
                isCompleted={false}
                amount={20}
                amountType="fixed"
                currency="USD"
                isPreview={true}
                onClick={handleClick}
            />
        );

        fireEvent.click(screen.getByText('Upcoming Expense'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not render a pin icon even when isStatic is true', () => {
        render(
            <PlannerItem
                type="client"
                title="Static Client"
                isCompleted={false}
                isStatic={true}
                onClick={() => {}}
            />
        );

        expect(screen.queryByText('📌')).not.toBeInTheDocument();
    });

    it('renders expense metadata and mark paid action in mobile layout', () => {
        const handleMarkPaid = vi.fn();

        render(
            <PlannerItem
                type="expense"
                layout="mobile"
                title="Phone bill"
                amount={15.99}
                amountType="variable"
                currency="EUR"
                supplierName="A1"
                onMarkPaid={handleMarkPaid}
                onClick={() => {}}
            />
        );

        expect(screen.getByText('~€15.99 EUR')).toBeInTheDocument();
        expect(screen.getByText('A1')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
        expect(handleMarkPaid).toHaveBeenCalledTimes(1);
    });

    it('ignores desktop height scaling in mobile layout', () => {
        const { container } = render(
            <PlannerItem
                type="task"
                layout="mobile"
                title="Mobile task"
                heightPercent={0.9}
                onClick={() => {}}
            />
        );

        const item = container.firstChild;
        expect(item.style.height).toBe('auto');
        expect(item.style.minHeight).toBe('56px');
    });

    it('does not animate planner item height changes', () => {
        const { container } = render(
            <PlannerItem
                type="task"
                title="Stable layout task"
                heightPercent={0.9}
                onClick={() => {}}
            />
        );

        const item = container.firstChild;
        expect(item).toHaveClass('transition-shadow');
        expect(item).not.toHaveClass('transition-all');
    });

    it('keeps desktop planner items compact without mobile metadata rows', () => {
        render(
            <PlannerItem
                type="expense"
                title="Studio rent"
                amount={1200}
                amountType="fixed"
                currency="EUR"
                supplierName="Landlord"
                onClick={() => {}}
            />
        );

        expect(screen.queryByText('Landlord')).not.toBeInTheDocument();
        expect(screen.queryByText(/€1,200.00 EUR|€1200.00 EUR|€1,200 EUR|€1200 EUR/)).not.toBeInTheDocument();
    });
});
