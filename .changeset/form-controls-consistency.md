---
'@lostgradient/cinder': minor
---

Unify form-control consistency and accessibility, and rebuild `SchemaForm` on the
real cinder components.

**Required indicator.** Every form control now renders a visible required marker
on its own `label`/`legend` — previously the asterisk only appeared when a control
was wrapped in `FormField`, so `<Textarea required label="…">` silently showed no
indicator. The marker is a shared, centered red asterisk (`*`, not a color-only
dot) so the meaning is conveyed by glyph shape (WCAG 1.4.1). Screen readers rely
on the native `required`/`aria-required` attribute, so there is no double
announcement. Affects Input, Textarea, Select, NumberInput, Combobox, Autocomplete,
Checkbox, PinInput, PhoneInput, CheckboxGroup, RadioGroup, FormField, and Label.

**`SchemaForm` now composes cinder components** (Input, NumberInput, Select,
Checkbox, Textarea) via Svelte 5 function-bindings instead of rendering raw HTML
controls. Boolean fields render as a `Checkbox` (a deferred form boolean) rather
than a bespoke switch. This removes all behavior/style drift between SchemaForm and
the standalone controls.

**Consistency fixes.** Combobox now inherits id/`aria-describedby`/`disabled` from a
wrapping `FormField` and gained a `required` prop. Toggle inherits `disabled` from
`FormField` context. Input and NumberInput now share the same ARIA resolver as the
other controls (Input no longer drops a wrapping FormField's describedby id).
CheckboxGroup sets `aria-required` to match RadioGroup. Select and Textarea labels
gained their missing class/disabled styling.

**Breaking changes:**

- `ColorField`: `ariaLabel` → `aria-label`, `ariaLabelledby` → `aria-labelledby`.
- `CheckboxGroup` and `RadioGroup`: the `legend` prop is renamed to `label` for
  consistency with every other form control (still rendered as a `<legend>`).
