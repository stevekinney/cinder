# Cinder Native Form Affordance Policy

Native features are preferred when they fit the component contract and can be
tokenized without losing required states.

- `field-sizing`: progressive enhancement only. Textarea may use
  `@supports (field-sizing: content)`; rows plus resize remain the fallback.
- `accent-color`: keep it for native controls that retain native painting.
  Checkbox, RadioGroup, and Toggle currently keep custom paint because their
  checked, indeterminate, card, and track states require Cinder-specific shape
  and contrast control.
- Dialog forms: consumers may place `<form method="dialog">` inside Modal for
  simple accept/cancel flows. Modal and ConfirmDialog keep controlled callback
  semantics.
- Native validation pseudo-classes: low-priority fallback only. Explicit
  Cinder error state and `aria-invalid="true"` always win over `:invalid` or
  `:user-invalid`.
