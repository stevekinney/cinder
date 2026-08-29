# PreviewPanel · accessibility

## Pattern

PreviewPanel is a layout shell for preview surfaces. It owns consistent visual regions and nested overflow containment, but it does not own product-specific navigation, tablist, toolbar, or editor behavior.

Purpose: Bounded preview layout shell with title, status, optional chrome regions, and nested overflow discipline.

## Design review

Nearest neighbours: `stack`, `card`, `tabs`, and `alert`. PreviewPanel belongs as a component because it combines preview-specific chrome regions with `min-height: 0` and body overflow discipline that plain Stack or Card compositions repeatedly get wrong in nested panels.

Visual outcome: a restrained bordered panel with a compact raised header, optional tab and footer bands, and a scrollable body. It should feel like an application preview surface rather than a marketing card.

## Keyboard and focus

PreviewPanel adds no keyboard handling. Snippet regions preserve the native behavior of their rendered controls. If `tabs` renders a tablist, the tab component owns roving focus and selection semantics.

## Names, roles, and state

The title names the panel via `aria-labelledby`. Non-error statuses are visible taxonomy only. `status="error"` renders `role="alert"` so assistive technology announces the error state and panel contents assertively.

## Reduced motion

PreviewPanel adds no motion.
