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
});
