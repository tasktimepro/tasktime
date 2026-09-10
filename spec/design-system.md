# Design System

## Foundation

TaskTime Pro uses Tailwind with CSS custom properties defined in `src/index.css` and `src/styles/theme.css`. Shared primitives live under `src/components/ui/` and build on Radix where appropriate. Lucide is the standard icon source.

Use **TaskTime Pro** as the product name in user-facing copy, including app-opening
CTAs. **Free** and **Pro** are plan labels; say “the Pro plan” where the product
name and plan could otherwise be confused. Technical identifiers and URLs retain
their existing names.

Project identity uses `ProjectIcon` (Lucide `FolderClosed`) from the shared icon
module across navigation, onboarding, project summaries, empty states, filters,
and the public homepage. Task quick-create retains its clipboard icon.
Homepage UI icons use the app's shared Lucide exports, including hero chips,
cards, screenshot placeholders, checklist checks, link arrows, and theme controls.
`ProductIcon.astro` renders them to decorative static SVG at build time, with
card and inline variants and Lucide's standard stroke weight. The Local-first
chip, browser-local card, and app onboarding share `ShieldCheckIcon`.
Brand logos retain their dedicated artwork.
The homepage ownership section uses soft neutral corner gradients and a defined
border for depth, keeping the homepage monochrome. Its surface and text follow
the selected light, dark, or system theme through existing semantic tokens.

## Tokens

- Use semantic tokens such as background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, and ring.
- Use the defined info, success, warning, and danger surface/border/foreground/accent tokens for status communication.
- Preserve light, dark, and system theme behavior.
- Use existing radius, scrollbar, viewport-height, safe-area, spacing, typography, shadow, motion, and breakpoint conventions.
- Arbitrary one-off color, radius, shadow, spacing, z-index, or breakpoint values require a documented reason.

## Components

Expense category Color Tags reuse the project/client `ColorPicker`, including
its clear/neutral choice. Compact category labels use the same 8px original-color
dot as dashboard projects, with neutral text and a neutral missing-color fallback.
Long compact labels stay within their available width, use an ellipsis, and expose
the full name through the native title tooltip.
Expense cards carry that color on the left border and omit the repeated dot;
rows without a colored border retain the dot.
Main Projects and Clients page-heading icons use the neutral muted-foreground
token. Dashboard section icons retain the existing info accent, keeping the
stronger blue treatment scoped to dashboard summaries rather than entity color
identity on the index pages.


Prefer shared buttons, inputs, labels, selects, dialogs, dropdowns, cards, badges, notices, empty states, tabs, tooltips, date/time controls, and icons. Add reusable variants centrally instead of restyling repeated controls at call sites.

## Product patterns

- Lists/tables support scanning and comparison; cards are reserved for meaningful grouped summaries/previews.
- Modals are for short focused work. Complex invoice, report, account, or multi-section workflows receive enough layout space.
- Destructive actions are explicit, separated, and accompanied by relationship/consequence information.
- Forms retain values on validation failure and use specific error/help copy.
- Mobile navigation respects safe areas and touch targets; desktop layouts may use higher density, tables, split views, or persistent navigation.

## Required states

Dashboard charts use Recharts 3, the same chart engine used by shadcn, with the
existing card/select primitives and semantic theme tokens. Billable work uses
`--status-info-accent`; non-billable work uses `--chart-non-billable`, a soft light
blue in light mode and a muted darker blue in dark mode. Keep surfaces neutral
and reserve semantic warning/error colors for actionable status. The chart has a labelled legend,
keyboard/touch tooltip, no animation, and a screen-reader daily-values table.
The chart sits in a bordered panel aligned with the metric grid; its legend is
right-aligned beside the title. Totals and trends stay in the metric cards.
Trends use blue directional arrows and explicit signed values, with compact
single-line labels for the comparison period, unchanged or unavailable values.
Summary sparklines are decorative native SVG. Load the chart engine lazily in a
separate bundle and precache it for offline use; no hosted chart/data service.
The dashboard period menu has a bounded scrollable height so older months remain
reachable on small screens. Metric definitions and responsive order live in
[Work and time](designs/work-and-time.md#dashboard-overview).

Every relevant component covers default, hover, focus, active, selected, disabled, loading, empty, error, offline, success, and destructive/confirmation states. Status cannot rely on color alone.
