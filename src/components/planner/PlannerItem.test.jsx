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

    it('renders expense metadata without a mark paid action in mobile layout', () => {
        render(
            <PlannerItem
                type="expense"
                layout="mobile"
                title="Phone bill"
                amount={15.99}
                amountType="variable"
                currency="EUR"
                supplierName="A1"
                onClick={() => {}}
            />
        );

        expect(screen.getByText('~€15.99 EUR')).toBeInTheDocument();
        expect(screen.getByText('A1')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeInTheDocument();
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

    it('shows quote stage and deadline metadata for project items', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-24T12:00:00Z'));

        render(
            <PlannerItem
                type="project"
                title="Quoted project"
                projectStatusMode="quote"
                projectDeadline="2026-03-28"
                onClick={() => {}}
            />
        );

        expect(screen.getByText('Quote stage')).toBeInTheDocument();
        expect(screen.getByText('Due Mar 28')).toBeInTheDocument();

        vi.useRealTimers();
    });

    it('shows completed metadata for resolved project deadlines', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-30T12:00:00Z'));

        render(
            <PlannerItem
                type="project"
                title="Resolved project"
                projectDeadline="2026-03-28"
                projectDeadlineResolvedAt={Date.UTC(2026, 2, 29)}
                onClick={() => {}}
            />
        );

        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.queryByText('2d overdue')).not.toBeInTheDocument();

        vi.useRealTimers();
    });

    it('renders deadline marker projects as a single-line project deadline label without extra metadata', () => {
        render(
            <PlannerItem
                type="project"
                title="Deadline: Quoted project"
                projectStatusMode="quote"
                projectDeadline="2026-03-28"
                isProjectDeadlineItem={true}
                layout="mobile"
                onClick={() => {}}
            />
        );

        const title = screen.getByText('Deadline: Quoted project');

        expect(title).toHaveClass('truncate');
        expect(title).toHaveClass('whitespace-nowrap');
        expect(screen.queryByText('Quote stage')).not.toBeInTheDocument();
        expect(screen.queryByText('Due Mar 28')).not.toBeInTheDocument();
    });
});
