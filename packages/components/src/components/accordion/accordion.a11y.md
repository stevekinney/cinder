# Accordion Accessibility

## ARIA Roles and Attributes

The accordion implementation follows the [WAI-ARIA Accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/).

### AccordionItem header button

- Uses a native `<button type="button">` inside an `<h3>` heading element. The heading level communicates the item's place in the page outline; consumers who nest accordions inside other heading contexts should note this and adjust via CSS if the heading level needs to change semantically (a future prop can address this).
- `aria-expanded="true|false"` — reflects whether the associated panel is currently visible. Screen readers announce "expanded" or "collapsed" alongside the button label.
- `aria-controls="{id}-panel"` — links the header button to its controlled panel by ID, allowing assistive technologies to navigate directly to the panel content. `AccordionItem` always emits this attribute because the panel shell remains in the DOM with a stable, generated ID. While collapsed, the panel shell is marked `hidden` and its children are not rendered, so the content stays out of the accessibility tree until expansion.
- `id="{id}-header"` — provides a stable ID for the header button itself.

### AccordionItem panel

- `id="{id}-panel"` — the stable ID referenced by the header button's `aria-controls`. The panel element stays mounted and hidden while collapsed so the control relationship always points at an existing DOM node.
- `role="region"` is intentionally **omitted**. The WAI-ARIA APG notes that applying `role="region"` to every accordion panel pollutes the page's landmark list, making landmark navigation harder for screen reader users. The `aria-controls` / `aria-expanded` pairing on the header button provides the machine-readable contract without inflating the landmark count.

### Disabled items

- The header button carries the native `disabled` HTML boolean attribute only. Native `disabled` prevents all interaction, removes the element from the tab order, and is announced by assistive technologies. `aria-disabled` is intentionally **omitted** alongside `disabled` on a `<button>` — adding both causes double-announcement of the disabled state in some screen reader + browser combinations.

## Keyboard Interactions

| Key             | Behaviour                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Tab             | Moves focus to the next focusable element (accordion header buttons are in the natural tab order). |
| Shift + Tab     | Moves focus to the previous focusable element.                                                     |
| Enter / Space   | When focus is on a header button, toggles the associated panel open or closed.                     |
| Home (optional) | Move focus to the first header button (not implemented — add if the accordion is very long).       |
| End (optional)  | Move focus to the last header button (not implemented — add if the accordion is very long).        |

Arrow-key navigation between accordion headers (as described in the optional ARIA pattern) is intentionally omitted. Browser-native Tab-based navigation is simpler, more predictable, and sufficient for most use cases. Opt-in roving-focus can be layered on if the consumer requires it.

## Focus Management

- Focus is never moved programmatically on open/close. The header button retains focus after activating it, which is consistent with the ARIA authoring practice and avoids confusing focus jumps.
- Focus ring styles use an inset outline so the ring stays within the accordion boundary without requiring `overflow: visible`.

## Single vs. Multiple Mode

- In `multiple=false` mode only one panel can be open at a time. This does not affect ARIA attributes — `aria-expanded` on each button always reflects that item's own state independently.
- Collapsing is always allowed (clicking an open item's button collapses it), because preventing collapse is a content-dependent choice better left to the consumer's `expandedIds` binding logic.

## Content Guidance

- Header titles should be concise and describe the panel content clearly — they serve as both the visible label and the accessible name for the panel region.
- Avoid nesting interactive elements (buttons, links) inside the title prop. Place interactive content inside the panel (children) instead.
- Do not rely solely on icon colour to communicate expanded/collapsed state; the chevron rotates as a secondary affordance but `aria-expanded` is the primary machine-readable signal.

## Reduced Motion

The chevron rotation animation is suppressed under `prefers-reduced-motion: reduce` via a CSS media query on `.cinder-accordion-item__chevron`. AccordionItem does not use a JS-driven slide transition for its panel — the panel shell toggles the native `hidden` attribute and content appears instantly when expanded — so there is no JS-side reduced-motion guard required. `aria-expanded` remains the primary indication of state regardless of motion preference.

## Forced-Colors Mode (Windows High Contrast)

The trigger button's focus ring uses `outline` in forced-colors mode to ensure it is visible, since `box-shadow` is suppressed by the browser in this context.
