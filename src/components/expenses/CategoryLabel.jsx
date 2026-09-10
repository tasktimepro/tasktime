import { cn } from '@/lib/utils';
/* eslint-disable react-refresh/only-export-components */

/** Only stored six-digit tags can become inline styles. */
export function getExpenseCategoryColor(category) {
    return /^#[a-f\d]{6}$/i.test(category?.color || '') ? category.color : null;
}

/** Category identity follows project/client tags: original color, 8px dot, neutral fallback. */
export function CategoryColorDot({ category, className }) {
    const color = getExpenseCategoryColor(category);
    return <span aria-hidden="true" data-testid="category-color-dot" className={cn('h-2 w-2 shrink-0 rounded-full bg-muted-foreground', className)}
        style={color ? { backgroundColor: color } : undefined} />;
}

export function CategoryLabel({ category, showColor = true }) {
    const label = category?.name || 'Uncategorized';

    return <span className="inline-flex min-w-0 max-w-full items-center gap-2">
        {showColor ? <CategoryColorDot category={category} /> : null}
        <span className="min-w-0 truncate" title={label}>{label}</span>
    </span>;
}
