# Design Discipline

Use these rules for UI, UX, layout, interaction, accessibility, and design-system work.

## Decision order

1. Existing TaskTime Pro product patterns
2. Existing shared UI components and tokens
3. Radix and other component primitives already installed
4. Familiar platform conventions
5. New custom interaction only when the existing system cannot solve the task well

Choose patterns for the user's task, not implementation convenience. A novel interaction needs a clear rationale and user approval before implementation.

## Required qualities

- Make the primary action and information hierarchy obvious.
- Keep controls close to the content they affect and use familiar, specific labels.
- Use tables for comparison, lists for scanning, cards for heterogeneous previews, modals for short focused work, and full pages for complex workflows.
- Start mobile-first, then adapt density and composition for larger screens instead of merely stretching the mobile layout.
- Reuse the existing spacing, color, typography, radius, shadow, motion, breakpoint, and z-index systems. Do not introduce arbitrary one-off values.

## Complete states

Interactive work must consider default, hover, focus, active, selected, disabled, loading, empty, error, and success states where relevant. Preserve entered data on validation failure and make destructive consequences explicit.

## Accessibility

Use semantic markup, keyboard-operable controls, visible focus, accessible names, logical reading order, sufficient contrast, non-color state cues, useful error messages, and appropriate touch targets. Motion must not be required for comprehension.

Use `.agents/skills/design-discipline/SKILL.md` for the implementation and review workflow.
