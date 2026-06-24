# VirtualList · accessibility

## Pattern

VirtualList presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: Fixed-height windowing primitive for long vertical lists that renders only the visible rows plus overscan inside a native scroll container.

## Use when

- Rendering thousands of same-height append-only rows such as logs, event streams, or activity feeds.
- You need a reusable primitive that owns native vertical scrolling but leaves row markup to a snippet.

## Avoid when

- Rows have substantially variable heights that must be measured dynamically — v1 requires a fixed itemHeight.
- Rendering columns or two-dimensional grids — use data-grid for grid semantics and column virtualization.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle VirtualList, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When VirtualList accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render VirtualList in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `data-list`, `data-table`, `data-grid`.
