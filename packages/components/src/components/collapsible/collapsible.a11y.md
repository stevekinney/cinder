# Collapsible Accessibility

## ARIA Roles and Attributes

The collapsible implementation follows the [WAI-ARIA Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).

### Trigger button

- Uses a native `<button type="button">`, so Enter and Space activation and tab-order placement come from the browser without any additional key handlers.
- `aria-expanded="true|false"` — reflects whether the controlled panel is currently visible. Screen readers announce "expanded" or "collapsed" alongside the button label.
- `aria-controls="{base}-panel"` — emitted only while the panel exists in the DOM. When the panel is removed on close, the attribute is dropped so it never points to a missing element. This differs from `AccordionItem`, which always emits `aria-controls` because its panel IDs are stable and predictable — see [Relation to Accordion](#relation-to-accordion).
- `id="{base}-header"` — stable ID used by the panel's `aria-labelledby` to form the label association.
- `disabled` — the native HTML boolean is used exclusively; `aria-disabled` is intentionally omitted alongside native `disabled` on a `<button>` to avoid double-announcement in some screen reader + browser combinations.

### Panel

- `role="region"` — applied to every open panel, making it a named landmark. Use Collapsible when a single disclosure should be reachable by landmark navigation (e.g., a prominent filter panel or a help section).
- `aria-labelledby="{base}-header"` — associates the panel region with its trigger so assistive technologies announce "expanded, region, [trigger label]" when navigating into it.
- Removed from the DOM when closed. Standard disclosure behavior — no `display:none` or `visibility:hidden` approach. `aria-controls` on the trigger is cleared simultaneously.

> [!NOTE] Landmark count
> Every open Collapsible panel becomes a named `region` landmark. On pages with many simultaneously open Collapsibles, landmark navigation lists grow proportionally. If landmark pollution is a concern, use a plain `{#if}` panel or consider whether the `Accordion` pattern (which intentionally omits `role="region"` per the WAI-ARIA APG) better fits the use case.

## Keyboard Interactions

| Key           | Behaviour                                                       |
| ------------- | --------------------------------------------------------------- |
| Tab           | Moves focus to the trigger button (in natural tab order).       |
| Shift + Tab   | Moves focus backward.                                           |
| Enter / Space | When focus is on the trigger, toggles the panel open or closed. |

No custom key handlers are implemented for Enter or Space — the browser's native button activation handles both. This guards against a keydown-only toggle that would fire without a synthetic click event in environments that separate the two.

## Focus Management

- Focus never moves programmatically on open or close. The trigger retains focus after activation, consistent with the ARIA disclosure authoring practice.
- Focus ring styles use `outline` on the trigger button. Forced-colors mode uses the `ButtonText` system color so the ring remains visible in Windows High Contrast mode.

## Reduced Motion

The slide-in/slide-out animation uses the Svelte `slide` transition. Its duration is derived from the `useReducedMotion` utility: when `prefers-reduced-motion: reduce` is active, the duration collapses to `0ms`, making the panel appear and disappear instantly without removing the transition from the DOM lifecycle. The chevron rotation animation is additionally suppressed in CSS via `@media (prefers-reduced-motion: reduce)`.

## Relation to Accordion

Collapsible and AccordionItem solve overlapping but distinct problems.

| Concern                    | Collapsible                                                     | AccordionItem                                                                                             |
| -------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Coordination with siblings | None — fully independent                                        | Context-driven; Accordion parent enforces single/multiple mode                                            |
| Panel landmark             | `role="region"` + `aria-labelledby` — panel is a named landmark | No `role="region"` — per WAI-ARIA APG, landmark pollution in multi-panel accordions outweighs the benefit |
| Animation                  | JS-driven `slide` transition, respects `useReducedMotion`       | Instant `{#if}` toggle; no JS animation                                                                   |
| `aria-controls` presence   | Only when panel is in the DOM                                   | Always present (panel ID is stable and predictable)                                                       |
| Trigger label              | String or snippet receiving `{ open, disabled }`                | String prop (`title`)                                                                                     |
| State ownership            | Internal (`open` bindable) or parent-controlled                 | Entirely context-driven via `expandedIds` on the Accordion                                                |

These divergences are intentional. Sharing Collapsible's internals inside AccordionItem would require either removing `role="region"` conditionally or adding a mode prop to Collapsible — both would change Collapsible's public API and bleed accordion-specific concerns into a general-purpose primitive. The components are designed to be used together (Accordion composes AccordionItem) but AccordionItem does not compose Collapsible.

**Use Collapsible when:**

- You need to disclose a single optional region (filter panel, help text, advanced options).
- The trigger label reacts to open/closed state (swap "Show" / "Hide").
- The panel should be a named landmark reachable via region navigation.
- You want animated open/close.

**Use Accordion (with AccordionItem) when:**

- You have multiple named sections sharing a parent and opening one may close another.
- Landmark pollution from many simultaneous open regions is a concern.
- You need coordinated single/multiple selection across panels.
