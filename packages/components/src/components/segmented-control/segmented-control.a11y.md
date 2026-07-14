# Segmented Control — Accessibility Notes

## Pattern

`segmented-control` encodes **selection state** by default and **navigation
state** when `variant="navigation"` is used. It has three semantic modes:

- **Single** (`selectionMode="single"`, default) — follows the [WAI-ARIA Radio Group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/). Exactly one option is selected at a time.
- **Multiple** (`selectionMode="multiple"`) — follows the [Toggle Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) applied across a group. Options toggle independently; any number may be active.
- **Navigation** (`variant="navigation"`) — renders a labelled `<nav>` landmark
  with real links. The current link uses `aria-current`; options do not receive
  radio, tab, or toggle-button roles.

## Roles and States

### Single mode

| Element             | Role                                       | State attributes                                       |
| ------------------- | ------------------------------------------ | ------------------------------------------------------ |
| Labelled group root | `radiogroup`                               | `aria-labelledby`, `aria-disabled`, `aria-orientation` |
| Each option         | `radio` (via `role="radio"` on `<button>`) | `aria-checked` (`true`/`false`), `disabled`            |

### Multiple mode

| Element             | Role             | State attributes                            |
| ------------------- | ---------------- | ------------------------------------------- |
| Labelled group root | `group`          | `aria-labelledby`, `aria-disabled`          |
| Each option         | button (default) | `aria-pressed` (`true`/`false`), `disabled` |

### Navigation variant

| Element             | Role                          | State attributes                       |
| ------------------- | ----------------------------- | -------------------------------------- |
| Labelled navigation | navigation (implicit `<nav>`) | `aria-labelledby`                      |
| Each linked option  | link (implicit `<a>`)         | `href`, optional `aria-current="page"` |

Group-level `disabled` sets `aria-disabled="true"` on the labelled group root in
selection modes and disables every option button. In navigation mode, the
`<nav>` landmark keeps its native semantics while each linked segment receives
`aria-disabled="true"` and does not emit `href`.

`aria-orientation` is present on the labelled group root in **single mode only** — `radiogroup` is a composite widget where orientation guides arrow-key navigation. The `group` role used in multiple mode is not a composite widget, and the `<nav>` used by `variant="navigation"` follows normal link navigation, so `aria-orientation` would be meaningless there.

## Why Not `aria-pressed` on Radios?

`aria-pressed` is a state for toggle buttons. Radio buttons use `aria-checked`. Mixing them confuses assistive technology — a screen reader announces "toggle button, pressed" for a radio or "radio button, checked" for a toggle button, creating a mismatch between the announced semantics and the actual interaction model.

Single mode uses `role="radio"` + `aria-checked`. Multiple mode uses default button role + `aria-pressed`. The two states are never mixed.

## Why No Roving Tabindex in Multiple Mode?

Roving tabindex marks one item in a composite widget as the single Tab stop and uses arrow keys to move focus within the group. This is appropriate for radio groups (where options are mutually exclusive and form a single logical control) and other composite widgets like toolbars and menus.

Toggle buttons are **independent controls**. Each one is its own Tab stop with its own state. Using roving tabindex would imply they form a single composite widget — which they don't. Multiple mode therefore uses natural Tab order: every enabled option receives focus in document order, and there is no arrow-key navigation between options.

## Keyboard Interaction

### Single mode

| Key                        | Behavior                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`        | Move focus into / out of the group (one Tab stop — the selected or first non-disabled option) |
| `ArrowRight` / `ArrowDown` | Move focus **and selection** to the next non-disabled option (wraps)                          |
| `ArrowLeft` / `ArrowUp`    | Move focus **and selection** to the previous non-disabled option (wraps)                      |
| `Home`                     | Move focus and selection to the first non-disabled option                                     |
| `End`                      | Move focus and selection to the last non-disabled option                                      |
| `Space` / `Enter`          | Activate the focused option (browser synthesizes a `click` on `<button>`)                     |

Vertical orientation (`orientation="vertical"`) maps `ArrowUp`/`ArrowDown` for navigation and disables horizontal arrows.

### Multiple mode

| Key                 | Behavior                                                       |
| ------------------- | -------------------------------------------------------------- |
| `Tab` / `Shift+Tab` | Move focus between enabled options (each is a normal Tab stop) |
| `Space` / `Enter`   | Toggle the focused option (browser default for `<button>`)     |

Arrow keys have no special meaning in multiple mode.

### Navigation variant

| Key                 | Behavior                                                  |
| ------------------- | --------------------------------------------------------- |
| `Tab` / `Shift+Tab` | Move focus between links in normal document order         |
| `Enter`             | Follow the focused link using the browser/router behavior |

Arrow keys have no special meaning in navigation mode. Do not use roving
tabindex for route filters: links should remain ordinary links so users keep
native navigation behavior such as copying the URL or opening in a new tab.

## Group Labeling

All modes label the group or navigation landmark via `aria-labelledby` pointing
at a sibling `<span>`. When `hideLabel` is set, the span receives
`.cinder-sr-only` — visually hidden but still referenced by `aria-labelledby`,
so the name is available to assistive technology.

## Boundary: `segmented-control` vs `button-group`

**If you need selection state** — one option active at a time, or a set of toggle states — use `segmented-control`.

**If you need independent action buttons** laid out in a strip — no selection state, no `aria-checked`, no `aria-pressed` — use `button-group`. It is layout-only: buttons are independent, there is no roving tabindex, and no value binding.

The distinction matters for assistive technology:

- `segmented-control` announces the group as `radiogroup` or `group` with a label. Screen readers can navigate to the group directly and understand the selection relationship.
- `button-group` is a visual affordance only. Screen readers traverse the buttons individually as ordinary interactive controls with no implied relationship between them.

If you find yourself wanting selection state on a `button-group`, you want `segmented-control`. If you find yourself wanting independent actions in a `segmented-control`, you want `button-group`.
