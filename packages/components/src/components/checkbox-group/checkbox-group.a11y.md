# CheckboxGroup Accessibility Notes

## Pattern

`CheckboxGroup` wraps independent checkboxes in a native `<fieldset>` + `<legend>` element pair, following the [WAI-ARIA APG: Checkbox (multi-select)](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/) guidance. No ARIA `role` is added — `<fieldset>` carries the implicit grouping role already.

## Why `<fieldset>` Instead of a Labelled `<div>`

Screen readers announce the `<legend>` text when focus enters **any** descendant control. A bare `<div aria-labelledby="…">` only announces its label on initial focus into the group, so users navigating mid-group lose context. The `<fieldset>` approach means that as a user tabs through three checkboxes, each focus event re-announces the group name alongside the individual checkbox label.

As a bonus, `<fieldset disabled>` cascades the disabled state to every descendant `<input>` natively — no Svelte context or prop forwarding required.

## Names, Roles, States

- **Group name**: the `<legend>` element.
- **Group description**: a `<p>` element whose `id` is included in the fieldset's `aria-describedby`.
- **Group error**: a `<p aria-live="polite">` element whose `id` is included in the fieldset's `aria-describedby`. The fieldset also carries `aria-invalid="true"` when `error` is set.
- **Individual checkboxes**: each child `<input type="checkbox">` retains its own `aria-checked`, its own `aria-invalid` (only when its own `error` prop is set), and its own label association via `<label for="…">`.

## Group `error` vs. Per-Checkbox `error`

AT support for `aria-invalid` on `<fieldset>` is inconsistent across NVDA, JAWS, and VoiceOver. Additionally, fieldset-level `aria-describedby` is **not reliably re-announced** as focus moves between descendant checkboxes. The group-level `error` is therefore **best-effort supplemental context**: always visible to sighted users, but not a guaranteed per-focus screen reader announcement.

When the error **must** be announced as the user focuses a specific control, pass the `error` prop directly to that `<Checkbox>` (which wires `aria-describedby` on the native input) in addition to or instead of the group `error`.

## Disabled Propagation

The `disabled` prop sets the native `disabled` attribute on `<fieldset>`. The browser then marks every descendant `<input>` as disabled — children cannot opt out of this cascade. The `CheckboxGroup` itself adds no JavaScript logic; this is the platform contract.

## Required

The `required` prop is a **visual and data-attribute hint only**. It sets `data-cinder-required` on the fieldset (present when `true`, absent when `false`) so consumers can target it for styling (e.g., rendering an asterisk in the legend).

It does **not** set the `required` attribute on any child `<input>` and does **not** enforce constraint validation. To enforce that at least one checkbox is checked, either:

- Add `required` to the specific child `<Checkbox>` that must be checked, or
- Implement form-level validation that inspects the group's checked state.

## Indeterminate Parent ("Select All") Pattern

A common UI pattern is a top-level "select all" checkbox whose visual state reflects whether **some** (indeterminate) or **all** (checked) children are checked:

```svelte
<script>
  let items = $state([
    { id: 'a', label: 'Item A', checked: false },
    { id: 'b', label: 'Item B', checked: true },
  ]);

  let allChecked = $derived(items.every((i) => i.checked));
  let someChecked = $derived(items.some((i) => i.checked));

  function toggleAll(event) {
    const next = event.target.checked;
    items = items.map((i) => ({ ...i, checked: next }));
  }
</script>

<CheckboxGroup legend="Select items">
  <Checkbox
    id="select-all"
    name="select-all"
    label="Select all"
    checked={allChecked}
    indeterminate={someChecked && !allChecked}
    onchange={toggleAll}
  />
  {#each items as item}
    <Checkbox id={item.id} name={item.id} label={item.label} bind:checked={item.checked} />
  {/each}
</CheckboxGroup>
```

The existing `Checkbox` component already supports `indeterminate` (synced via a `$effect` as a DOM property). `CheckboxGroup` has no indeterminate-aware code — the behavior belongs entirely to `Checkbox`.

## Card Variant

The card layout (`variant="card"`) is purely visual: a bordered surface wraps each direct-child `.cinder-checkbox-field`. The checked-state border highlight is **additive** — the native check glyph inside each `Checkbox` remains the canonical indicator. Screen readers and users in Windows High Contrast / forced-colors mode rely on `aria-checked` on the native input, not on the card border.

Card mode expects each direct child of the items container to be a single `<Checkbox>`. Non-checkbox content or wrapper elements inside `children` will not receive the card styling, by design.

## Keyboard

No custom keyboard handling is added. Each checkbox responds to `Space` to toggle, `Tab` to move focus, as the platform defines. DOM order determines tab sequence.
