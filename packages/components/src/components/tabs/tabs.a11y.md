# Tabs · accessibility

## Pattern

[WAI-ARIA Authoring Practices: Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). The `Tabs` component is the orchestrator; it provides a context that `TabList`, `Tab`, and `TabPanel` consume. Same component family is used for both single-Tab and Tab + TabPanel docs (see also `tab.svelte`, `tab-list.svelte`, `tab-panel.svelte`).

## Roles, names, and states

- `TabList` carries `role="tablist"` with `aria-orientation` set to the configured orientation.
- Each `Tab` carries `role="tab"`, `aria-selected="true|false"`, and `aria-controls` pointing at its panel id.
- Each `TabPanel` carries `role="tabpanel"`, `aria-labelledby` pointing at the corresponding tab id, and `tabindex="0"` so keyboard users can move focus into the panel.
- Inactive panels are not rendered (Cinder uses `{#if isActive}`), so no `hidden` attribute is required. Consumers who want to preserve panel state across switches should manage state externally.

Use ordinary `TabPanel` children for the default one-tab-to-one-panel pattern.
When the selected tab controls one stable caller-owned panel, such as a Monaco
editor host whose contents change without replacing the panel element, pass the
panel element's id to each `Tab` via `controls`. In that external-panel pattern,
the consumer owns the panel element, `role="tabpanel"`, and labelling from the
active tab. Provide explicit tab ids and set the caller-owned panel's
`aria-labelledby` to the active tab id so its accessible name changes with the
selected tab. Cinder still owns tab registration, disabled state, roving
tabindex, activation, and visual tab styling.

## Roving tabindex

Per the WAI-ARIA pattern, only one tab sits in the tab order (`tabindex=0`); the rest are reachable via arrow keys (`tabindex=-1`). The selected tab takes that tab stop _when it is enabled_. If the selected tab is disabled — at mount, or because `disabled` toggled true after mount — the tab stop falls back to the first enabled tab in source order, so keyboard users always have a reachable entry point into the tablist. Selection (`aria-selected`) is preserved on the disabled tab; only the tab stop moves.

When every tab is disabled, no tab carries `tabindex="0"`. The tablist is unreachable by keyboard in that state, which is the correct outcome: there is nothing actionable to focus.

## Keyboard

The horizontal default activates tabs as focus moves. Vertical orientation defaults to manual activation (matching the WAI-ARIA recommendation that vertical-up/down can collide with panel scroll content). Both behaviors can be overridden via the `activateOnFocus` prop.

| Key                               | Horizontal                       | Vertical             |
| --------------------------------- | -------------------------------- | -------------------- |
| ArrowRight / ArrowLeft            | Move focus / activate            | Ignored              |
| ArrowDown / ArrowUp               | Ignored                          | Move focus           |
| Home                              | Focus first tab                  | Focus first tab      |
| End                               | Focus last tab                   | Focus last tab       |
| Enter / Space (manual activation) | Activate focused tab             | Activate focused tab |
| Tab (after focusing the tablist)  | Move focus into the active panel | same                 |

## Orientation

`Tabs` exposes orientation via context to `TabList` (which sets `aria-orientation`) and to its own keydown handler (which translates arrow keys to navigation intents per the orientation).

## Disabled tabs

Disabled tabs use the native HTML `disabled` attribute on the underlying `<button>`. That alone makes them non-focusable by Tab key and non-clickable. On top of that, the keyboard handler skips disabled tabs entirely during arrow-key, Home, and End navigation: pressing ArrowRight on a tab whose next sibling is disabled lands focus on the following enabled tab, wrapping past disabled tabs at the ends of the tablist. Enter and Space refuse to activate a focused disabled tab (a defensive guard — real browsers will not focus the button in the first place).

If every tab in the tablist is disabled, the handler still calls `event.preventDefault()` on Arrow, Home, and End so the keypress does not leak into page scrolling. No focus changes occur.

Consumers should avoid disabling the currently selected tab. If it happens, selection is preserved on the disabled tab (so the bound `value` does not change unexpectedly), but the tab stop moves to the first enabled tab so the tablist remains keyboard-reachable.
