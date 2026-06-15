---
'@lostgradient/cinder': patch
---

Resolve component-side findings from the keyboard/ARIA accessibility audit (#382, #377, #383).

- **`Autocomplete`** — the keyboard-highlighted / hovered option is now visibly distinct from the panel in light mode. The active-row background was pinned to `--cinder-surface-raised`, the exact token the floating panel uses for its own background, so the highlight disappeared. The component-local override is removed; the active row now inherits the shared `.cinder-_option-row[data-cinder-active]` treatment (`--cinder-surface-hover`, plus a `forced-colors` `outline: Highlight`).
- **`Avatar`** — documented that a placeholder-only avatar (no `src`, no `name`) renders a decorative `aria-hidden` placeholder and has no accessible name; consumers that need such a slot announced (e.g. an "unassigned" avatar) can pass `aria-label` through the forwarded rest props, which lands on the root element. No behavior change.
- **`DiffStatistics`** — clarified the `variant` prop description (`default` shows full statistic markup; `compact` trims it for tight surfaces) and distinguished it from the separate `density` prop, which adjusts control height.
