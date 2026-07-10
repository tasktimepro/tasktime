# Design System

## Foundation

TaskTime Pro uses Tailwind with CSS custom properties defined in `src/index.css` and `src/styles/theme.css`. Shared primitives live under `src/components/ui/` and build on Radix where appropriate. Lucide is the standard icon source.

## Tokens

- Use semantic tokens such as background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, and ring.
- Use the defined info, success, warning, and danger surface/border/foreground/accent tokens for status communication.
- Preserve light, dark, and system theme behavior.
- Use existing radius, scrollbar, viewport-height, safe-area, spacing, typography, shadow, motion, and breakpoint conventions.
- Arbitrary one-off color, radius, shadow, spacing, z-index, or breakpoint values require a documented reason.

## Components

Prefer shared buttons, inputs, labels, selects, dialogs, dropdowns, cards, badges, notices, empty states, tabs, tooltips, date/time controls, and icons. Add reusable variants centrally instead of restyling repeated controls at call sites.

## Product patterns

- Lists/tables support scanning and comparison; cards are reserved for meaningful grouped summaries/previews.
- Modals are for short focused work. Complex invoice, report, account, or multi-section workflows receive enough layout space.
- Destructive actions are explicit, separated, and accompanied by relationship/consequence information.
- Forms retain values on validation failure and use specific error/help copy.
- Mobile navigation respects safe areas and touch targets; desktop layouts may use higher density, tables, split views, or persistent navigation.

## Required states

Every relevant component covers default, hover, focus, active, selected, disabled, loading, empty, error, offline, success, and destructive/confirmation states. Status cannot rely on color alone.
