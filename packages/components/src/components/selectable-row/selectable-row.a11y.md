# SelectableRow accessibility

`SelectableRow` keeps its primary action and trailing controls as siblings. The primary region is
either a native `<button>` or `<a>`, so the browser supplies its role, Tab stop, and activation
behavior without `role="button"`, `tabindex`, or manual key handlers.

## Keyboard behavior

| Key   | Primary button                                                             | Primary link                                |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------- |
| Tab   | Moves through the primary action, then each trailing control in DOM order. | Same.                                       |
| Enter | Activates the primary action.                                              | Follows the link.                           |
| Space | Activates the primary action.                                              | Scrolls the page, per native link behavior. |

Trailing controls never trigger the primary action because they are not descendants of it. Consumers
do not need `stopPropagation()` for Rename, menu, or external-link controls. Do not put another
interactive element inside the `leading`, `title`, `description`, or `meta` snippets; those regions
are deliberately inside the primary native action.

Button rows expose `aria-pressed` from `selected` by default. Use `selectedState="current"` when a
button row represents the current item in a set; selected rows then expose `aria-current` using
`currentValue` and omit `aria-pressed`. Linked rows always expose `aria-current` from `selected` and
`currentValue`. Use a linked row only when the primary action really navigates.

Choose `ActionRow` when the whole row is one button and its trailing content is non-interactive.
Choose `StackedListItem` when the row is mostly static and only its title links. Choose
`SelectableRow` when the full main body must activate while sibling trailing controls remain
independent.
