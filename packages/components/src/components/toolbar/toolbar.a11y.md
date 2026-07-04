# Toolbar Accessibility

## Pattern

`Toolbar` implements the WAI-ARIA toolbar pattern:

- The root renders `role="toolbar"`.
- The toolbar must have an accessible name through `aria-label` or `aria-labelledby`.
- The toolbar is one Tab stop. Arrow keys move between enabled controls inside it.

## Keyboard ownership

- Horizontal toolbars own Left and Right arrows plus Home and End for non-editable items.
- Vertical toolbars own Up and Down arrows plus Home and End for non-editable items.
- Editable text fields keep their native editing keys until the caret hits the boundary. At that point the toolbar roves focus out of the field.
- Escape from an editable field moves focus out to a sibling toolbar item.

## DOM-driven child support

Toolbar does not require child registration APIs. It manages native focusable descendants in DOM order, which means existing controls such as `Button`, `SegmentedControl`, and `NumberInput` work without toolbar-specific props.

## Groups

`Toolbar.Group` is layout-only unless it has an accessible name or explicit `role`. It clusters related controls, keeps them together while horizontal toolbars wrap, and gets `role="group"` when named with `aria-label` or `aria-labelledby`.

`Toolbar.Spacer` is `aria-hidden="true"` and never becomes a toolbar item.
