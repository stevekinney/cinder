# InlineLoading · accessibility

## Pattern

InlineLoading communicates the lifecycle of a short async action (`active` -> `finished`/`error`) in compact inline UI, with a polite live-region announcement for status changes.

Purpose: Inline async-action status indicator that transitions from loading to success or error with accessible announcements.

## Use when

- Showing a compact Submit -> loading -> success/error lifecycle beside a button or form row.
- Communicating short-lived async state transitions without reserving large layout space.

## Avoid when

- Showing indeterminate work without success/error transitions — use spinner.
- Reporting static non-loading status in dense lists — use status-dot.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle InlineLoading, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When InlineLoading accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render InlineLoading in the playground or a focused test fixture.
- Trigger each status transition (`inactive`, `active`, `finished`, `error`).
- Inspect the announcement behavior with browser accessibility tools and a screen reader.
- Check reduced-motion behavior while `active` so spinner animation respects user preferences.

Related components: `spinner`, `status-dot`.
