# Collapsible

Single-panel show/hide disclosure — the single-item counterpart to Accordion. A labeled trigger toggles one region, animating its height open and closed with Svelte's native `slide` transition.

## Usage

Uncontrolled — the component owns its state:

```svelte
<script lang="ts">
  import Collapsible from '@lostgradient/cinder/collapsible';
</script>

<Collapsible trigger="Shipping details">
  <p>Orders ship within two business days.</p>
</Collapsible>
```

Controlled — the parent owns the state with `bind:open`:

```svelte
<script lang="ts">
  import Collapsible from '@lostgradient/cinder/collapsible';

  let open = $state(false);
</script>

<Collapsible bind:open trigger="Controlled panel">
  <p>Open state is shared with the parent.</p>
</Collapsible>
```

### State model

`open` is bindable. Without `bind:open`, it seeds local state and can still be updated by parent prop changes, but trigger clicks update local state only. Use `bind:open` (or mirror `ontoggle` in the parent) when parent and trigger interactions must stay fully synchronized. `ontoggle` fires on every toggle with the next boolean, so one-way observers stay in sync.

The `trigger` prop is either a string or a snippet receiving `{ open, disabled }`, letting the label react to state (for example, swapping "Show" and "Hide").
Use `triggerAriaLabel` when you need a dedicated accessible name on the internal trigger button. It accepts either a static string or a state-aware function (`({ open, disabled }) => string`) for dynamic labels and stable `getByRole(..., { name })` selectors.

## Accessibility

- The trigger is a native `<button type="button">`, so Enter and Space activation and tab order come from the browser. `disabled` uses the real attribute, removing it from the tab order.
- The trigger carries `aria-expanded`; the panel is a `role="region"` labeled by the trigger via `aria-labelledby`.
- The panel is removed from the DOM when closed (standard disclosure behavior). `aria-controls` is emitted only while the panel exists, so it never references a missing element. Each open panel registers as a named `region` landmark — on a page with many open Collapsibles, weigh that against landmark-navigation noise.
- Height animation collapses to zero duration under `prefers-reduced-motion: reduce`, and the chevron rotation transition is disabled in CSS.

For multiple coordinated sections where opening one may close others, use [`Accordion`](../accordion/README.md) instead. See [`collapsible.a11y.md`](./collapsible.a11y.md) for a detailed comparison of when to use each pattern.

## Props

<!-- generated:props:start -->

| Prop               | Type       | Required | Default | Description                                                                                                                                                                                |
| ------------------ | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`            | `string`   | no       | —       | Additional classes merged onto the root element.                                                                                                                                           |
| `disabled`         | `boolean`  | no       | `false` | When true, the trigger cannot be toggled.                                                                                                                                                  |
| `idBase`           | `string`   | no       | —       | Base used to derive the trigger and panel ARIA ids. Auto-generated when omitted.                                                                                                           |
| `open`             | `boolean`  | no       | `false` | Bindable open state. Without `bind:open`, this seeds local state and can be updated by parent prop changes. Use `bind:open` for full parent/trigger synchronization.                       |
| `trigger`          | `string`   | yes      | —       | Trigger label text. (The snippet form is template-only; see the type above.)                                                                                                               |
| `triggerAriaLabel` | `string`   | no       | —       | Accessible name override for the trigger button. The runtime prop also accepts a state-aware function (`{ open, disabled } => string`), but JSON Schema can only model the string variant. |
| `children`         | `(opaque)` | yes      | —       | Panel content shown when open. Not expressible in JSON Schema; see the component types for the signature.                                                                                  |
| `ontoggle`         | `(opaque)` | no       | —       | Fired on every successful toggle with the next open state. Not called while disabled. Not expressible in JSON Schema; see the component types for the signature.                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
