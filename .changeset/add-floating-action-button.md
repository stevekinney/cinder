---
'@lostgradient/cinder': minor
---

Add `FloatingActionButton` (FAB) — a circular button for the single most important
action on a screen.

- `variant`: `'filled'` (circular) | `'extended'` (pill with icon + label).
- `size`: `'sm'` | `'md'` | `'lg'`; `color`: `'primary'` | `'secondary'` | `'surface'`.
- Renders a `<button type="button">`, or an `<a>` when `href` is passed. A disabled
  link withholds its `href` and is removed from the tab order so it can't navigate.
- Requires an accessible name (`aria-label`/`aria-labelledby`, or `children`); emits a
  dev-mode warning when one is missing.
- Does not manage positioning — wrap it in your own fixed/sticky container.
