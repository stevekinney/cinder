---
'cinder': minor
---

Add `ClickAwayListener` — a headless utility that calls `onClickAway` when the user
presses a pointer (mouse or touch) outside its subtree.

- Listens on `pointerdown` (covers mouse + touch), falling back to `mousedown` +
  `touchstart` on browsers without the Pointer Events API.
- `enabled` (default `true`) detaches the listener without unmounting.
- Headless — renders only a wrapper element around its `children`, no styling.

Use it for custom inline-edit fields, custom dropdowns, or any overlay that should
dismiss on outside interaction. Popover, Dropdown, and Modal already handle this
internally.
