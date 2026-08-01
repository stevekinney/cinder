# SpeedDial Accessibility

SpeedDial renders a named `role="group"` around a `FloatingAction` trigger
and a `role="toolbar"` action cluster. The trigger exposes `aria-expanded`,
and `aria-controls`; action buttons use their visible `label` as the
`aria-label`.

Keyboard behavior:

- Enter or Space on the trigger toggles the dial through the native button.
- Arrow keys on the trigger open the dial and focus the first enabled action.
- Arrow keys, Home, and End move through enabled actions in the toolbar.
- Tab from the final sequentially tabbable action returns focus to the trigger;
  the same bridge applies when the focused final action is `tabindex="-1"` and
  was reached with arrow-key navigation.
- Shift+Tab from the first sequentially tabbable action, or from an earlier
  arrow-focused action, returns focus to the nearest sequentially focusable
  element before the SpeedDial. Shift+Tab from the open trigger focuses the
  last sequentially tabbable action.
- Escape closes the dial and returns focus to the trigger.

Closed actions are kept mounted but inert so exit motion can complete without
leaving focusable descendants behind.

## Focus interaction review

The portaled toolbar is treated as one sequential-focus region even though its
DOM position is outside the trigger. The keyboard matrix above covers native
Tab and Shift+Tab from the trigger and every enabled action, including actions
excluded from sequential navigation with `tabindex="-1"` but still reachable by
arrow keys. Focus remains inside the open region at each boundary, and Escape,
activation, dismissal, or hiding returns focus to the trigger where applicable.
