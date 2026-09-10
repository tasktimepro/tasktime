import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryLabel } from './CategoryLabel';

describe('category identity', () => {
    it.each(['#3b82f6', null, undefined, 'invalid'])('uses the original color or neutral fallback for %s', color => {
        render(<CategoryLabel category={{ name: 'Software', color }} />);
        expect(screen.getByText('Software')).toBeVisible();
        const dot = screen.getByTestId('category-color-dot');
        expect(dot).toHaveAttribute('aria-hidden', 'true');
        expect(dot).toHaveClass('h-2', 'w-2', 'bg-muted-foreground');
        if (color === '#3b82f6') expect(dot).toHaveStyle({ backgroundColor: color });
        else expect(dot.style.backgroundColor).toBe('');
    });
    it('labels a missing category neutrally', () => {
        render(<CategoryLabel />);
        expect(screen.getByText('Uncategorized')).toBeVisible();
    });
    it('can omit the dot when a containing expense card already carries the category color', () => {
        render(<CategoryLabel category={{ name: 'Software', color: '#3b82f6' }} showColor={false} />);
        expect(screen.getByText('Software')).toBeVisible();
        expect(screen.queryByTestId('category-color-dot')).not.toBeInTheDocument();
    });
    it('constrains long names and keeps the full label available on hover', () => {
        const name = 'Software & subscriptions';
        render(<CategoryLabel category={{ name, color: '#3b82f6' }} />);

        const label = screen.getByText(name);
        expect(label.parentElement).toHaveClass('max-w-full');
        expect(label).toHaveClass('min-w-0', 'truncate');
        expect(label).toHaveAttribute('title', name);
    });
});
