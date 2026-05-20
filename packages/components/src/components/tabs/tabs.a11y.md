# Tabs · accessibility

## Pattern

[WAI-ARIA Authoring Practices: Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). The `Tabs` component is the orchestrator; it provides a context that `TabList`, `Tab`, and `TabPanel` consume. Same component family is used for both single-Tab and Tab + TabPanel docs (see also `tab.svelte`, `tab-list.svelte`, `tab-panel.svelte`).

## Roles, names, and states

- `TabList` carries `role="tablist"` with `aria-orientation` set to the configured orientation.
- Each `Tab` carries `role="tab"`, `aria-selected="true|false"`, and `aria-controls` pointing at its panel id.
- Each `TabPanel` carries `role="tabpanel"`, `aria-labelledby` pointing at the corresponding tab id, and `tabindex="0"` so keyboard users can move focus into the panel.
- Inactive panels are not rendered (Cinder uses `{#if isActive}`), so no `hidden` attribute is required. Consumers who want to preserve panel state across switches should manage state externally.

## Roving tabindex

Per the WAI-ARIA pattern, only the currently-active tab sits in the tab order (`tabindex=0`); inactive tabs are reachable via arrow keys (`tabindex=-1`). The `rovingTabIndex` helper from `_internal/collection.ts` handles this.

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
