# Dropdown Accessibility

## ARIA Roles and Attributes

- The open menu has `role="menu"`, identifying it as a list of interactive choices.
- Individual menu items inside `children` should use `role="menuitem"`, `role="menuitemcheckbox"`, or `role="menuitemradio"` depending on their function. This phase renders raw children and delegates item semantics to the consumer.
- The trigger element (provided via the `trigger` snippet) should be a `<button>` with an accessible name. When using the popover API path, it receives a `popovertarget` attribute to link it to the menu.

## Keyboard Interactions

| Key             | Behaviour                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter / Space   | Activates the trigger button, opening the menu.                                                                                                                                     |
| Escape          | Closes the open menu and returns focus to the trigger.                                                                                                                              |
| Tab             | When the menu is open, Tab moves focus out of the dropdown entirely (closing the menu). This follows the ARIA menu pattern for menus invoked from a button.                         |
| Arrow Up / Down | Should navigate between menu items — not yet implemented at this phase; the consuming component or a future iteration should add key-down handlers on `[role="menuitem"]` elements. |

## Focus Management

- When the menu opens (non-popover fallback), focus remains on the trigger. A future phase should move focus to the first `[role="menuitem"]` on open.
- When the menu closes via Escape, focus returns to the trigger automatically since it was never moved.

## Popover API Path

When the browser supports the Popover API (`showPopover`/`hidePopover`), the menu uses `popover="auto"`. This gives the browser control over showing/hiding and includes built-in light-dismiss (click outside closes the menu). The `toggle` event is used to sync the browser's popover state back to the bindable `open` prop.

## Outside-Click Dismissal

In the non-popover fallback, a `click` listener is attached to `document` while the menu is open and removed when it closes, to implement light-dismiss behaviour. This avoids persistent global listeners when no dropdown is active.
