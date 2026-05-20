# FormField accessibility

## Role and label association

`<FormField>` renders a visible `<label for={id}>` element that is explicitly
associated with the wrapped control by matching `id`. This is the only label
association mechanism; `aria-label` and `aria-labelledby` on the control are
not added by FormField itself.

The `<label>` element is given an id of `${id}-label` so that grouped-control
patterns (see FormSection) can reference it via `aria-labelledby` when needed.

## Required marker

When `required` is set, FormField renders a `<span aria-hidden="true">*</span>`
inside the label. The asterisk is hidden from assistive technology because the
`required` attribute (or `aria-required`) is the machine-readable signal.
Opted-in controls (Input in PR-A) receive `required: true` through context and
set the native `required` attribute, which screen readers announce as "required".

Convention: place a "fields marked with \* are required" legend near the form so
sighted users understand the asterisk convention. FormField and FormSection do
not auto-render this legend.

## Error semantics

When `error` is set, FormField:

- Renders a `<p id="${id}-error" aria-live="polite">` with the error text.
- Exposes `invalid: 'true'` and `errorId` on the context so opted-in controls
  set `aria-invalid="true"` and `aria-describedby` pointing to the error element.

`aria-live="polite"` announces the error text when it is added to the DOM,
without interrupting ongoing speech.

## Description text

When `description` is set, FormField renders a `<p id="${id}-description">` and
exposes `descriptionId` on the context. Opted-in controls include this in their
`aria-describedby` so screen readers read the helper text after the label.

If both `description` and `error` are set, the composed `aria-describedby`
includes both ids (description first, then error), matching the reading order in
the DOM.

## Context API

FormField publishes a `FormFieldContext` via Svelte context so descendant
controls can inherit ARIA wiring without re-implementing it:

| Field           | Purpose                                                         |
| --------------- | --------------------------------------------------------------- |
| `controlId`     | Stable id expected on the wrapped control element               |
| `labelId`       | Id of the `<label>` element                                     |
| `describedBy`   | Composed `aria-describedby` (description + error), or undefined |
| `descriptionId` | Id of the description `<p>`, or undefined                       |
| `errorId`       | Id of the error `<p>`, or undefined                             |
| `invalid`       | `'true'` when error is set, else undefined                      |
| `required`      | Boolean from the `required` prop                                |
| `disabled`      | Boolean from the `disabled` prop                                |

All fields are getter properties — reads inside `$derived` stay reactive.

## Per-control wiring conventions

### Input (PR-A)

Set the same `id` on both `<FormField id="…">` and `<Input id="…">`. The
FormField associates its label via `for={id}`; the Input uses that same value as
its element id. A dev-only warning fires if they differ.

Do **not** also set `label` on the wrapped Input — FormField owns the label.
The Input's `{#if label}` guard keeps its internal label invisible when the
`label` prop is unset, so no duplicate label markup is rendered.

### Grouped controls (RadioGroup, Checkbox groups)

For groups of related inputs, use `<FormSection as="fieldset">` instead of
`<FormField>`. The fieldset/legend pattern groups the controls at the AT level;
each option does not need its own `<FormField>` unless it requires a per-option
description or error.

Wiring of RadioGroup, Checkbox, Textarea, and Select to read FormFieldContext
is deferred to PR-B. Consumers can still nest those components inside a
FormField today — they will render correctly but will not auto-inherit context
until PR-B lands.

## Keyboard interaction

FormField itself adds no keyboard behavior — it is a layout primitive. Each
wrapped control retains its native keyboard behavior.

## Color contrast

The required marker (`*`) uses `var(--cinder-danger)` which meets WCAG AA
contrast (4.5:1) against the label text color. The error text uses the same
token, matching the focus ring and error border of opted-in controls.

## Browser support

Container queries used by FormSection (not FormField) require:
Chrome 105+, Safari 16+, Firefox 110+. All browsers Cinder targets.
