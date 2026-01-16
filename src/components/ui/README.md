# UI Component Design Philosophy

> **Purpose:** Guidelines for creating flexible, reusable UI components
> **Created:** January 16, 2026

---

## Core Principles

### 1. Maximum Flexibility via Props

Every component should accept props for all common variations rather than requiring wrapper elements or className hacks.

```jsx
// ✅ GOOD - Flexible props
<Button 
    leadingIcon={PlusIcon}
    loading={isSaving}
    loadingText="Saving..."
    fullWidth
>
    Save Project
</Button>

// ❌ BAD - Requires manual composition
<Button className="w-full">
    {isSaving ? <Spinner /> : <PlusIcon />}
    {isSaving ? "Saving..." : "Save Project"}
</Button>
```

### 2. Standard Prop Patterns

Use consistent prop names across all components:

| Prop | Type | Purpose |
|------|------|---------|
| `variant` | string | Visual style (primary, secondary, destructive, etc.) |
| `size` | string | Size variant (xs, sm, md, lg, xl) |
| `leadingIcon` | ElementType | Icon component before content |
| `trailingIcon` | ElementType | Icon component after content |
| `loading` | boolean | Loading state |
| `loadingText` | string | Text shown during loading |
| `disabled` | boolean | Disabled state |
| `fullWidth` | boolean | Stretch to container width |
| `className` | string | Escape hatch for custom styles |

### 3. Icon Props Accept Components, Not Elements

```jsx
// ✅ GOOD - Pass the component
<Button leadingIcon={PlusIcon}>Add</Button>
<EmptyState icon={DocumentIcon} />

// ❌ BAD - Pass JSX element
<Button leadingIcon={<PlusIcon className="h-4 w-4" />}>Add</Button>
```

This allows the component to control icon sizing based on its own size prop.

### 4. Spread Native Props

Always spread remaining props to the underlying element:

```jsx
const Button = ({ variant, size, leadingIcon, ...props }) => {
    return (
        <button {...props}> {/* ← Spreads onClick, aria-*, data-*, etc. */}
            ...
        </button>
    );
};
```

### 5. Support `asChild` Pattern (Radix)

For components that might wrap other elements (links, etc.):

```jsx
// Render as a link
<Button asChild>
    <a href="/projects">View Projects</a>
</Button>
```

### 6. Use `cn()` for Class Merging

Always use the `cn()` utility to merge classes safely:

```jsx
import { cn } from '@/lib/utils';

<div className={cn(
    "base-classes",
    variant === "primary" && "variant-classes",
    fullWidth && "w-full",
    className // User's custom classes always last
)} />
```

---

## Component Checklist

When creating or modifying a UI component, ensure:

- [ ] All common variations are props (not className hacks)
- [ ] Icons are passed as components, sized automatically
- [ ] Loading state is built-in where applicable
- [ ] Native HTML props are spread through
- [ ] `className` prop allows customization escape hatch
- [ ] Uses `cn()` for class merging
- [ ] Has JSDoc comments documenting all props
- [ ] Has PropTypes for runtime validation

---

## Current Components Following This Pattern

| Component | Location | Key Props |
|-----------|----------|-----------|
| Button | `ui/button.jsx` | variant, size, leadingIcon, trailingIcon, loading, loadingText, fullWidth |
| EmptyState | `ui/empty-state.jsx` | icon, title, description, actionLabel, actionIcon, onAction |
| StatCard | `ui/stat-card.jsx` | title, value, subtitle, icon, variant, onClick |
| Checkbox | `ui/checkbox.jsx` | checked, onCheckedChange, disabled |
| Dialog | `ui/dialog.jsx` | open, onOpenChange, hideCloseButton |

---

## Adding New Components

1. Check if shadcn/ui has it: `npx shadcn@latest add [component]`
2. If extending, add flexible props following patterns above
3. If creating custom, follow the checklist
4. Document in this file when adding significant components
