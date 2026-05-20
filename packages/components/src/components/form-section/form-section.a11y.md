# FormSection accessibility

## Element choice: `section` vs `fieldset`

| `as` prop             | Rendered element           | When to use                                                                          |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `"section"` (default) | `<section>` + `<h{level}>` | Layout grouping — visually organizes fields, no semantic grouping needed             |
| `"fieldset"`          | `<fieldset>` + `<legend>`  | Semantically grouped inputs — screen readers announce the legend before each control |

### `as="fieldset"` requires `heading`

A `<fieldset>` without a `<legend>` has no accessible group name — the grouping
is invisible to assistive technology. The TypeScript discriminated union makes
this unrepresentable at compile time. A dev-only `console.warn` fires at runtime
as a safety net for JavaScript consumers.

Use `as="fieldset"` when controls are logically related and the relationship
needs to be announced — address fields, payment details, notification preferences.

Use the default `as="section"` when the grouping is purely visual — you want a
responsive grid layout but the controls are independently labeled.

## Heading levels

For `as="section"`, the `headingLevel` prop (default `2`) controls which `<h>`
element is rendered. Choose a level that fits the document outline:

- `2` for a top-level form section on a page
- `3` or deeper when nested inside another `<h2>` section

For `as="fieldset"`, `headingLevel` is ignored — `<legend>` is the only heading.

## Container queries

FormSection uses `container-type: inline-size` on the root element. Column count
is driven by the container's own inline size, not the viewport. This means:

- A FormSection nested in a 30rem sidebar stays single-column even on a 1440px
  monitor.
- The responsive breakpoints are:
  - Below 40rem: 1 column (all `columns` values)
  - ≥ 40rem: 2 columns (for `columns` ≥ 2)
  - ≥ 60rem: 3 columns (for `columns` ≥ 3)
  - ≥ 80rem: 4 columns (for `columns` = 4)

Browser support: Chrome 105+, Safari 16+, Firefox 110+.

## Landmark regions

`<section>` is a sectioning element but is only exposed as a `region` landmark
when it has an accessible name. Provide a `heading` prop or add `aria-label` via
the `class` / spread props pattern if you need the section to appear in the
landmarks list of a screen reader.

`<fieldset>` is always a `group` landmark when it has a `<legend>`.

## Grouped control patterns

For radio groups and checkbox groups, use `<FormSection as="fieldset">` to wrap
the group. The legend provides the group's accessible name; each option's own
label associates it with the individual control.

Example:

```svelte
<FormSection as="fieldset" heading="Notification preferences">
  <Checkbox id="notify-email" label="Email notifications" bind:checked={emailEnabled} />
  <Checkbox id="notify-sms" label="SMS notifications" bind:checked={smsEnabled} />
</FormSection>
```

Use individual `<FormField>` wrappers inside a `<FormSection>` only when each
field needs its own description or error. For simple option lists, direct nesting
is sufficient.

## PR-B note

Wiring of RadioGroup, Checkbox, Textarea, and Select to read FormFieldContext
is deferred to PR-B. This does not affect FormSection — it is a layout primitive
that does not publish context.
