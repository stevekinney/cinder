# SpeedDial Accessibility

SpeedDial renders a named `role="group"` around a `FloatingActionButton` trigger
and a `role="toolbar"` action cluster. The trigger exposes `aria-expanded`,
and `aria-controls`; action buttons use their visible `label` as the
`aria-label`.

Keyboard behavior:

- Enter or Space on the trigger toggles the dial through the native button.
- Arrow keys on the trigger open the dial and focus the first enabled action.
- Arrow keys, Home, and End move through enabled actions in the toolbar.
- Escape closes the dial and returns focus to the trigger.

Closed actions are kept mounted but inert so exit motion can complete without
leaving focusable descendants behind.
