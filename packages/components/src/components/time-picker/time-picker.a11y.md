# TimePicker Accessibility

- The text input remains the primary form control. The popover is an enhancement for choosing values without typing.
- Each scroll column uses `role="listbox"` with `role="option"` children, and the AM/PM chooser uses `role="radiogroup"`.
- Arrow keys move within a column, `Tab` advances between columns, and `Escape` closes the popover through the shared popover primitive.
- When used inside `FormField`, the component composes the field-provided `aria-describedby`, `required`, and `disabled` state instead of duplicating label wiring.

## Native indicator suppression

Chromium and WebKit browsers render a clock icon inside `<input type="time">` as a `::-webkit-calendar-picker-indicator` pseudo-element that opens the browser's own native time picker. Firefox does not expose this pseudo-element. TimePicker intentionally suppresses this indicator with:

```css
.cinder-time-picker__input::-webkit-calendar-picker-indicator {
  display: none;
}
```

This hides the browser's affordance so only the Cinder toggle button is visible, giving users one coherent entry point to the scroll-list popover. The `<input type="time">` element itself is _not_ replaced — it continues to:

- Accept keyboard-typed values directly.
- Enforce `min`, `max`, and `step` constraints natively.
- Participate in form submission and reset.
- Expose native validation messages.

The Cinder toggle opens the scroll-list popover, which exposes the same range of values through a keyboard-navigable listbox. Both entry paths write to the same underlying `<input>`, so they are always in sync.
